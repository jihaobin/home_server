import z from "zod/v4";

import {
    PaginationMetaSchema,
    PaginationQuerySchema,
} from "./common";
import {
    ReviewTargetTypeEnum,
    ReviewsSchema,
} from "./database-entity";

const ratingSchema = z
    .number()
    .int()
    .min(1, "评分不能低于1分")
    .max(5, "评分不能超过5分")
    .meta({
        title: "评分",
        description: "评分需要在 1 至 5 之间",
    });

const optionalSubRatingSchema = z
    .number()
    .int()
    .min(1, "评分不能低于1分")
    .max(5, "评分不能超过5分")
    .optional();

const imageIdSchema = z
    .string()
    .trim()
    .max(255, "文件ID长度不能超过255个字符")
    .meta({
        title: "文件ID",
        description: "上传文件在文件服务中的唯一ID",
    });

export const CreateReviewBodySchema = z
    .object({
        orderId: z
            .string()
            .min(1, "订单ID不能为空")
            .max(255, "订单ID长度不能超过255个字符")
            .meta({
                title: "订单ID",
                description: "关联的订单ID",
            }),
        targetId: z
            .string()
            .min(1, "被评价对象ID不能为空")
            .max(255, "被评价对象ID长度不能超过255个字符")
            .meta({
                title: "被评价对象ID",
                description: "被评价的服务人员或店铺ID",
            }),
        targetType: ReviewTargetTypeEnum,
        rating: ratingSchema,
        serviceQuality: optionalSubRatingSchema,
        attitude: optionalSubRatingSchema,
        punctuality: optionalSubRatingSchema,
        comment: z
            .string()
            .trim()
            .max(1000, "评价内容最多支持1000个字符")
            .optional()
            .meta({
                title: "评价内容",
                description: "评价文字内容",
            }),
        isAnonymous: z
            .boolean()
            .optional()
            .default(false)
            .meta({
                title: "是否匿名",
                description: "是否匿名展示评价者信息",
            }),
        imageIds: z
            .array(imageIdSchema)
            .max(6, "最多支持上传6张评价图片")
            .optional()
            .default([])
            .meta({
                title: "评价图片列表",
                description: "关联的评价图片文件ID列表",
            }),
    })
    .meta({
        title: "创建评价请求体",
        description: "提交评价信息时的请求体结构",
    });

export type CreateReviewBody = z.infer<typeof CreateReviewBodySchema>;

export const CreateReviewResponseSchema = ReviewsSchema;
export type CreateReviewResponse = z.infer<typeof CreateReviewResponseSchema>;

const { page: basePageSchema, limit: baseLimitSchema } =
    PaginationQuerySchema.shape;

export const ReviewerTargetsQuerySchema = z
    .object({
        page: basePageSchema.default(1),
        limit: baseLimitSchema.default(10),
        targetType: ReviewTargetTypeEnum.optional().meta({
            title: "评价对象类型",
            description: "可选的评价对象类型过滤",
        }),
    })
    .meta({
    title: "用户已评价对象查询参数",
    description: "查询当前用户已评价的对象列表请求参数",
});

export type ReviewerTargetsQuery = z.infer<typeof ReviewerTargetsQuerySchema>;

const ReviewImageSchema = z
    .object({
        url: z
            .string()
            .meta({
                title: "图片URL",
                description: "图片的访问URL（预签名URL）",
            }),
        blurhash: z
            .string()
            .optional()
            .meta({
                title: "BlurHash",
                description: "图片的BlurHash，用于占位符显示",
            }),
    })
    .meta({
        title: "评价图片信息",
        description: "评价图片的访问信息",
    });

export const ReviewerTargetItemSchema = z
    .object({
        targetId: z
            .string()
            .max(255)
            .meta({
                title: "被评价对象ID",
                description: "服务人员或店铺的唯一标识",
            }),
        targetType: ReviewTargetTypeEnum,
        orderId: z
            .string()
            .max(255)
            .meta({
                title: "订单ID",
                description: "关联的订单ID",
            }),
        latestReviewAt: z
            .date()
            .meta({
                title: "最近评价时间",
                description: "最近一次评价时间",
            }),
        reviewCount: z
            .number()
            .int()
            .min(1)
            .meta({
                title: "评价次数",
                description: "针对该对象的评价次数",
            }),
        averageRating: z
            .number()
            .meta({
                title: "平均评分",
                description: "该对象的平均评分",
            }),
        comment: z
            .string()
            .meta({
                title: "评价内容",
                description: "评价文字内容",
            }),
        images: z
            .array(ReviewImageSchema)
            .meta({
                title: "评价图片列表",
                description: "该评价的所有图片信息",
            }),
    })
    .meta({
        title: "用户已评价对象信息",
        description: "用户对同一对象的评价概览",
    });

