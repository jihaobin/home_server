import { setTimeout as sleep } from 'node:timers/promises';
import {
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
    CACHE_SERVICE,
    type IAdvancedCacheService,
    OrderExpireRedisKeys,
} from 'src/common/cache';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { orders, payments } from 'src/common/database/schema/orders';
import { OrderRepository } from '../order.reposityro';

interface StreamEntry {
    id: string;
    orderId: string;
    expiresAt?: string;
    attempt: number;
}

@Injectable()
export class OrderExpireConsumerService
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(OrderExpireConsumerService.name);
    private readonly consumerId = `${process.pid}-${randomUUID()}`;
    private readonly groupName = 'order-expired-group';
    private readonly maxAttempt = 3;
    private running = false;
    private readonly streamClient: Redis;

    constructor(
        @Inject(DB)
        private readonly db: DbType,
        @Inject(OrderRepository)
        private readonly orderRepository: OrderRepository,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
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
                OrderExpireRedisKeys.expiredStream,
                this.groupName,
                '$',
                'MKSTREAM',
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (!message.includes('BUSYGROUP')) {
                this.logger.error('创建订单过期消费者组失败', message);
                throw error;
            }
        }
    }

    private parseEntries(raw: Array<[string, string[]]>): StreamEntry[] {
        return raw.map(([id, fields]) => {
            const record: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
                record[fields[i]] = fields[i + 1] ?? '';
            }
            return {
                id,
                orderId: record.orderId,
                expiresAt: record.expiresAt,
                attempt: Number(record.attempt ?? '1') || 1,
            };
        });
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
            20,
            'STREAMS',
            OrderExpireRedisKeys.expiredStream,
            '>',
        );
        if (!result || !result.length) {
            return [];
        }
        const [, entries] = result[0];
        return this.parseEntries(entries ?? []);
    }

    private async ack(entry: StreamEntry) {
        await this.cacheService.xAck(
            OrderExpireRedisKeys.expiredStream,
            this.groupName,
            entry.id,
        );
    }

    private async notify(orderId: string) {
        await this.cacheService.xAdd(OrderExpireRedisKeys.notifyStream, '*', {
            event: 'order_payment_expired',
            orderId,
            status: 'payment_timeout',
            message: '订单支付超时，系统自动取消',
            triggeredAt: new Date().toISOString(),
        });
    }

    private async sendToDlq(entry: StreamEntry, errorMessage: string) {
        await this.cacheService.xAdd(
            OrderExpireRedisKeys.deadLetterStream,
            '*',
            {
                orderId: entry.orderId,
                error: errorMessage,
                attempt: entry.attempt,
                failedAt: new Date().toISOString(),
            },
        );
        await this.ack(entry);
    }

    private async reschedule(entry: StreamEntry) {
        const delay = 200 * entry.attempt * entry.attempt;
        await sleep(delay);
        await this.cacheService.xAdd(OrderExpireRedisKeys.expiredStream, '*', {
            orderId: entry.orderId,
            expiresAt: entry.expiresAt ?? new Date().toISOString(),
            attempt: entry.attempt + 1,
        });
        await this.ack(entry);
    }

    private async handleEntry(entry: StreamEntry) {
        if (!entry.orderId) {
            await this.sendToDlq(entry, '缺少 orderId');
            return;
        }

        try {
            await this.db.transaction(async (tx) => {
                const current = await tx.query.orders.findFirst({
                    where: eq(orders.id, entry.orderId),
                });

                if (!current || current.status !== 'pending_payment') {
                    return;
                }

                if (
                    entry.expiresAt &&
                    new Date(entry.expiresAt).getTime() > Date.now()
                ) {
                    return;
                }

                await this.orderRepository.markOrderPaymentTimeout(
                    entry.orderId,
                    '支付超时系统自动取消',
                    tx,
                );

                await tx
                    .update(payments)
                    .set({ status: 'failed', updatedAt: new Date() })
                    .where(
                        and(
                            eq(payments.orderId, entry.orderId),
                            eq(payments.status, 'pending'),
                        ),
                    );
            });

            await this.notify(entry.orderId);
            await this.ack(entry);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`订单 ${entry.orderId} 支付超时处理失败`, message);
            if (entry.attempt >= this.maxAttempt) {
                await this.sendToDlq(entry, message);
            } else {
                await this.reschedule(entry);
            }
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
                    '订单支付超时消费者循环异常',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }
}
