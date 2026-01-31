import { z } from "zod/v4";

import {
    HomeBannerLinkTypeEnum,
    HomeBannerSchema,
    HomeGuaranteeSchema,
    HomePromoSchema,
} from "./home";

// 管理端配置：允许 imageUrl/iconUrl 由服务端计算，因此写入时使用 *FileId。

export const AdminHomeBannerUpsertSchema = z
    .object({
        id: z.string().max(255).optional(),
        title: z.string().default(""),
        imageFileId: z.string().max(255),
        linkType: HomeBannerLinkTypeEnum,
        linkTarget: z.string().nullable().default(null),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
        startsAt: z.string().datetime({ offset: true }).nullable().optional(),
        endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .meta({
        title: "管理员-首页 Banner Upsert",
        description: "用于管理端批量更新首页 banner 配置",
    });

export type AdminHomeBannerUpsert = z.infer<typeof AdminHomeBannerUpsertSchema>;

export const AdminHomeGuaranteeUpsertSchema = z
    .object({
        id: z.string().max(255).optional(),
        label: z.string(),
        iconFileId: z.string().max(255),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
    })
    .meta({
        title: "管理员-首页保障 Upsert",
        description: "用于管理端批量更新首页保障配置",
    });

export type AdminHomeGuaranteeUpsert = z.infer<
    typeof AdminHomeGuaranteeUpsertSchema
>;

export const AdminHomePromoUpsertSchema = z
    .object({
        id: z.string().max(255).optional(),
        pricingId: z.string().max(255),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
        overrideTitle: z.string().nullable().optional(),
        overrideImageFileId: z.string().max(255).nullable().optional(),
    })
    .meta({
        title: "管理员-首页特惠位 Upsert",
        description: "用于管理端批量更新首页特惠位配置",
    });

export type AdminHomePromoUpsert = z.infer<typeof AdminHomePromoUpsertSchema>;

export const AdminHomeConfigSchema = z
    .object({
        banners: z.array(HomeBannerSchema),
        guarantees: z.array(HomeGuaranteeSchema),
        promos: z.array(HomePromoSchema),
    })
    .meta({
        title: "管理员-首页配置",
        description: "管理端读取到的首页配置（含可渲染 URL）",
    });

export type AdminHomeConfig = z.infer<typeof AdminHomeConfigSchema>;

export const AdminHomeConfigUpdateSchema = z
    .object({
        banners: z.array(AdminHomeBannerUpsertSchema),
        guarantees: z.array(AdminHomeGuaranteeUpsertSchema),
        promos: z.array(AdminHomePromoUpsertSchema),
    })
    .meta({
        title: "管理员-首页配置更新",
        description: "管理端批量更新首页配置（全量覆盖语义）",
    });

export type AdminHomeConfigUpdate = z.infer<typeof AdminHomeConfigUpdateSchema>;
