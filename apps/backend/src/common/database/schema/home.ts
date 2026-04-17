import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { files } from './file';
import { servicePersonnelPricing } from './shops-service';

// 首页 Banner
export const homeBanners = pgTable(
    'home_banners',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        title: varchar('title', { length: 255 }).default('').notNull(),
        imageFileId: varchar('image_file_id', { length: 255 })
            .references(() => files.id, { onDelete: 'set null' })
            .notNull(),
        linkType: varchar('link_type', { length: 20 })
            .default('none')
            .notNull(),
        linkTarget: varchar('link_target', { length: 255 }),
        scene: varchar('scene', { length: 20 }).default('home').notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        index('idx_home_banners_active_sort').on(
            table.isActive,
            table.scene,
            table.sortOrder,
        ),
    ],
);

export const homeBannersRelations = relations(homeBanners, ({ one }) => ({
    image: one(files, {
        fields: [homeBanners.imageFileId],
        references: [files.id],
    }),
}));

// 首页保障
export const homeGuarantees = pgTable(
    'home_guarantees',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        label: varchar('label', { length: 100 }).notNull(),
        iconFileId: varchar('icon_file_id', { length: 255 })
            .references(() => files.id, { onDelete: 'set null' })
            .notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        index('idx_home_guarantees_active_sort').on(
            table.isActive,
            table.sortOrder,
        ),
    ],
);

export const homeGuaranteesRelations = relations(homeGuarantees, ({ one }) => ({
    icon: one(files, {
        fields: [homeGuarantees.iconFileId],
        references: [files.id],
    }),
}));

// 首页特惠位（建议绑定到定价）
export const homePromos = pgTable(
    'home_promos',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        pricingId: varchar('pricing_id', { length: 255 })
            .references(() => servicePersonnelPricing.id, {
                onDelete: 'cascade',
            })
            .notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        overrideTitle: varchar('override_title', { length: 255 }),
        overrideImageFileId: varchar('override_image_file_id', {
            length: 255,
        }).references(() => files.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        index('idx_home_promos_active_sort').on(
            table.isActive,
            table.sortOrder,
        ),
        uniqueIndex('uq_home_promos_pricing').on(table.pricingId),
    ],
);

export const homePromosRelations = relations(homePromos, ({ one }) => ({
    pricing: one(servicePersonnelPricing, {
        fields: [homePromos.pricingId],
        references: [servicePersonnelPricing.id],
    }),
    overrideImage: one(files, {
        fields: [homePromos.overrideImageFileId],
        references: [files.id],
    }),
}));
