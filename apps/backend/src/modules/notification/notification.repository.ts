import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, isNotNull, lt, sql } from 'drizzle-orm';

import type {
    NotificationChannel as NotificationChannelType,
    NotificationCommand,
    NotificationDeliveryStatus,
    NotificationEventPayload,
    NotificationTargetDescriptor,
    NotificationTargetType,
    NotificationStatus,
} from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    createId,
    notificationDeliveries,
    notificationOutbox,
    notificationTargets,
    notifications,
} from 'src/common/database/schema';
import type { NotificationDeliveries } from '@repo/types';

export type NormalizedNotificationTarget = NotificationTargetDescriptor & {
    targetId: string;
    targetType: NotificationTargetType;
};

export type NotificationTargetRecord = typeof notificationTargets.$inferSelect;
export type NotificationRecord = typeof notifications.$inferSelect;
type NotificationDeliveryRecord = typeof notificationDeliveries.$inferSelect;
export type DeliveryWithRelations = NotificationDeliveryRecord & {
    notification: NotificationRecord | null;
    target: NotificationTargetRecord | null;
};

@Injectable()
export class NotificationRepository {
    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async createNotification(
        command: NotificationCommand<NotificationEventPayload>,
        targets: NormalizedNotificationTarget[],
    ): Promise<{ notificationId: string }> {
        const notificationId = createId();
        const now = new Date();

        const payload: NotificationEventPayload = {
            ...command.payload,
            event: command.payload.event ?? command.event,
            notificationId,
        };
        if (!payload.triggeredAt) {
            payload.triggeredAt = new Date().toISOString();
        }

        await this.db.transaction(async (tx) => {
            await tx.insert(notifications).values({
                id: notificationId,
                event: command.event,
                payload,
                metadata: command.metadata ?? {},
                priority: command.priority ?? 'normal',
                status: 'pending',
                deliveryMode: command.deliveryMode ?? 'best-effort',
                traceLevel: command.traceLevel ?? 'minimal',
                traceContext: command.traceContext ?? {},
                availableAt: command.availableAt ?? null,
                expiresAt: command.expiresAt ?? null,
            });

            if (targets.length) {
                await tx.insert(notificationTargets).values(
                    targets.map((target) => ({
                        id: createId(),
                        notificationId,
                        targetType: target.targetType,
                        targetId: target.targetId,
                        userId: target.userId ?? null,
                        metadata: target.metadata ?? {},
                        channelPlan:
                            target.channelPlan ?? command.fallbackPlan ?? [],
                    })),
                );
            }

            await tx.insert(notificationOutbox).values({
                notificationId,
                retryCount: 0,
                sent: false,
                lockedAt: null,
                lockOwner: null,
                createdAt: now,
                updatedAt: now,
            });
        });

        return { notificationId };
    }

    async getNotificationWithTargets(notificationId: string) {
        return this.db.query.notifications.findFirst({
            where: eq(notifications.id, notificationId),
            with: {
                targets: true,
            },
        });
    }

    async markDispatching(notificationId: string) {
        await this.db
            .update(notifications)
            .set({
                status: 'dispatching',
                updatedAt: new Date(),
            })
            .where(eq(notifications.id, notificationId));
    }

    async updateNotificationStatus(
        notificationId: string,
        status: NotificationStatus,
    ) {
        await this.db
            .update(notifications)
            .set({
                status,
                updatedAt: new Date(),
            })
            .where(eq(notifications.id, notificationId));
    }

    async createDeliveryLog(params: {
        deliveryId: string;
        notificationId: string;
        targetRecordId: string;
        channel: NotificationChannelType;
        attempt: number;
    }) {
        await this.db.insert(notificationDeliveries).values({
            deliveryId: params.deliveryId,
            notificationId: params.notificationId,
            targetId: params.targetRecordId,
            channel: params.channel,
            attempt: params.attempt,
            status: 'pending',
            context: {},
        });
    }

    async updateDeliveryLog(
        deliveryId: string,
        updates: Partial<
            Pick<
                NotificationDeliveries,
                'status' | 'lastError' | 'context' | 'deliveredAt'
            >
        >,
    ) {
        await this.db
            .update(notificationDeliveries)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(eq(notificationDeliveries.deliveryId, deliveryId));
    }

    async getDeliveryWithDetails(deliveryId: string) {
        return this.db.query.notificationDeliveries.findFirst({
            where: eq(notificationDeliveries.deliveryId, deliveryId),
            with: {
                notification: true,
                target: true,
            },
        });
    }

    async findDeliveriesForRetry(params: {
        statuses: NotificationDeliveryStatus[];
        olderThan: Date;
        maxAttempts: number;
        limit: number;
    }): Promise<DeliveryWithRelations[]> {
        return this.db.query.notificationDeliveries.findMany({
            where: and(
                inArray(notificationDeliveries.status, params.statuses),
                lt(notificationDeliveries.updatedAt, params.olderThan),
                lt(notificationDeliveries.attempt, params.maxAttempts),
                sql`COALESCE(${notificationDeliveries.context}->'retry'->>'archived', 'false') = 'false'`,
            ),
            limit: params.limit,
            with: {
                notification: true,
                target: true,
            },
        });
    }

    async findPendingAckDeliveries(params: {
        olderThan: Date;
        maxAttempts: number;
        limit: number;
    }): Promise<DeliveryWithRelations[]> {
        return this.db.query.notificationDeliveries.findMany({
            where: and(
                eq(notificationDeliveries.status, 'sent'),
                isNull(notificationDeliveries.ackAt),
                lt(notificationDeliveries.updatedAt, params.olderThan),
                lt(notificationDeliveries.attempt, params.maxAttempts),
                sql`COALESCE(${notificationDeliveries.context}->'retry'->>'archived', 'false') = 'false'`,
            ),
            limit: params.limit,
            with: {
                notification: true,
                target: true,
            },
        });
    }

    async countPendingOutbox(): Promise<number> {
        const [row] = await this.db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(notificationOutbox)
            .where(eq(notificationOutbox.sent, false));
        return Number(row?.count ?? 0);
    }

    async countDeliveriesByStatus(
        statuses: NotificationDeliveryStatus[],
    ): Promise<number> {
        const [row] = await this.db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(notificationDeliveries)
            .where(inArray(notificationDeliveries.status, statuses));
        return Number(row?.count ?? 0);
    }

    async releaseStaleOutboxLocks(lockTimeoutMs: number): Promise<number> {
        const expiry = new Date(Date.now() - lockTimeoutMs);
        const result = await this.db
            .update(notificationOutbox)
            .set({
                lockedAt: null,
                lockOwner: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(notificationOutbox.sent, false),
                    isNotNull(notificationOutbox.lockedAt),
                    lt(notificationOutbox.lockedAt, expiry),
                ),
            );
        return Number(result.rowCount ?? 0);
    }
}
