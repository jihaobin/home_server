import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
    NotificationChannelPlanItem,
    NotificationTargetType,
} from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { notificationPreferences } from 'src/common/database/schema/notifications';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class NotificationPreferenceSeeder implements OnModuleInit {
    private readonly logger = new Logger(NotificationPreferenceSeeder.name);
    private readonly targetType: NotificationTargetType = 'role';
    private readonly targetId = 'service_personnel_default';

    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async onModuleInit() {
        await this.ensureDefaultPreference();
    }

    private async ensureDefaultPreference() {
        const existing = await this.db.query.notificationPreferences.findFirst({
            where: and(
                eq(notificationPreferences.targetType, this.targetType),
                eq(notificationPreferences.targetId, this.targetId),
            ),
        });
        if (existing) {
            return;
        }

        const plan: NotificationChannelPlanItem[] = [
            { channel: 'in_app', when: 'online' },
            { channel: 'tencent_cloud_push' },
            { channel: 'sms' },
        ];

        try {
            await this.db.insert(notificationPreferences).values({
                targetType: this.targetType,
                targetId: this.targetId,
                channelPlan: plan,
                metadata: {},
                version: 1,
            });
            this.logger.log(
                `Seeded default notification preference (${this.targetType}:${this.targetId})`,
            );
        } catch (error) {
            this.logger.warn(
                'Seed notification preference failed',
                error instanceof Error ? error.message : String(error),
            );
        }
    }
}
