/**
 * Notification schema:
 * 结合 docs/notification-tech-plan.md 的出站流程，将“通知事件 + 目标 + 投递日志 + Outbox + 偏好”
 * 抽象为统一表结构，供 Publisher/Dispatcher/Worker 以及运营后台复用。
 */
import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import {
    notificationChannelEnum,
    notificationDeliveryModeEnum,
    notificationDeliveryStatusEnum,
    notificationPriorityEnum,
    notificationStatusEnum,
    notificationTargetTypeEnum,
    notificationTraceLevelEnum,
} from './enums';
import { NotificationChannelPlanItem } from '@repo/types';

export type NotificationMetadata = Record<string, unknown>;

export const notifications = pgTable(
    'notifications',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        event: varchar('event', { length: 120 }).notNull(),
        payload: jsonb('payload').$type<NotificationMetadata>().notNull(),
        metadata: jsonb('metadata')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        priority: notificationPriorityEnum('priority')
            .notNull()
            .default('normal'),
        status: notificationStatusEnum('status').notNull().default('pending'),
        deliveryMode: notificationDeliveryModeEnum('delivery_mode')
            .notNull()
            .default('best-effort'),
        traceLevel: notificationTraceLevelEnum('trace_level')
            .notNull()
            .default('minimal'),
        traceContext: jsonb('trace_context')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        availableAt: timestamp('available_at', { withTimezone: true }),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('idx_notifications_status_priority').on(
            table.status,
            table.priority,
            table.createdAt.desc(),
        ),
        index('idx_notifications_event_time').on(
            table.event,
            table.createdAt.desc(),
        ),
        index('idx_notifications_available_at')
            .on(table.availableAt)
            .where(sql`available_at IS NOT NULL`),
    ],
);

export const notificationTargets = pgTable(
    'notification_targets',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        notificationId: varchar('notification_id', { length: 255 })
            .notNull()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        targetType: notificationTargetTypeEnum('target_type').notNull(),
        targetId: varchar('target_id', { length: 255 }).notNull(),
        userId: varchar('user_id', { length: 255 }).references(() => users.id, {
            onDelete: 'cascade',
        }),
        metadata: jsonb('metadata')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        channelPlan: jsonb('channel_plan')
            .$type<NotificationChannelPlanItem[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex('notification_target_unique').on(
            table.notificationId,
            table.targetType,
            table.targetId,
        ),
        index('idx_notification_targets_user').on(
            table.userId,
            table.createdAt.desc(),
        ),
    ],
);

export const notificationDeliveries = pgTable(
    'notification_deliveries',
    {
        deliveryId: varchar('delivery_id', { length: 255 }).primaryKey(),
        notificationId: varchar('notification_id', { length: 255 })
            .notNull()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        targetId: varchar('target_id', { length: 255 })
            .notNull()
            .references(() => notificationTargets.id, { onDelete: 'cascade' }),
        channel: notificationChannelEnum('channel').notNull(),
        status: notificationDeliveryStatusEnum('status')
            .notNull()
            .default('pending'),
        attempt: integer('attempt').notNull().default(1),
        lastError: text('last_error'),
        context: jsonb('context')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        deliveredAt: timestamp('delivered_at', { withTimezone: true }),
        ackAt: timestamp('ack_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('idx_notification_deliveries_notification').on(
            table.notificationId,
            table.targetId,
            table.channel,
        ),
        index('idx_notification_deliveries_status').on(
            table.status,
            table.channel,
            table.createdAt.desc(),
        ),
    ],
);

