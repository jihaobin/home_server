import { z } from "zod/v4";
import { ServiceTagEntrySchema } from "./service-tag";

const MassageLandingPersonnelCardSchema = z
    .object({
        personnelId: z.string().max(255),
        name: z.string(),
        avatarUrl: z.string().url().nullable().default(null),
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
                imageUrl: z.string().url().nullable(),
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
        guaranteeItems: z.array(z.string()),
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
