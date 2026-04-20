import { z } from "zod/v4";

export const PersonnelFavoriteSummaryResponseSchema = z
    .object({
        personnelId: z.string().max(255),
        favoriteCount: z.number().int().min(0),
        isFavorited: z.boolean(),
    })
    .meta({
        title: "服务人员收藏读态",
        description: "全局服务人员收藏汇总读接口响应",
    });

export type PersonnelFavoriteSummaryResponse = z.infer<
    typeof PersonnelFavoriteSummaryResponseSchema
>;

export const PersonnelFavoriteMutationResponseSchema = z
    .object({
        personnelId: z.string().max(255),
        favoriteCount: z.number().int().min(0),
        isFavorited: z.boolean(),
    })
    .meta({
        title: "服务人员收藏写接口响应",
        description: "全局服务人员收藏/取消收藏写接口响应",
    });

export const ListFavoritePersonnelQuerySchema = z
    .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
    })
    .meta({
        title: "收藏服务人员列表查询参数",
        description: "查询当前用户收藏服务人员列表的分页参数",
    });

export const FavoritePersonnelListItemSchema = z
    .object({
        personnelId: z.string().max(255),
        personnelName: z.string().max(255),
        avatarUrl: z.url().nullable(),
        avatarBlurhash: z.string().nullable(),
        addressText: z.string().max(255),
        distanceText: z.string().nullable(),
        availableTimeText: z.string().nullable(),
        favoriteCount: z.number().int().min(0),
        reviewCount: z.number().int().min(0),
        ratingValue: z.number().min(0),
        yearlyOrderCount: z.number().int().min(0),
        primaryServiceId: z.string().max(255).nullable(),
        primaryPricingId: z.string().max(255).nullable(),
        primaryServiceName: z.string().max(255).nullable(),
        favoritedAt: z.iso.datetime({ offset: true, local: true }).nullable(),
    })
    .meta({
        title: "收藏服务人员列表项",
        description: "收藏服务人员列表单项数据结构",
    });

export const FavoritePersonnelListResponseSchema = z
    .object({
        items: z.array(FavoritePersonnelListItemSchema),
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        hasMore: z.boolean(),
    })
    .meta({
        title: "收藏服务人员列表响应",
        description: "收藏服务人员分页列表查询响应",
    });

export type PersonnelFavoriteMutationResponse = z.infer<
    typeof PersonnelFavoriteMutationResponseSchema
>;

export type ListFavoritePersonnelQuery = z.infer<
    typeof ListFavoritePersonnelQuerySchema
>;

export type FavoritePersonnelListItem = z.infer<
    typeof FavoritePersonnelListItemSchema
>;

export type FavoritePersonnelListResponse = z.infer<
    typeof FavoritePersonnelListResponseSchema
>;
