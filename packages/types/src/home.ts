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
        serviceTagId: z.string().max(255).optional().meta({
            title: "服务标签ID",
            description: "可选；用于按服务标签过滤首页推荐",
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

// ==================== Home Search ====================

export const HomeSearchSuggestionsQuerySchema = z
    .object({
        keyword: z.string().trim().min(1).max(64).meta({
            title: "搜索关键词",
            description: "搜索页候选词联想使用的关键词",
        }),
        lat: z.number().min(-90).max(90).optional().meta({
            title: "纬度",
            description: "用户当前搜索位置纬度（可选）",
        }),
        lng: z.number().min(-180).max(180).optional().meta({
            title: "经度",
            description: "用户当前搜索位置经度（可选）",
        }),
        limit: z.number().int().min(1).max(10).default(10).meta({
            title: "返回数量",
            description: "候选词返回上限，第一版限制在 10 条以内",
        }),
    })
    .meta({
        title: "首页搜索候选词查询参数",
        description: "用户端移动搜索页候选词联想查询参数",
    });

export type HomeSearchSuggestionsQuery = z.infer<
    typeof HomeSearchSuggestionsQuerySchema
>;

export const HomeSearchSuggestionItemSchema = z
    .object({
        type: z.enum(["personnel", "service"]).meta({
            title: "候选词类型",
            description: "personnel 表示服务人员，service 表示服务项目",
        }),
        label: z.string().min(1).meta({
            title: "候选词文案",
            description: "候选词展示名称",
        }),
        subtitle: z.string().optional().meta({
            title: "候选词副标题",
            description: "候选词可选补充说明",
        }),
        personnelId: z.string().max(255).optional().meta({
            title: "服务人员 ID",
            description: "当候选词为服务人员时返回",
        }),
        serviceId: z.string().max(255).optional().meta({
            title: "服务项目 ID",
            description: "当候选词为服务项目时返回",
        }),
    })
    .meta({
        title: "首页搜索候选词项",
        description: "移动端搜索页单条候选词数据",
    });

export const HomeSearchSuggestionResponseSchema = z
    .object({
        suggestions: z.array(HomeSearchSuggestionItemSchema),
    })
    .meta({
        title: "首页搜索候选词响应",
        description: "移动端搜索页候选词联想响应数据",
    });

export type HomeSearchSuggestionResponse = z.infer<
    typeof HomeSearchSuggestionResponseSchema
>;

export const HomeSearchQuerySchema = z
    .object({
        keyword: z.string().trim().min(1).max(64).meta({
            title: "搜索关键词",
            description: "结果页确认后的关键词",
        }),
        lat: z.number().min(-90).max(90).optional().meta({
            title: "纬度",
            description: "用户当前搜索位置纬度（可选）",
        }),
        lng: z.number().min(-180).max(180).optional().meta({
            title: "经度",
            description: "用户当前搜索位置经度（可选）",
        }),
        page: z.number().int().min(1).default(1).meta({
            title: "页码",
            description: "结果页分页页码",
        }),
        limit: z.number().int().min(1).max(20).default(20).meta({
            title: "每页数量",
            description: "结果页每页返回数量，第一版上限 20",
        }),
        personnelId: z.string().max(255).optional().meta({
            title: "服务人员 ID",
            description: "点击服务人员候选词进入结果页时透传",
        }),
        serviceId: z.string().max(255).optional().meta({
            title: "服务项目 ID",
            description: "点击服务项目候选词进入结果页时透传",
        }),
    })
    .meta({
        title: "首页搜索结果查询参数",
        description: "用户端移动搜索结果页查询参数",
    });

export type HomeSearchQuery = z.infer<typeof HomeSearchQuerySchema>;

export const HomeSearchPersonnelServicesResponseSchema = z
    .object({
        mode: z.literal("personnel_services"),
        keyword: z.string(),
        matchedPersonnel: z.object({
            id: z.string().max(255),
            name: z.string(),
            avatarUrl: z.string().url().nullable().optional(),
            avatarBlurhash: z.string().nullable().optional(),
        }),
        services: z.array(
            z.object({
                serviceId: z.string().max(255),
                serviceName: z.string(),
                pricingId: z.string().max(255).optional(),
                price: z.number().optional(),
                estimatedDurationMinutes: z.number().int().optional(),
                categoryId: z.string().max(255).optional(),
            }),
        ),
    })
    .meta({
        title: "首页搜索命中服务人员响应",
        description: "唯一命中服务人员姓名时返回该人员可预约服务列表",
    });

export const HomeSearchPersonnelListItemSchema =
    HomeRecommendedPersonnelSchema.extend({
        serviceName: z.string().optional().meta({
            title: "命中服务名称",
            description: "当前列表项匹配到的服务名称",
        }),
    });

export const HomeSearchPersonnelListResponseSchema = z
    .object({
        mode: z.literal("personnel_list"),
        keyword: z.string(),
        serviceHint: z
            .object({
                serviceId: z.string().max(255).optional(),
                serviceName: z.string().optional(),
            })
            .optional(),
        personnel: z.array(HomeSearchPersonnelListItemSchema),
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(20),
        hasMore: z.boolean(),
        nextPage: z.number().int().min(1).nullable(),
    })
    .meta({
        title: "首页搜索服务人员列表响应",
        description: "按服务关键词命中后的服务人员分页列表",
    });

export const HomeSearchResponseSchema = z
    .discriminatedUnion("mode", [
        HomeSearchPersonnelServicesResponseSchema,
        HomeSearchPersonnelListResponseSchema,
    ])
    .meta({
        title: "首页搜索结果响应",
        description: "用户端移动搜索统一结果响应，按 mode 区分渲染分支",
    });

export type HomeSearchResponse = z.infer<typeof HomeSearchResponseSchema>;
