import { setTimeout as sleep } from 'node:timers/promises';
import type { Redis } from 'ioredis';
import {
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

const SERVICE_TIME_WINDOW_MS = 2 * 60 * 60 * 1000;

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

        const orderStart = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        const payloadStart = payload.appointmentTime
            ? new Date(payload.appointmentTime)
            : null;
        if (!orderStart || Number.isNaN(orderStart.getTime())) {
            this.logger.debug?.(`上门提醒缺少预约时间，order=${order.id}`);
            return;
        }
        if (!payloadStart || Number.isNaN(payloadStart.getTime())) {
            this.logger.debug?.(
                `上门提醒 payload 预约时间无效，order=${order.id}`,
            );
            return;
        }

        const orderStartMs = orderStart.getTime();
        const orderEndMs = orderStartMs + SERVICE_TIME_WINDOW_MS;
        const payloadStartMs = payloadStart.getTime();
        const payloadEndMs = payload.appointmentWindowEndTime
            ? new Date(payload.appointmentWindowEndTime).getTime()
            : payloadStartMs + SERVICE_TIME_WINDOW_MS;

        // 改期后旧提醒可能残留：若 payload 窗口与当前订单窗口不一致，直接跳过，避免误提醒。
        if (payloadStartMs !== orderStartMs || payloadEndMs !== orderEndMs) {
            this.logger.debug?.(
                `上门提醒窗口已变更，跳过发送 order=${order.id} stage=${payload.stage}`,
            );
            return;
        }

        const windowEnd = new Date(orderEndMs);
        const remainingMinutes = this.calculateRemainingMinutes(windowEnd);
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
                appointmentTime: orderStart.toISOString(),
                appointmentWindowEndTime: windowEnd.toISOString(),
                serviceName: order.service?.name ?? order.serviceId,
                totalAmount: order.totalAmount,
                message,
                warningLevel: payload.warningLevel,
                warningType: 'service_eta',
                deadline: windowEnd.toISOString(),
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
        if (!SERVICE_STATUS_ALLOWLIST.has(order.status)) {
            this.logger.debug?.(`上门提醒跳过，订单状态=${order.status}`);
            return;
        }

        const definition = this.getDefinition(entry.payload.stage);
        if (!definition) {
            return;
        }

        const orderStart = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        if (!orderStart || Number.isNaN(orderStart.getTime())) {
            return;
        }
        const orderStartMs = orderStart.getTime();
        const orderEndMs = orderStartMs + SERVICE_TIME_WINDOW_MS;
        const expectedScore = orderEndMs - definition.offsetMs;

        // 兼容历史任务：老逻辑按窗口起点调度；新逻辑按窗口终点调度。
        // 若当前任务早于“窗口终点 - offset”，则重新入队到正确的时间点。
        if (expectedScore > now) {
            const normalized: ServiceEtaReminderTask = {
                ...entry.payload,
                appointmentTime: orderStart.toISOString(),
                appointmentWindowEndTime: new Date(orderEndMs).toISOString(),
                scheduledAt: new Date(expectedScore).toISOString(),
            };
            await this.cacheService.zAdd(
                ServiceEtaReminderRedisKeys.scheduleZset,
                expectedScore,
                normalized,
            );
            this.logger.debug?.(
                `上门提醒重排期 order=${order.id} stage=${entry.payload.stage} scheduledAt=${normalized.scheduledAt}`,
            );
            return;
        }

        await this.sendReminder(order, {
            ...entry.payload,
            appointmentTime: orderStart.toISOString(),
            appointmentWindowEndTime: new Date(orderEndMs).toISOString(),
        });
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