export type ReviewerTargetItem = z.infer<typeof ReviewerTargetItemSchema>;

export const ReviewerTargetsResponseSchema = z
    .object({
        items: z.array(ReviewerTargetItemSchema),
        meta: PaginationMetaSchema,
    })
    .meta({
        title: "用户已评价对象响应",
        description: "用户已评价对象列表响应数据",
    });

export type ReviewerTargetsResponse = z.infer<
    typeof ReviewerTargetsResponseSchema
>;

export const ReviewerTargetWithReviewSchema = z
    .object({
        target: ReviewerTargetItemSchema,
        reviews: z.array(ReviewsSchema),
    })
    .meta({
        title: "用户评价详情",
        description: "针对某个对象的评价详情列表",
    });

export type ReviewerTargetWithReview = z.infer<
    typeof ReviewerTargetWithReviewSchema
>;

export const TargetReviewsQuerySchema = z
    .object({
        page: basePageSchema.default(1),
        limit: baseLimitSchema.default(10),
        serviceId: z
            .string()
            .max(255, "服务ID长度不能超过255个字符")
            .optional()
            .meta({
                title: "服务ID",
                description: "可选的服务ID过滤，用于查询服务人员提供某个具体服务的评价",
            }),
    })
    .meta({
        title: "目标对象评价查询参数",
        description: "查询服务人员或店铺的评价列表请求参数",
    });

export type TargetReviewsQuery = z.infer<typeof TargetReviewsQuerySchema>;

export const TargetReviewsResponseSchema = z
    .object({
        items: z.array(z.object({ ...ReviewsSchema.shape, images:z
            .array(ReviewImageSchema)
            .meta({
                title: "评价图片列表",
                description: "该评价的所有图片信息",
            }), })),
        total: z.number().int().min(0),
        page: z.number().int().min(1),
        limit: z.number().int().min(1),
    })
    .meta({
        title: "目标对象评价列表响应",
        description: "服务人员或店铺的评价列表响应数据",
    });

export type TargetReviewsResponse = z.infer<typeof TargetReviewsResponseSchema>;

export const ReviewStatsSchema = z
    .object({
        targetId: z.string().max(255).meta({
            title: "被评价对象ID",
            description: "服务人员或店铺的唯一标识",
        }),
        targetType: ReviewTargetTypeEnum,
        serviceId: z
            .string()
            .max(255)
            .nullable()
            .meta({
                title: "服务ID",
                description: "服务ID，NULL表示全部服务的统计",
            }),
        totalCount: z.number().int().min(0).meta({
            title: "总评价数",
            description: "总评价数量",
        }),
        goodCount: z.number().int().min(0).meta({
            title: "好评数",
            description: "好评数量（4-5星）",
        }),
        neutralCount: z.number().int().min(0).meta({
            title: "中评数",
            description: "中评数量（3星）",
        }),
        badCount: z.number().int().min(0).meta({
            title: "差评数",
            description: "差评数量（1-2星）",
        }),
        averageRating: z.number().int().min(0).meta({
            title: "平均评分",
            description: "平均评分*100（如450表示4.50星）",
        }),
        averageRatingDisplay: z.string().meta({
            title: "平均评分显示",
            description: "格式化后的平均评分（如4.50）",
        }),
        averageServiceQuality: z
            .number()
            .int()
            .min(0)
            .nullable()
            .optional()
            .meta({
                title: "平均服务质量评分",
                description: "平均服务质量评分*100",
            }),
        averageAttitude: z
            .number()
            .int()
            .min(0)
            .nullable()
            .optional()
            .meta({
                title: "平均态度评分",
                description: "平均态度评分*100",
            }),
        averagePunctuality: z
            .number()
            .int()
            .min(0)
            .nullable()
            .optional()
            .meta({
                title: "平均准时性评分",
                description: "平均准时性评分*100",
            }),
        goodRatePercentage: z.number().int().min(0).max(100).meta({
            title: "好评率",
            description: "好评率百分比（0-100）",
        }),
        lastReviewAt: z.date().nullable().optional().meta({
            title: "最后评价时间",
            description: "最后一次评价的时间",
        }),
    })
    .meta({
        title: "评价统计信息",
        description: "评价的统计数据",
    });

export type ReviewStats = z.infer<typeof ReviewStatsSchema>;