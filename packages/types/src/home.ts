import { z } from "zod/v4";

import { ServiceCategoryTree, serviceCategoriesSchema } from "./service";
import { ServicesSchema } from "./database-entity";

// ==================== Home Query ====================

export const HomeQuerySchema = z
    .object({
        page: z.number().int().min(1).default(1).meta({
            title: "页码",
            description: "分页页码，从 1 开始",
        }),
        categoryId: z.string().max(255).optional().meta({
            title: "分类ID",
            description:
                "可选；用于按服务分类过滤首页推荐（分类筛选页的‘推荐’Tab）",
        }),
        lat: z.number().min(-90).max(90).optional().meta({
            title: "纬度",
            description:
                "用户选择的地址纬度（可选；不传则后端不按位置过滤，返回全量推荐）",
        }),
        lng: z.number().min(-180).max(180).optional().meta({
            title: "经度",
            description:
                "用户选择的地址经度（可选；不传则后端不按位置过滤，返回全量推荐）",
        }),
        addressText: z.string().max(255).optional().meta({
            title: "地址文本",
            description: "用户选择的地址展示文案（可选，用于日志/埋点/调试）",
        }),
        maxDistanceKm: z.number().min(0).max(100).default(10).meta({
            title: "最大距离(km)",
            description: "推荐服务人员的最大搜索半径，默认 10km",
        }),
        limit: z.number().int().min(1).max(50).default(20).meta({
            title: "返回数量",
            description: "推荐服务人员列表返回数量，默认 20",
        }),
    })
    .meta({
        title: "首页查询参数",
        description: "用户端首页聚合接口查询参数",
    });

export type HomeQuery = z.infer<typeof HomeQuerySchema>;

// ==================== Home Ops Config ====================

export const HomeBannerLinkTypeEnum = z
    .enum(["service", "personnel", "url", "none"])
    .meta({
        title: "Banner 跳转类型",
        description: "service/personnel/url/none",
    });

export type HomeBannerLinkType = z.infer<typeof HomeBannerLinkTypeEnum>;

export const HomeBannerSchema = z
    .object({
        id: z.string().max(255),
        title: z.string().default(""),
        imageUrl: z.string().url(),
        imageBlurhash: z.string().min(1).nullable().optional().meta({
            title: "Banner 图片 BlurHash",
            description:
                "配合 expo-image placeholder 使用；为空表示暂无 blurhash。",
        }),
        linkType: HomeBannerLinkTypeEnum,
        linkTarget: z.string().nullable().default(null),
        sortOrder: z.number().int().default(0),
    })
    .meta({
        title: "首页 Banner",
        description: "首页顶部 banner 运营位",
    });

export type HomeBanner = z.infer<typeof HomeBannerSchema>;

export const HomeGuaranteeSchema = z
    .object({
        id: z.string().max(255),
        label: z.string(),
        iconUrl: z.string().url(),
        iconBlurhash: z.string().min(1).nullable().optional().meta({
            title: "保障项图标 BlurHash",
            description:
                "配合 expo-image placeholder 使用；为空表示暂无 blurhash。",
        }),
        sortOrder: z.number().int().default(0),
    })
    .meta({
        title: "首页保障项",
        description: "首页保障文案/图标项",
    });

export type HomeGuarantee = z.infer<typeof HomeGuaranteeSchema>;

export const HomePromoSchema = z
    .object({
        id: z.string().max(255),
        pricingId: z.string().max(255),
        sortOrder: z.number().int().default(0),
        personnelId: z.string().max(255),
        personnelName: z.string(),
        tag: z.string(),
        price: z.number(),
        currency: z.string().min(1).max(3).default("CNY"),
        imageUrl: z.string().url().nullable().default(null),
        imageBlurhash: z.string().min(1).nullable().optional().meta({
            title: "特惠位图片 BlurHash",
            description:
                "配合 expo-image placeholder 使用；为空表示暂无 blurhash。",
        }),
    })
    .meta({
        title: "首页特惠位",
        description: "首页特惠运营位，推荐绑定到定价",
    });

export type HomePromo = z.infer<typeof HomePromoSchema>;

// ==================== Home Recommendation ====================

export const HomeRecommendedPersonnelSchema = z
    .object({
        personnelId: z.string().max(255),
        name: z.string(),
        avatarUrl: z.string().url().nullable().default(null),
        avatarBlurhash: z.string().min(1).nullable().optional().meta({
            title: "服务人员头像 BlurHash",
            description:
                "配合 expo-image placeholder 使用；为空表示暂无 blurhash。",
        }),
        tag: z.string(),
        minPrice: z.number(),
        serviceId: z.string().max(255).optional().meta({
            title: "默认服务ID",
            description:
                "推荐卡片对应的默认服务ID（与 tag/minPrice 来自同一条最低起价定价记录）",
        }),
        pricingId: z.string().max(255).optional().meta({
            title: "最低起价定价ID",
            description: "推荐卡片最低起价对应的定价记录ID（可选）",
        }),
        distanceKm: z.number(),
        addressText: z.string(),
        workDays: z.string(),
        workStartTime: z.string(),
        workEndTime: z.string(),
        ratingValue: z.number(),
        goodRatePercentage: z.number().int().min(0).max(100),
        reviewCount: z.number().int().min(0),
    })
    .meta({
        title: "首页推荐服务人员",
        description:
            "基于用户选择的地址（或默认地址兜底）的推荐服务人员卡片数据",
    });

export type HomeRecommendedPersonnel = z.infer<
    typeof HomeRecommendedPersonnelSchema
>;

export const HomeResponseSchema = z
    .object({
        banners: z.array(HomeBannerSchema),
        guarantees: z.array(HomeGuaranteeSchema),
        promos: z.array(HomePromoSchema),
        categories: z.array(serviceCategoriesSchema) as unknown as z.ZodType<
            ServiceCategoryTree[]
        >,
        recommendedPersonnel: z.array(HomeRecommendedPersonnelSchema),
    })
    .meta({
        title: "首页聚合响应",
        description: "用户端首页聚合接口响应数据",
    });

export type HomeResponse = z.infer<typeof HomeResponseSchema>;

// ==================== Home Split Responses ====================

export const HomeBaseResponseSchema = z
    .object({
        banners: z.array(HomeBannerSchema),
        guarantees: z.array(HomeGuaranteeSchema),
        promos: z.array(HomePromoSchema),
        categories: z.array(serviceCategoriesSchema) as unknown as z.ZodType<
            ServiceCategoryTree[]
        >,
    })
    .meta({
        title: "首页基础响应",
        description: "用户端首页基础接口响应数据（不包含推荐列表）",
    });

export type HomeBaseResponse = z.infer<typeof HomeBaseResponseSchema>;

export const HomeRecommendationsResponseSchema = z
    .object({
        recommendedPersonnel: z.array(HomeRecommendedPersonnelSchema),
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(50),
        hasMore: z.boolean(),
        nextPage: z.number().int().min(1).nullable().default(null),
    })
    .meta({
        title: "首页推荐响应",
        description: "用户端首页推荐列表接口响应数据",
    });

export type HomeRecommendationsResponse = z.infer<
    typeof HomeRecommendationsResponseSchema
>;
