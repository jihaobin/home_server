import { setTimeout as sleep } from 'node:timers/promises';
import {
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
    CACHE_SERVICE,
    type IAdvancedCacheService,
    OrderExpireRedisKeys,
} from 'src/common/cache';
import {
    OrderNotificationPayload,
    OrderNotifySseService,
} from '../order-notify-sse.service';

interface StreamEntry {
    id: string;
    fields: string[];
}

@Injectable()
export class OrderNotifyRelayService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OrderNotifyRelayService.name);
    private readonly consumerId = `${process.pid}-${randomUUID()}`;
    private readonly groupName = 'order-notify-admin';
    private running = false;
    private readonly streamClient: Redis;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
        private readonly orderNotifySseService: OrderNotifySseService,
    ) {
        const baseClient = this.cacheService.getClient<Redis>();
        this.streamClient = baseClient.duplicate();
    }

    async onModuleInit() {
        await this.ensureGroup();
        this.running = true;
        void this.loop();
    }

    onModuleDestroy() {
        this.running = false;
        void this.streamClient.quit().catch(() => undefined);
    }

    private async ensureGroup() {
        const client = this.cacheService.getClient<{
            xgroup: (...args: unknown[]) => Promise<unknown>;
        }>();
        try {
            await client.xgroup(
                'CREATE',
                OrderExpireRedisKeys.notifyStream,
                this.groupName,
                '$',
                'MKSTREAM',
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (!message.includes('BUSYGROUP')) {
                this.logger.error('创建订单通知消费者组失败', message);
                throw error;
            }
        }
    }

    private async readBatch(): Promise<StreamEntry[]> {
        const client = this.streamClient as unknown as {
            xreadgroup: (
                ...args: Array<string | number>
            ) => Promise<Array<[string, Array<[string, string[]]>]> | null>;
        };

        const result = await client.xreadgroup(
            'GROUP',
            this.groupName,
            this.consumerId,
            'BLOCK',
            5000,
            'COUNT',
            50,
            'STREAMS',
            OrderExpireRedisKeys.notifyStream,
            '>',
        );
        if (!result || !result.length) {
            return [];
        }
        const [, entries] = result[0];
        return (entries ?? []).map(([id, fields]) => ({ id, fields }));
    }

    private async ack(entry: StreamEntry) {
        await this.cacheService.xAck(
            OrderExpireRedisKeys.notifyStream,
            this.groupName,
            entry.id,
        );
    }

    private toPayload(entry: StreamEntry): OrderNotificationPayload | null {
        const record: Record<string, string> = {};
        for (let i = 0; i < entry.fields.length; i += 2) {
            record[entry.fields[i]] = entry.fields[i + 1] ?? '';
        }
        if (!record.orderId) {
            return null;
        }
        return {
            event: record.event ?? 'order_payment_expired',
            orderId: record.orderId,
            status: record.status,
            message: record.message,
            triggeredAt: record.triggeredAt,
            decisionStatus: record.decisionStatus,
            operatorId: record.operatorId,
        };
    }

    private async handleEntry(entry: StreamEntry) {
        try {
            const payload = this.toPayload(entry);
            if (!payload) {
                await this.ack(entry);
                return;
            }
            this.orderNotifySseService.emit(payload);
            await this.ack(entry);
        } catch (error) {
            this.logger.warn(
                '派发订单通知失败',
                error instanceof Error ? error.message : String(error),
            );
            await sleep(500);
        }
    }

    private async loop() {
        while (this.running) {
            try {
                const entries = await this.readBatch();
                if (!entries.length) {
                    await sleep(500);
                    continue;
                }
                for (const entry of entries) {
                    await this.handleEntry(entry);
                }
            } catch (error) {
                this.logger.warn(
                    '订单通知轮询异常',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }
}
