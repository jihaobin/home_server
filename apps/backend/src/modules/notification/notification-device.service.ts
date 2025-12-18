import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { NotificationDeviceInfo } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { users } from 'src/common/database/schema/auth-user';
import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { NotificationRedisKeys } from 'src/common/cache/constants/notification-redis-keys';

interface SaveDeviceInput {
    deviceId?: string;
    platform?: NotificationDeviceInfo['platform'];
    appVersion?: string;
    connectionId?: string;
    registrationId?: string;
}

@Injectable()
export class NotificationDeviceService {
    private readonly logger = new Logger(NotificationDeviceService.name);
    private readonly cacheTtlSeconds = 15 * 60;

    constructor(
        @Inject(DB)
        private readonly db: DbType,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    async saveDeviceInfo(
        userId: string,
        input: SaveDeviceInput,
    ): Promise<void> {
        if (!userId || (!input.deviceId && !input.registrationId)) {
            return;
        }
        const normalized = this.normalizeDevice(input);
        const existing = await this.getDevices(userId);
        const merged = this.mergeDevices(existing, normalized);
        try {
            await this.db
                .update(users)
                .set({
                    devices: merged,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId));
        } catch (error) {
            this.logger.warn(
                `更新用户 ${userId} 设备信息失败`,
                error instanceof Error ? error.message : String(error),
            );
        }
        await this.setCache(userId, merged);
    }

    async getDevices(userId: string): Promise<NotificationDeviceInfo[]> {
        if (!userId) {
            return [];
        }
        const cacheKey = this.deviceCacheKey(userId);
        const cached =
            await this.cacheService.get<NotificationDeviceInfo[]>(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const record = await this.db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
                devices: true,
            },
        });
        const devices = Array.isArray(record?.devices) ? record.devices : [];
        await this.setCache(userId, devices);
        return devices;
    }

    private normalizeDevice(input: SaveDeviceInput): NotificationDeviceInfo {
        return {
            deviceId: input.deviceId ?? undefined,
            platform: input.platform ?? 'unknown',
            appVersion: input.appVersion ?? undefined,
            connectionId: input.connectionId ?? undefined,
            registrationId: input.registrationId ?? undefined,
            updatedAt: new Date().toISOString(),
        };
    }

    private mergeDevices(
        existing: NotificationDeviceInfo[],
        incoming: NotificationDeviceInfo,
    ): NotificationDeviceInfo[] {
        const list = Array.isArray(existing) ? [...existing] : [];
        let replaced = false;
        const merged = list.map((device) => {
            if (!replaced && this.isSameDevice(device, incoming)) {
                replaced = true;
                return { ...device, ...incoming };
            }
            return device;
        });
        if (!replaced) {
            merged.unshift(incoming);
        }
        return merged.slice(0, 5);
    }

    private isSameDevice(
        a: NotificationDeviceInfo,
        b: NotificationDeviceInfo,
    ): boolean {
        if (a.deviceId && b.deviceId && a.deviceId === b.deviceId) {
            return true;
        }
        if (
            a.registrationId &&
            b.registrationId &&
            a.registrationId === b.registrationId
        ) {
            return true;
        }
        return false;
    }

    private async setCache(
        userId: string,
        devices: NotificationDeviceInfo[],
    ): Promise<void> {
        await this.cacheService.set(
            this.deviceCacheKey(userId),
            devices,
            this.cacheTtlSeconds,
        );
    }

    private deviceCacheKey(userId: string) {
        return `${NotificationRedisKeys.serviceDevicePrefix}${userId}`;
    }
}
