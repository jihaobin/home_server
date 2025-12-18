import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

import {
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import {
    CACHE_SERVICE,
    NotificationRedisKeys,
    type IAdvancedCacheService,
} from 'src/common/cache';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    notificationOutbox,
    notifications,
    type NotificationMetadata,
} from 'src/common/database/schema/notifications';

interface PendingNotification {
    notificationId: string;
    payload: NotificationMetadata;
}

@Injectable()
export class NotificationOutboxRelayService
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(NotificationOutboxRelayService.name);
    private readonly lockOwner = `${process.pid}-${randomUUID()}`;
    private running = false;
    private readonly lockTimeoutMs = 10_000;
    private readonly batchSize = 50;

    constructor(
        @Inject(DB)
        private readonly db: DbType,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    onModuleInit() {
        this.running = true;
        void this.loop();
    }

    onModuleDestroy() {
        this.running = false;
    }

    private async loop() {
        while (this.running) {
            try {
                const batch = await this.fetchBatch();
                if (!batch.length) {
                    await sleep(500);
                    continue;
                }
                for (const item of batch) {
                    await this.process(item);
                }
            } catch (error) {
                this.logger.error(
                    'Outbox Relay 执行失败',
                    error instanceof Error ? error.message : String(error),
                );
                await sleep(1000);
            }
        }
    }

    private async fetchBatch(): Promise<PendingNotification[]> {
        const lockExpiry = new Date(Date.now() - this.lockTimeoutMs);
        const candidates = await this.db
            .select({ notificationId: notificationOutbox.notificationId })
            .from(notificationOutbox)
            .where(
                and(
                    eq(notificationOutbox.sent, false),
                    or(
                        isNull(notificationOutbox.lockedAt),
                        lt(notificationOutbox.lockedAt, lockExpiry),
                    ),
                ),
            )
            .orderBy(notificationOutbox.createdAt)
            .limit(this.batchSize);

        const batch: PendingNotification[] = [];
        for (const candidate of candidates) {
            const locked = await this.lockOutbox(candidate.notificationId);
            if (!locked) {
                continue;
            }
            const notification = await this.db.query.notifications.findFirst({
                where: eq(notifications.id, candidate.notificationId),
            });
            if (!notification) {
                await this.markAsSent(candidate.notificationId);
                continue;
            }
            const payloadWithId = {
                ...notification.payload,
                notificationId: notification.id,
            };
            batch.push({
                notificationId: candidate.notificationId,
                payload: payloadWithId,
            });
        }
        return batch;
    }

    private async process(item: PendingNotification) {
        try {
            const record = this.toStreamRecord(item);
            await this.cacheService.xAdd(
                NotificationRedisKeys.stream,
                '*',
                record,
            );
            await this.markAsSent(item.notificationId);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`写入通知流失败 ${item.notificationId}`, message);
            await this.releaseLock(item.notificationId, message);
            await sleep(200);
        }
    }

    private async lockOutbox(notificationId: string) {
        const lockExpiry = new Date(Date.now() - this.lockTimeoutMs);
        const [row] = await this.db
            .update(notificationOutbox)
            .set({
                lockedAt: new Date(),
                lockOwner: this.lockOwner,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(notificationOutbox.notificationId, notificationId),
                    eq(notificationOutbox.sent, false),
                    or(
                        isNull(notificationOutbox.lockedAt),
                        lt(notificationOutbox.lockedAt, lockExpiry),
                        eq(notificationOutbox.lockOwner, this.lockOwner),
                    ),
                ),
            )
            .returning({
                notificationId: notificationOutbox.notificationId,
            });
        return row;
    }

    private async markAsSent(notificationId: string) {
        await this.db.transaction(async (tx) => {
            await tx
                .update(notificationOutbox)
                .set({
                    sent: true,
                    lockedAt: null,
                    lockOwner: null,
                    lastError: null,
                    updatedAt: new Date(),
                })
                .where(eq(notificationOutbox.notificationId, notificationId));
            await tx
                .update(notifications)
                .set({
                    status: 'queued',
                    updatedAt: new Date(),
                })
                .where(eq(notifications.id, notificationId));
        });
    }

    private async releaseLock(notificationId: string, error?: string) {
        await this.db
            .update(notificationOutbox)
            .set({
                lockedAt: null,
                lockOwner: null,
                retryCount: sql`${notificationOutbox.retryCount} + 1`,
                lastError: error ?? null,
                updatedAt: new Date(),
            })
            .where(eq(notificationOutbox.notificationId, notificationId));
    }

    private toStreamRecord(item: PendingNotification): Record<string, string> {
        const payload = item.payload;
        const record: Record<string, string> = {};
        for (const [key, value] of Object.entries(payload)) {
            if (value === undefined || value === null) {
                continue;
            }
            if (typeof value === 'string') {
                record[key] = value;
            } else if (
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                record[key] = String(value);
            } else if (value instanceof Date) {
                record[key] = value.toISOString();
            } else {
                record[key] = JSON.stringify(value);
            }
        }
        if (!record.event && payload['event']) {
            record.event = String(payload['event']);
        }
        if (!record.triggeredAt) {
            record.triggeredAt = new Date().toISOString();
        }
        record.notificationId = item.notificationId;
        return record;
    }
}
