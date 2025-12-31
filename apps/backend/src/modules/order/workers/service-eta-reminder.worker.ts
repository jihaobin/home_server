import { setTimeout as sleep } from 'node:timers/promises';
import type { Redis } from 'ioredis';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';

import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { NotificationPublisher } from 'src/modules/notification/notification.publisher';
import { NotificationTemplateService } from 'src/modules/notification/notification-template.service';
import { OrderRepository } from '../order.reposityro';
import {
    ServiceEtaReminderRedisKeys,
    SERVICE_ETA_REMINDER_SEQUENCE,
    type ServiceEtaReminderTask,
} from '../service-eta-reminder.constants';
import type { OrderStatus } from '@repo/types';

type DetailedOrder = Awaited<ReturnType<OrderRepository['getOrderById']>>;

interface ReminderQueueEntry {
    payload: ServiceEtaReminderTask;
    score: number;
}

const SERVICE_STATUS_ALLOWLIST: ReadonlySet<OrderStatus> = new Set([
    'paid',
    'in_progress',
]);

@Injectable()
export class ServiceEtaReminderWorker implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ServiceEtaReminderWorker.name);
    private readonly blockingClient: Redis;
    private running = false;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
        private readonly orderRepository: OrderRepository,
        private readonly notificationPublisher: NotificationPublisher,
        private readonly notificationTemplateService: NotificationTemplateService,
    ) {
        const baseClient = this.cacheService.getClient<Redis>();
        this.blockingClient = baseClient.duplicate();
    }

    onModuleInit() {
        this.running = true;
        void this.loop();
    }

    async onModuleDestroy() {
        this.running = false;
        await this.blockingClient.quit().catch(() => undefined);
    }

    private getDefinition(stage: ServiceEtaReminderTask['stage']) {
        return SERVICE_ETA_REMINDER_SEQUENCE.find(
            (definition) => definition.stage === stage,
        );
    }

    private parsePayload(raw: string): ServiceEtaReminderTask | null {
        try {
            const parsed = JSON.parse(raw) as ServiceEtaReminderTask;
            if (!parsed?.orderId || !parsed.assignmentId || !parsed.stage) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    private async readNext(): Promise<ReminderQueueEntry | null> {
        const popped = await this.blockingClient.bzpopmin(
            ServiceEtaReminderRedisKeys.scheduleZset,
            1,
        );
        if (!popped) {
            return null;
        }
        const [, rawValue, scoreString] = popped;
        const payload = this.parsePayload(rawValue);
        if (!payload) {
            return null;
        }
        const score = Number(scoreString);
        if (!Number.isFinite(score)) {
            return null;
        }
        this.logger.debug?.(
            `上门提醒读取任务 order=${payload.orderId} stage=${payload.stage} score=${new Date(
                score,
            ).toISOString()}`,
        );
        return { payload, score };
    }

    private async requeue(entry: ReminderQueueEntry, delayMs = 60_000) {
        const nextScore = Date.now() + Math.max(delayMs, 1000);
        await this.cacheService.zAdd(
            ServiceEtaReminderRedisKeys.scheduleZset,
            nextScore,
            entry.payload,
        );
        this.logger.debug?.(
            `上门提醒未到期重新排队 order=${entry.payload.orderId} stage=${entry.payload.stage} delay=${delayMs}ms`,
        );
    }

    private calculateRemainingMinutes(target: Date | null): string | undefined {
        if (!target || Number.isNaN(target.getTime())) {
            return undefined;
        }
        const diff = target.getTime() - Date.now();
        if (diff <= 0) {
            return '0';
        }
        return Math.max(1, Math.round(diff / 60000)).toString();
    }

    private async sendReminder(
        order: DetailedOrder | null,
        payload: ServiceEtaReminderTask,
    ) {
        if (!order) {
            return;
        }
        const serviceUserId = order.assignment?.servicePersonnel?.userId;
        if (!serviceUserId) {
            this.logger.debug?.(
                `上门提醒缺少服务人员 userId，order=${order.id}`,
            );
            return;
        }
        const definition = this.getDefinition(payload.stage);
        if (!definition) {
            return;
        }
        const appointment = payload.appointmentTime
            ? new Date(payload.appointmentTime)
            : order.appointmentTime
              ? new Date(order.appointmentTime)
              : null;
        if (!appointment || Number.isNaN(appointment.getTime())) {
            this.logger.debug?.(`上门提醒缺少预约时间，order=${order.id}`);
            return;
        }
        const remainingMinutes = this.calculateRemainingMinutes(appointment);
        const orderLabel =
            order.service?.name ?? `订单 ${order.id.slice(0, 6)}`;
        const message = this.notificationTemplateService.getTemplate(
            'order_service_eta_warning',
            {
                orderLabel,
                escalateLabel: definition.escalateLabel,
                warningLevel: payload.warningLevel,
            },
        );
        await this.notificationPublisher.publish({
            event: 'order_service_eta_warning',
            payload: {
                event: 'order_service_eta_warning',
                orderId: order.id,
                status: order.status,
                appointmentTime: appointment.toISOString(),
                serviceName: order.service?.name ?? order.serviceId,
                totalAmount: order.totalAmount,
                message,
                warningLevel: payload.warningLevel,
                warningType: 'service_eta',
                deadline: appointment.toISOString(),
                remainingMinutes,
                assignmentType: order.assignment?.assignmentType ?? undefined,
            },
            targets: [
                {
                    targetId: `${order.id}:service_personnel:${serviceUserId}`,
                    userId: serviceUserId,
                    targetType: 'service_personnel',
                },
            ],
        });
        this.logger.debug?.(
            `订单 ${order.id} 上门提醒 ${payload.stage} 已发送`,
        );
    }

    private async handleAutoCancel(entry: ReminderQueueEntry) {
        const orderId = entry.payload.orderId;
        const lockKey = `${ServiceEtaReminderRedisKeys.lockPrefix}${orderId}`;
        const lockId = await this.cacheService.acquireLock(lockKey, 10, 1, 200);
        if (!lockId) {
            this.logger.warn(`上门提醒自动取消锁获取失败 order=${orderId}`);
            await this.requeue(entry, 30_000);
            return;
        }
        try {
            const latest = await this.orderRepository.getOrderById(orderId);
            if (
                !latest ||
                !latest.assignment ||
                latest.assignment.id !== entry.payload.assignmentId ||
                latest.assignment.decisionStatus !== 'accepted'
            ) {
                this.logger.debug?.(
                    `上门自动取消跳过，订单状态已变化 order=${latest?.id ?? orderId}`,
                );
                return;
            }
            if (latest.status !== 'paid') {
                this.logger.debug?.(
                    `上门自动取消跳过，订单状态=${latest.status}`,
                );
                return;
            }
            const reason = '[system] 服务人员未按预约时间上门，系统自动取消';
            try {
                await this.orderRepository.cancelOrder(orderId, reason, null);
            } catch (error) {
                if (error instanceof BadRequestException) {
                    this.logger.debug?.(
                        `订单 ${orderId} 自动取消时状态已更新，跳过`,
                    );
                    return;
                }
                throw error;
            }
            const cancelled =
                (await this.orderRepository.getOrderById(orderId)) ?? latest;
            await this.notifyAutoCancellation(cancelled, reason);
            this.logger.log(`订单 ${orderId} 因未上门被系统自动取消`);
        } catch (error) {
            this.logger.error(
                `订单 ${orderId} 自动取消失败`,
                error instanceof Error ? error.message : String(error),
            );
            await this.requeue(entry, 60_000);
        } finally {
            await this.cacheService
                .releaseLock(lockKey, lockId)
                .catch(() => undefined);
        }
    }

    private async notifyAutoCancellation(
        order: DetailedOrder | null,
        reason: string,
    ) {
        if (!order?.assignment?.servicePersonnel?.userId) {
            return;
        }
        const serviceUserId = order.assignment.servicePersonnel.userId;
        try {
            await this.notificationPublisher.publish({
                event: 'order_cancelled',
                payload: {
                    event: 'order_cancelled',
                    orderId: order.id,
                    status: 'cancelled',
                    cancelReason: reason,
                    message: reason,
                },
                targets: [
                    {
                        targetId: `${order.id}:service_personnel:${serviceUserId}`,
                        userId: serviceUserId,
                        targetType: 'service_personnel',
                    },
                ],
            });
        } catch (error) {
            this.logger.warn(
                `订单 ${order?.id} 自动取消通知失败`,
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private async handleEntry(entry: ReminderQueueEntry) {
        const now = Date.now();
        if (entry.score > now) {
            await this.cacheService.zAdd(
                ServiceEtaReminderRedisKeys.scheduleZset,
                entry.score,
                entry.payload,
            );
            const waitMs = Math.min(entry.score - now, 60_000);
            this.logger.debug?.(
                `上门提醒未到执行时间，重新排队 order=${entry.payload.orderId} stage=${entry.payload.stage} wait=${waitMs}ms`,
            );
            await sleep(waitMs);
            return;
        }
        const order = await this.orderRepository.getOrderById(
            entry.payload.orderId,
        );
        if (!order || !order.assignment) {
            this.logger.debug?.(
                `上门提醒关联订单不存在，order=${entry.payload.orderId}`,
            );
            return;
        }
        if (order.assignment.id !== entry.payload.assignmentId) {
            this.logger.debug?.(
                `上门提醒 assignment 不匹配，order=${order.id}`,
            );
            return;
        }
        if (order.assignment.decisionStatus !== 'accepted') {
            this.logger.debug?.(
                `上门提醒跳过，决策状态=${order.assignment.decisionStatus}`,
            );
            return;
        }
        if (entry.payload.stage === 'auto_cancel') {
            await this.handleAutoCancel(entry);
            return;
        }
        if (!SERVICE_STATUS_ALLOWLIST.has(order.status)) {
            this.logger.debug?.(`上门提醒跳过，订单状态=${order.status}`);
            return;
        }
        await this.sendReminder(order, entry.payload);
    }

    private async loop() {
        while (this.running) {
            try {
                const entry = await this.readNext();
                if (!entry) {
                    await sleep(500);
                    continue;
                }
                this.logger.debug?.(
                    `上门提醒开始处理 order=${entry.payload.orderId} stage=${entry.payload.stage}`,
                );
                await this.handleEntry(entry);
            } catch (error) {
                this.logger.warn(
                    '上门提醒轮询异常',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }
}
