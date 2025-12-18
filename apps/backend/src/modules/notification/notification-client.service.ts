import {
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';

import { eq } from 'drizzle-orm';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { notificationDeliveries } from 'src/common/database/schema/notifications';

import type { NotificationAckDto, NotificationHeartbeatDto } from '@repo/types';
import { NotificationPresenceService } from './notification-presence.service';
import { NotificationDeviceService } from './notification-device.service';

type SanitizableValue = string | undefined | null;

interface NormalizedHeartbeat extends NotificationHeartbeatDto {
    deviceId?: string;
    appVersion?: string;
    connectionId?: string;
    registrationId?: string;
    platform?: NotificationHeartbeatDto['platform'];
}

@Injectable()
export class NotificationClientService {
    private readonly logger = new Logger(NotificationClientService.name);

    constructor(
        @Inject(DB)
        private readonly db: DbType,
        private readonly presenceService: NotificationPresenceService,
        private readonly deviceService: NotificationDeviceService,
    ) {}

    async recordHeartbeat(userId: string, dto: NotificationHeartbeatDto) {
        if (!userId) {
            return;
        }
        const normalized = this.normalizeHeartbeat(dto);
        await this.presenceService.recordPresence({
            userId,
            deviceId: normalized.deviceId,
            platform: normalized.platform,
            appVersion: normalized.appVersion,
            connectionId: normalized.connectionId,
            registrationId: normalized.registrationId,
        });
        if (normalized.deviceId || normalized.registrationId) {
            await this.deviceService.saveDeviceInfo(userId, {
                deviceId: normalized.deviceId,
                platform: normalized.platform,
                appVersion: normalized.appVersion,
                connectionId: normalized.connectionId,
                registrationId: normalized.registrationId,
            });
        }
    }

    async markOffline(userId: string, dto: NotificationHeartbeatDto) {
        if (!userId) {
            return;
        }
        const normalized = this.normalizeHeartbeat(dto);
        await this.presenceService.markOffline({
            userId,
            deviceId: normalized.deviceId,
            platform: normalized.platform,
            appVersion: normalized.appVersion,
            connectionId: normalized.connectionId,
            registrationId: normalized.registrationId,
        });
    }

    async ackDelivery(userId: string, dto: NotificationAckDto) {
        const delivery = await this.db.query.notificationDeliveries.findFirst({
            where: eq(notificationDeliveries.deliveryId, dto.deliveryId),
            with: {
                target: true,
            },
        });

        if (!delivery) {
            throw new NotFoundException('未找到对应的投递记录');
        }

        if (delivery.target?.userId && delivery.target.userId !== userId) {
            throw new ForbiddenException('无法确认其它用户的通知');
        }

        await this.db
            .update(notificationDeliveries)
            .set({
                status: 'acknowledged',
                ackAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(notificationDeliveries.deliveryId, dto.deliveryId));
    }

    private normalizeHeartbeat(
        dto: NotificationHeartbeatDto,
    ): NormalizedHeartbeat {
        const normalizeString = (
            value: SanitizableValue,
        ): string | undefined => {
            if (typeof value !== 'string') {
                return undefined;
            }
            const trimmed = value.trim();
            if (!trimmed.length) {
                return undefined;
            }
            const normalized = trimmed.toLowerCase();
            if (normalized === 'undefined' || normalized === 'null') {
                return undefined;
            }
            return trimmed;
        };
        return {
            deviceId: normalizeString(dto.deviceId),
            appVersion: normalizeString(dto.appVersion),
            connectionId: normalizeString(dto.connectionId),
            registrationId: normalizeString(dto.registrationId),
            platform: dto.platform ?? 'unknown',
        };
    }
}
