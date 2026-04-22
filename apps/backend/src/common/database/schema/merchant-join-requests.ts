import { boolean, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createId } from '.';

export const merchantJoinRequests = pgTable(
    'merchant_join_requests',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        merchantName: varchar('merchant_name', { length: 50 }).notNull(),
        gender: varchar('gender', { length: 16 }).notNull(),
        phone: varchar('phone', { length: 20 }).notNull(),
        age: integer('age').notNull(),
        intentCity: varchar('intent_city', { length: 255 }).notNull(),
        photoFileId: varchar('photo_file_id', { length: 255 }),
        isContacted: boolean('is_contacted').notNull().default(false),
        adminRemark: text('admin_remark'),
        contactedAt: timestamp('contacted_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        index('idx_merchant_join_requests_created_at').on(table.createdAt.desc()),
        index('idx_merchant_join_requests_contacted_created_at').on(
            table.isContacted,
            table.createdAt.desc(),
        ),
        index('idx_merchant_join_requests_phone').on(table.phone),
    ],
);
