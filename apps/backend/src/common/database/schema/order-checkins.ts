import { relations } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    timestamp,
    geometry,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { orderCheckinStatusEnum } from './enums';
import { orders } from './orders';
import { servicePersonnel } from './shops-service';

/**
 * 订单到场核验记录表
 */
export const orderCheckins = pgTable(
    'order_checkins',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        orderId: varchar('order_id', { length: 255 })
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }),
        tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
        status: orderCheckinStatusEnum('status').notNull().default('pending'),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        verifiedAt: timestamp('verified_at', { withTimezone: true }),
        verifiedBy: varchar('verified_by', { length: 255 }).references(
            () => servicePersonnel.userId,
            { onDelete: 'set null' },
        ),
        verifiedGeom: geometry('verified_geom', {
            type: 'point',
            mode: 'tuple',
            srid: 4326,
        }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        index('idx_order_checkins_order_status').on(
            table.orderId,
            table.status,
        ),
        index('idx_order_checkins_expires').on(table.expiresAt),
    ],
);

export const orderCheckinsRelations = relations(orderCheckins, ({ one }) => ({
    order: one(orders, {
        fields: [orderCheckins.orderId],
        references: [orders.id],
    }),
    servicePersonnel: one(servicePersonnel, {
        fields: [orderCheckins.verifiedBy],
        references: [servicePersonnel.userId],
    }),
}));
export type OrderCheckinStatus =
    (typeof orderCheckins.status.enumValues)[number];
