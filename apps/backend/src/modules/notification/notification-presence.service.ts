import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import {
    CACHE_SERVICE,
    NotificationRedisKeys,
    type IAdvancedCacheService,
} from 'src/common/cache';

import type { NotificationHeartbeatDto } from '@repo/types';

export interface NotificationPresenceRecord {
    userId: string;
    deviceId?: string;
    platform?: NotificationHeartbeatDto['platform'];
    appVersion?: string;
    connectionId?: string;
    registrationId?: string;
    timestamp?: string;
}

export interface NotificationPresenceDeviceState {
    key: string;
    status: 'online' | 'offline';
    userId: string;
    deviceId?: string;
    platform?: NotificationHeartbeatDto['platform'];
    appVersion?: string;
    connectionId?: string;
    registrationId?: string;
    updatedAt: string;
}

@Injectable()
export class NotificationPresenceService {
    private readonly logger = new Logger(NotificationPresenceService.name);
    private readonly heartbeatTtlSeconds = 45;

    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    async isUserOnline(userId?: string): Promise<boolean> {
        if (!userId) {
            return false;
        }
        const devices = await this.getOnlineDevices(userId);
        return devices.length > 0;
    }

    async getOnlineDevices(
        userId?: string,
    ): Promise<NotificationPresenceDeviceState[]> {
        if (!userId) {
            return [];
        }
        const entries = await this.getDeviceStateMap(userId);
        return Object.values(entries).filter(
            (entry): entry is NotificationPresenceDeviceState =>
                Boolean(entry) && entry.status === 'online',
        );
    }

    async recordPresence(record: NotificationPresenceRecord): Promise<void> {
        await this.setDeviceState(record, 'online');
    }

    async markOffline(record: NotificationPresenceRecord): Promise<void> {
        await this.setDeviceState(record, 'offline');
    }

    async clearPresence(userId?: string): Promise<void> {
        if (!userId) {
            return;
        }
        const key = this.userPresenceKey(userId);
        try {
            await this.cacheService.del(key);
        } catch (error) {
            this.logger.warn(
                '清理在线状态失败',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private async getDeviceStateMap(
        userId: string,
    ): Promise<Record<string, NotificationPresenceDeviceState>> {
        const key = this.userPresenceKey(userId);
        const entries =
            await this.cacheService.hGetAll<
                Record<string, NotificationPresenceDeviceState>
            >(key);
        return entries ?? {};
    }

    private async setDeviceState(
        record: NotificationPresenceRecord,
        status: 'online' | 'offline',
    ): Promise<void> {
        if (!record.userId) {
            return;
        }
        const deviceKey = this.resolveDeviceKey(record);
        if (!deviceKey) {
            this.logger.debug?.(
                '忽略空设备在线状态记录',
                JSON.stringify(record),
            );
            return;
        }
        const key = this.userPresenceKey(record.userId);
        const payload: NotificationPresenceDeviceState = {
            key: deviceKey,
            status,
            userId: record.userId,
            deviceId: record.deviceId,
            platform: record.platform ?? 'unknown',
            appVersion: record.appVersion,
            connectionId: record.connectionId,
            registrationId: record.registrationId,
            updatedAt: record.timestamp ?? new Date().toISOString(),
        };
        try {
            await this.cacheService.hSet(key, deviceKey, payload);
            await this.refreshTtl(key);
        } catch (error) {
            this.logger.warn(
                '写入在线状态失败',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private resolveDeviceKey(
        record: NotificationPresenceRecord,
    ): string | undefined {
        return (
            record.deviceId ??
            record.registrationId ??
            record.connectionId ??
            undefined
        );
    }

    private userPresenceKey(userId: string) {
        return `${NotificationRedisKeys.serviceOnlinePrefix}${userId}`;
    }

    private async refreshTtl(key: string): Promise<void> {
        try {
            const redis = this.cacheService.getClient<Redis>();
            await redis.expire(key, this.heartbeatTtlSeconds);
        } catch (error) {
            this.logger.warn(
                '刷新在线状态 TTL 失败',
                error instanceof Error ? error.message : String(error),
            );
        }
    }
}
