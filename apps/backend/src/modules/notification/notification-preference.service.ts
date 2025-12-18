import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
    NotificationChannelPlanItem,
    NotificationTargetType,
} from '@repo/types';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    notificationPreferences,
    type notificationTargets,
} from 'src/common/database/schema/notifications';
import { and, eq } from 'drizzle-orm';

import {
    DEFAULT_NOTIFICATION_CHANNEL_PLAN,
    isNotificationChannelType,
} from './notification.constants';

type NotificationTargetRecord = typeof notificationTargets.$inferSelect;

interface CachedPlan {
    plan: NotificationChannelPlanItem[];
    expiresAt: number;
}

@Injectable()
export class NotificationPreferenceService {
    private readonly logger = new Logger(NotificationPreferenceService.name);
    private readonly cache = new Map<string, CachedPlan>();
    private readonly ttlMs = 10 * 60 * 1000;

    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async resolvePlan(
        target: NotificationTargetRecord,
    ): Promise<NotificationChannelPlanItem[]> {
        const cacheKey = this.getCacheKey(target);
        if (cacheKey) {
            const cached = this.cache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return this.clonePlan(cached.plan);
            }
        }

        let plan: NotificationChannelPlanItem[] = [];
        if (target.targetType && target.targetId) {
            plan = await this.fetchPreferencePlan(
                target.targetType,
                target.targetId,
            );
        }

        if (!plan.length) {
            plan = this.extractPlan(target.channelPlan);
        }

        if (!plan.length) {
            plan = [...DEFAULT_NOTIFICATION_CHANNEL_PLAN];
        }

        const normalized = this.clonePlan(plan);
        if (cacheKey) {
            this.cache.set(cacheKey, {
                plan: this.clonePlan(normalized),
                expiresAt: Date.now() + this.ttlMs,
            });
        }

        return normalized;
    }

    private async fetchPreferencePlan(
        targetType: NotificationTargetType,
        targetId: string,
    ): Promise<NotificationChannelPlanItem[]> {
        try {
            const preference =
                await this.db.query.notificationPreferences.findFirst({
                    where: and(
                        eq(notificationPreferences.targetType, targetType),
                        eq(notificationPreferences.targetId, targetId),
                    ),
                });
            if (preference?.channelPlan?.length) {
                return this.extractPlan(preference.channelPlan);
            }
        } catch (error) {
            this.logger.warn(
                '读取通知偏好失败',
                error instanceof Error ? error.message : String(error),
            );
        }
        return [];
    }

    private extractPlan(plan?: unknown): NotificationChannelPlanItem[] {
        if (!Array.isArray(plan)) {
            return [];
        }
        const resolved: NotificationChannelPlanItem[] = [];
        for (const item of plan) {
            const normalized = this.normalizePlanItem(
                item as NotificationChannelPlanItem | undefined,
            );
            if (normalized) {
                resolved.push(normalized);
            }
        }
        return resolved;
    }

    private getCacheKey(target: NotificationTargetRecord): string | null {
        if (!target.targetType || !target.targetId) {
            return null;
        }
        return `${target.targetType}:${target.targetId}`;
    }

    private normalizePlanItem(
        item?: NotificationChannelPlanItem,
    ): NotificationChannelPlanItem | null {
        if (!item?.channel || !isNotificationChannelType(item.channel)) {
            return null;
        }
        const normalized: NotificationChannelPlanItem = {
            channel: item.channel,
        };
        if (item.when && ['online', 'offline', 'always'].includes(item.when)) {
            normalized.when = item.when;
        }
        if (
            typeof item.fallbackAfterMs === 'number' &&
            Number.isFinite(item.fallbackAfterMs) &&
            item.fallbackAfterMs >= 0
        ) {
            normalized.fallbackAfterMs = item.fallbackAfterMs;
        }
        if (
            item.metadata &&
            typeof item.metadata === 'object' &&
            !Array.isArray(item.metadata)
        ) {
            normalized.metadata = { ...item.metadata };
        }
        return normalized;
    }

    private clonePlan(
        plan: NotificationChannelPlanItem[],
    ): NotificationChannelPlanItem[] {
        return plan.map((item) => ({
            ...item,
            metadata: item.metadata ? { ...item.metadata } : undefined,
        }));
    }
}