export const notificationVoiceDeliveries = pgTable(
    'notification_voice_deliveries',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        notificationId: varchar('notification_id', { length: 255 })
            .notNull()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        targetId: varchar('target_id', { length: 255 })
            .notNull()
            .references(() => notificationTargets.id, { onDelete: 'cascade' }),
        outId: varchar('out_id', { length: 255 }).notNull(),
        callId: varchar('call_id', { length: 255 }),
        status: notificationDeliveryStatusEnum('status')
            .notNull()
            .default('pending'),
        lastError: text('last_error'),
        providerStatusCode: varchar('provider_status_code', { length: 64 }),
        providerStatusMessage: text('provider_status_message'),
        deliveredAt: timestamp('delivered_at', { withTimezone: true }),
        context: jsonb('context')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex('notification_voice_deliveries_out_id_unique').on(
            table.outId,
        ),
        uniqueIndex('notification_voice_deliveries_call_id_unique').on(
            table.callId,
        ),
        index('idx_notification_voice_deliveries_notification').on(
            table.notificationId,
            table.targetId,
            table.createdAt.desc(),
        ),
        index('idx_notification_voice_deliveries_status').on(
            table.status,
            table.createdAt.desc(),
        ),
    ],
);

export const notificationOutbox = pgTable(
    'notification_outbox',
    {
        notificationId: varchar('notification_id', { length: 255 })
            .primaryKey()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        retryCount: integer('retry_count').notNull().default(0),
        lockedAt: timestamp('locked_at', { withTimezone: true }),
        lockOwner: varchar('lock_owner', { length: 128 }),
        sent: boolean('sent').notNull().default(false),
        lastError: text('last_error'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('idx_notification_outbox_ready')
            .on(table.sent, table.lockedAt, table.createdAt)
            .where(sql`${table.sent} = false`),
    ],
);

export const notificationPreferences = pgTable(
    'notification_preferences',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        targetType: notificationTargetTypeEnum('target_type').notNull(),
        targetId: varchar('target_id', { length: 255 }).notNull(),
        userId: varchar('user_id', { length: 255 }).references(() => users.id, {
            onDelete: 'cascade',
        }),
        channelPlan: jsonb('channel_plan')
            .$type<NotificationChannelPlanItem[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        metadata: jsonb('metadata')
            .$type<NotificationMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        version: integer('version').notNull().default(1),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex('notification_preferences_target_unique').on(
            table.targetType,
            table.targetId,
        ),
    ],
);

export const notificationsRelations = relations(
    notifications,
    ({ many, one }) => ({
        targets: many(notificationTargets),
        deliveries: many(notificationDeliveries),
        voiceDeliveries: many(notificationVoiceDeliveries),
        outboxEntry: one(notificationOutbox, {
            fields: [notifications.id],
            references: [notificationOutbox.notificationId],
        }),
    }),
);

export const notificationTargetsRelations = relations(
    notificationTargets,
    ({ one, many }) => ({
        notification: one(notifications, {
            fields: [notificationTargets.notificationId],
            references: [notifications.id],
        }),
        user: one(users, {
            fields: [notificationTargets.userId],
            references: [users.id],
        }),
        deliveries: many(notificationDeliveries),
        voiceDeliveries: many(notificationVoiceDeliveries),
    }),
);

export const notificationDeliveriesRelations = relations(
    notificationDeliveries,
    ({ one }) => ({
        notification: one(notifications, {
            fields: [notificationDeliveries.notificationId],
            references: [notifications.id],
        }),
        target: one(notificationTargets, {
            fields: [notificationDeliveries.targetId],
            references: [notificationTargets.id],
        }),
    }),
);

export const notificationVoiceDeliveriesRelations = relations(
    notificationVoiceDeliveries,
    ({ one }) => ({
        notification: one(notifications, {
            fields: [notificationVoiceDeliveries.notificationId],
            references: [notifications.id],
        }),
        target: one(notificationTargets, {
            fields: [notificationVoiceDeliveries.targetId],
            references: [notificationTargets.id],
        }),
    }),
);

export const notificationOutboxRelations = relations(
    notificationOutbox,
    ({ one }) => ({
        notification: one(notifications, {
            fields: [notificationOutbox.notificationId],
            references: [notifications.id],
        }),
    }),
);

export const notificationPreferencesRelations = relations(
    notificationPreferences,
    ({ one }) => ({
        user: one(users, {
            fields: [notificationPreferences.userId],
            references: [users.id],
        }),
    }),
);
