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
import { OrderRepository } from '../order.reposityro';
import {
    PendingAcceptanceReminderRedisKeys,
    type PendingAcceptanceReminderTask,
    PENDING_ACCEPTANCE_REMINDER_SEQUENCE,
} from '../pending-acceptance-reminder.constants';

type DetailedOrder = Awaited<ReturnType<OrderRepository['getOrderById']>>;

interface ReminderQueueEntry {
    payload: PendingAcceptanceReminderTask;
    score: number;
}

@Injectable()
export class PendingAcceptanceReminderWorker
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(PendingAcceptanceReminderWorker.name);
    private readonly blockingClient: Redis;
    private running = false;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
        private readonly orderRepository: OrderRepository,
        private readonly notificationPublisher: NotificationPublisher,
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

    private getDefinition(stage: PendingAcceptanceReminderTask['stage']) {
        return PENDING_ACCEPTANCE_REMINDER_SEQUENCE.find(
            (definition) => definition.stage === stage,
        );
    }

    private parsePayload(
        rawValue: string,
    ): PendingAcceptanceReminderTask | null {
        try {
            const parsed = JSON.parse(
                rawValue,
            ) as PendingAcceptanceReminderTask;
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
            PendingAcceptanceReminderRedisKeys.scheduleZset,
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
        const entry = {
            payload,
            score,
        };
        this.logger.debug?.(
            `待接单提醒读取任务: order=${payload.orderId} stage=${payload.stage} score=${new Date(
                score,
            ).toISOString()}`,
        );
        return entry;
    }

    private async requeue(entry: ReminderQueueEntry, delayMs = 5000) {
        const nextScore = Date.now() + Math.max(delayMs, 1000);
        await this.cacheService.zAdd(
            PendingAcceptanceReminderRedisKeys.scheduleZset,
            nextScore,
            entry.payload,
        );
        this.logger.debug?.(
            `待接单提醒任务重新排队 order=${entry.payload.orderId} stage=${entry.payload.stage} delay=${delayMs}ms`,
        );
    }

    private async handleWarningStage(
        order: DetailedOrder | null,
        payload: PendingAcceptanceReminderTask,
    ) {
        if (
            !order?.assignment ||
            order.assignment.decisionStatus !== 'pending' ||
            order.status !== 'pending_acceptance'
        ) {
            this.logger.debug?.(
                `待接单提醒跳过，订单状态已变化 order=${order?.id ?? payload.orderId} status=${order?.status} decision=${order?.assignment?.decisionStatus}`,
            );
            return;
        }
        const serviceUserId = order.assignment.servicePersonnel?.userId;
        if (!serviceUserId) {
            this.logger.warn(
                `待接单提醒缺少服务人员 userId，order=${order.id} assignment=${order.assignment.id}`,
            );
            return;
        }
        const definition = this.getDefinition(payload.stage);
        if (!definition) {
            return;
        }
        const deadline = payload.deadline ? new Date(payload.deadline) : null;
        const remainingMinutes = this.calculateRemainingMinutes(deadline);
        const orderLabel =
            order.service?.name ?? `订单 ${order.id.slice(0, 6)}`;
        const message = `${orderLabel} ${definition.escalateLabel}`;
        try {
            await this.notificationPublisher.publish({
                event: 'order_pending_acceptance_warning',
                payload: {
                    event: 'order_pending_acceptance_warning',
                    orderId: order.id,
                    status: order.status,
                    appointmentTime: order.appointmentTime
                        ? new Date(order.appointmentTime).toISOString()
                        : undefined,
                    serviceName: order.service?.name ?? order.serviceId,
                    totalAmount: order.totalAmount,
                    message,
                    warningLevel: payload.warningLevel,
                    warningType: 'pending_acceptance',
                    deadline: payload.deadline,
                    remainingMinutes,
                    assignmentType:
                        order.assignment.assignmentType ?? undefined,
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
                `订单 ${order.id} 待接单提醒 ${payload.stage} 已发送`,
            );
        } catch (error) {
            this.logger.warn(
                `订单 ${order.id} 待接单提醒发送失败`,
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private async handleAutoCancel(entry: ReminderQueueEntry) {
        const orderId = entry.payload.orderId;
        const lockKey = `${PendingAcceptanceReminderRedisKeys.lockPrefix}${orderId}`;
        const lockId = await this.cacheService.acquireLock(lockKey, 10, 1, 200);
        if (!lockId) {
            this.logger.warn(`订单 ${orderId} 自动取消锁获取失败，稍后重试`);
            await this.requeue(entry, 5000);
            return;
        }
        try {
            const latest = await this.orderRepository.getOrderById(orderId);
            if (
                !latest ||
                !latest.assignment ||
                latest.assignment.id !== entry.payload.assignmentId ||
                latest.assignment.decisionStatus !== 'pending' ||
                latest.status !== 'pending_acceptance'
            ) {
                this.logger.debug?.(
                    `自动取消跳过，订单状态已变化 order=${latest?.id ?? entry.payload.orderId} status=${latest?.status} decision=${latest?.assignment?.decisionStatus}`,
                );
                return;
            }
            const reason = '[system] 待接单超时，系统自动取消';
            try {
                await this.orderRepository.cancelOrder(latest.id, reason, null);
            } catch (error) {
                if (error instanceof BadRequestException) {
                    this.logger.debug?.(
                        `订单 ${latest.id} 状态已更新，跳过自动取消`,
                    );
                    return;
                }
                throw error;
            }
            const cancelledOrder =
                (await this.orderRepository.getOrderById(latest.id)) ?? latest;
            await this.notifyAutoCancellation(cancelledOrder, reason);
            this.logger.log(`订单 ${orderId} 待接单超时，系统自动取消`);
        } catch (error) {
            this.logger.error(
                `订单 ${orderId} 自动取消任务处理失败`,
                error instanceof Error ? error.message : String(error),
            );
            await this.requeue(entry, 10000);
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
                `订单 ${order.id} 自动取消通知失败`,
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private async handleEntry(entry: ReminderQueueEntry) {
        const now = Date.now();
        if (entry.score > now) {
            await this.cacheService.zAdd(
                PendingAcceptanceReminderRedisKeys.scheduleZset,
                entry.score,
                entry.payload,
            );
            const waitMs = Math.min(entry.score - now, 60_000);
            this.logger.debug?.(
                `待接单提醒未到期，重新入队 order=${entry.payload.orderId} stage=${entry.payload.stage} wait=${waitMs}ms`,
            );
            await sleep(waitMs);
            return;
        }
        const order = await this.orderRepository.getOrderById(
            entry.payload.orderId,
        );
        if (!order || !order.assignment) {
            this.logger.debug?.(
                `待接单提醒任务关联的订单不存在，order=${entry.payload.orderId}`,
            );
            return;
        }
        if (order.assignment.id !== entry.payload.assignmentId) {
            this.logger.debug?.(
                `待接单提醒任务 assignment 不匹配，order=${order.id} current=${order.assignment.id} expected=${entry.payload.assignmentId}`,
            );
            return;
        }
        if (entry.payload.stage === 'auto_cancel') {
            await this.handleAutoCancel(entry);
            return;
        }
        await this.handleWarningStage(order, entry.payload);
    }

    private calculateRemainingMinutes(
        deadline: Date | null,
    ): string | undefined {
        if (!deadline || Number.isNaN(deadline.getTime())) {
            return undefined;
        }
        const diff = deadline.getTime() - Date.now();
        if (diff <= 0) {
            return '0';
        }
        return Math.max(1, Math.round(diff / 60000)).toString();
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
                    `待接单提醒开始处理 order=${entry.payload.orderId} stage=${entry.payload.stage}`,
                );
                await this.handleEntry(entry);
            } catch (error) {
                this.logger.warn(
                    '待接单提醒轮询异常',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }
}
