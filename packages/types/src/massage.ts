import { z } from "zod/v4";
import { ServiceTagEntrySchema } from "./service-tag";
import { PaginatedDataSchema, PaginationQuerySchema } from "./common";

export const MASSAGE_CATEGORY_ID = "wgla64hwo7zr9iz";

const MerchantJoinRequestGenderSchema = z.enum(["male", "female"]).meta({
    title: "商户加盟申请性别",
    description: "商户加盟申请中的性别枚举",
});

export const CreateMerchantJoinRequestSchema = z
    .object({
        merchantName: z
            .string()
            .trim()
            .min(2, "姓名至少 2 个字符")
            .max(20, "姓名最多 20 个字符")
            .describe("申请人姓名"),
        gender: MerchantJoinRequestGenderSchema.describe("性别"),
        phone: z
            .string()
            .trim()
            .regex(/^1\d{10}$/, "请输入有效的大陆手机号")
            .describe("手机号"),
        age: z.number().int().min(18, "年龄不能小于 18 岁").max(65, "年龄不能大于 65 岁").describe("年龄"),
        intentCity: z
            .string()
            .trim()
            .min(1, "意向合作城市不能为空")
            .max(255, "意向合作城市最多 255 个字符")
            .describe("意向合作城市"),
        photoFileId: z
            .string()
            .trim()
            .max(255)
            .nullable()
            .optional()
            .describe("照片文件标识"),
    })
    .meta({
        title: "创建商户加盟申请请求",
        description: "用户端提交商户加盟申请的请求体",
    });

export type CreateMerchantJoinRequest = z.infer<
    typeof CreateMerchantJoinRequestSchema
>;

export const CreateMerchantJoinRequestResponseSchema = z
    .object({
        id: z.string().max(255).describe("商户加盟申请 ID"),
        createdAt: z.string().datetime({ offset: true }).describe("创建时间"),
    })
    .meta({
        title: "创建商户加盟申请响应",
        description: "用户端提交商户加盟申请后的最小响应",
    });

export type CreateMerchantJoinRequestResponse = z.infer<
    typeof CreateMerchantJoinRequestResponseSchema
>;

const MassageLandingPersonnelCardSchema = z
    .object({
        personnelId: z.string().max(255),
        name: z.string(),
        avatarUrl: z.url().nullable().default(null),
        avatarBlurhash: z.string().nullable().optional(),
        serviceId: z.string().max(255).nullable().default(null),
        pricingId: z.string().max(255).nullable().default(null),
        serviceName: z.string().nullable().default(null),
        ratingValue: z.number(),
        reviewCount: z.number().int().min(0),
        orderCountLabel: z.string().nullable().default(null),
        favoriteCount: z.number().int().min(0),
        distanceText: z.string().nullable().default(null),
        availableTimeText: z.string().nullable().default(null),
    })
    .meta({
        title: "按摩 landing 服务人员卡片",
        description: "按摩频道 landing 页的技师卡片数据",
    });

export type MassageLandingPersonnelCard = z.infer<
    typeof MassageLandingPersonnelCardSchema
>;

export const MassageLandingQuerySchema = z
    .object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        addressText: z.string().max(255).optional(),
    })
    .meta({
        title: "按摩 landing 查询参数",
        description: "按摩频道 landing 页聚合接口查询参数",
    });

export type MassageLandingQuery = z.infer<typeof MassageLandingQuerySchema>;

export const MassageLandingResponseSchema = z
    .object({
        banner: z
            .object({
                title: z.string().nullable(),
                imageUrl: z.url().nullable(),
                imageBlurhash: z.string().nullable().optional(),
                linkType: z.enum(["route", "url", "none"]),
                linkTarget: z.string().nullable().optional(),
            })
            .nullable(),
        tagEntries: z.array(ServiceTagEntrySchema),
        newcomerPersonnel: z.array(MassageLandingPersonnelCardSchema),
        recommendedPersonnel: z.array(MassageLandingPersonnelCardSchema),
    })
    .meta({
        title: "按摩 landing 响应",
        description: "按摩频道 landing 页聚合数据",
    });

export type MassageLandingResponse = z.infer<
    typeof MassageLandingResponseSchema
>;

export const MassagePersonnelDetailQuerySchema = z
    .object({
        serviceId: z.string().max(255).optional(),
        pricingId: z.string().max(255).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
    })
    .meta({
        title: "按摩详情查询参数",
        description: "按摩技师详情页查询参数",
    });

export type MassagePersonnelDetailQuery = z.infer<
    typeof MassagePersonnelDetailQuerySchema
>;

export const MassagePersonnelDetailResponseSchema = z
    .object({
        personnelId: z.string().max(255),
        personnelName: z.string(),
        avatarUrl: z.string().url().nullable().default(null),
        avatarBlurhash: z.string().nullable().optional(),
        galleryImages: z.array(
            z.object({
                url: z.string().url(),
                blurhash: z.string().nullable().optional(),
            }),
        ),
        addressText: z.string(),
        distanceText: z.string().nullable().default(null),
        availableTimeText: z.string().nullable().default(null),
        yearlyOrderCount: z.number().int().min(0),
        favoriteCount: z.number().int().min(0),
        isFavorited: z.boolean(),
        description: z.string().nullable().default(null),
        stats: z.object({
            yearsOfExperience: z.number().int().min(0),
            averageServiceQuality: z.number().nullable().default(null),
            repurchaseRate: z.number().nullable().default(null),
            goodRatePercentage: z.number().int().min(0).max(100),
        }),
        reviewSummary: z.object({
            averageRating: z.number(),
            totalReviews: z.number().int().min(0),
            averageAttitude: z.number().nullable().default(null),
            averageSkill: z.number().nullable().default(null),
            customerSatisfactionRate: z.number().int().min(0).max(100),
        }),
        services: z.array(
            z.object({
                serviceId: z.string().max(255),
                serviceName: z.string(),
                pricingId: z.string().max(255).nullable().default(null),
                tags: z.array(z.string()),
                durationMinutes: z.number().int().nullable().default(null),
                price: z.number().nullable().default(null),
                originalPrice: z.number().nullable().default(null),
                imageUrl: z.string().url().nullable().default(null),
                imageBlurhash: z.string().nullable().optional(),
                actionLabel: z.string(),
                highlightLabel: z.string().nullable().optional(),
            }),
        ),
        topReviews: z.array(
            z.object({
                id: z.string().max(255),
                rating: z.number(),
                ratingLabel: z.string().nullable().default(null),
                comment: z.string(),
                reviewerName: z.string().nullable().default(null),
                createdAt: z.string(),
                images: z.array(
                    z.object({
                        url: z.string().url(),
                        blurhash: z.string().nullable().optional(),
                    }),
                ),
            }),
        ),
    })
    .meta({
        title: "按摩技师详情响应",
        description: "按摩频道技师详情页真实数据",
    });

export type MassagePersonnelDetailResponse = z.infer<
    typeof MassagePersonnelDetailResponseSchema
>;
