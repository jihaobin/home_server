import { z } from "zod/v4";
import {
	ServicePersonnelPricingSchema,
	ServicePersonnelSchema,
	ServicesSchema,
} from "./database-entity";

// ==================== Work Skill 相关 Zod Schema ====================

// 更新工作人员信息请求 Schema（不包含 userId，由认证中间件提供）
const WorkInfoBaseShape = ServicePersonnelSchema.omit({
	userId: true,
	geom: true,
}).shape;

const { lastActiveAt, ...workInfoWithoutLastActive } = WorkInfoBaseShape;

export const UpsertWorkInfoRequestSchema = z.object({
	...workInfoWithoutLastActive,
	lastActiveAt: z
		.preprocess((value) => {
			if (value === undefined || value === null) {
				return undefined;
			}
			if (value instanceof Date) {
				return value;
			}
			const parsed = new Date(value as any);
			return Number.isNaN(parsed.getTime()) ? undefined : parsed;
		}, z.date())
		.optional(),
	location: z.object({
		lng: z
			.number()
			.describe("经度")
			.max(180, "经度不能大于180")
			.min(-180, "经度不能小于-180"),
		lat: z
			.number()
			.describe("纬度")
			.max(90, "纬度不能大于90")
			.min(-90, "纬度不能小于-90"),
	}),
});

// 更新工作人员技能请求 Schema
export const UpdatePersonnelSkillsRequestSchema = z
	.object({
		serviceIds: z.array(z.string().min(1, "服务ID不能为空")).meta({
			description: "服务ID数组，传入空数组将清除该工作人员的所有技能",
			title: "服务ID数组",
		}),
	})
	.meta({
		title: "更新工作人员技能请求",
		description: "更新工作人员技能的请求参数",
	});

// 获取工作人员信息请求 Schema
export const GetPersonnelInfoRequestSchema = z
	.object({
		personnelId: z.string().min(1, "工作人员ID不能为空").meta({
			description: "工作人员用户ID",
			title: "工作人员ID",
		}),
	})
	.meta({
		title: "获取工作人员信息请求",
		description: "获取工作人员信息的请求参数",
	});

// 技能更新结果 Schema
export const SkillUpdateResultSchema = z
	.object({
		added: z.number().int().min(0).meta({
			description: "新增的技能数量",
			title: "新增数量",
		}),
		removed: z.number().int().min(0).meta({
			description: "删除的技能数量",
			title: "删除数量",
		}),
	})
	.meta({
		title: "技能更新结果",
		description: "技能更新操作的统计结果",
	});

// 工作人员技能信息 Schema
export const PersonnelSkillSchema = z
	.object({
		...ServicesSchema.omit({ categoryId: true }).shape,
		category: z.string().meta({
			description: "服务类别",
			title: "服务类别",
		}),
	})
	.meta({
		title: "工作人员技能信息",
		description: "工作人员掌握的技能和服务信息",
	});

// 工作人员详细信息 Schema（包含技能列表）
export const PersonnelDetailInfoSchema = z
	.object({
		...ServicePersonnelSchema.shape,
		skills: z.array(PersonnelSkillSchema).meta({
			description: "工作人员技能列表",
			title: "技能列表",
		}),
	})
	.meta({
		title: "工作人员详细信息",
		description: "包含技能信息的工作人员详细信息",
	});

// ==================== 定价管理相关 Schema ====================

// 设置服务人员定价请求 Schema
export const UpsertPersonnelPricingRequestSchema = z
	.object({
		serviceId: z.string().min(1, "服务ID不能为空").meta({
			description: "服务ID",
			title: "服务ID",
		}),
		price: z
			.string()
			.regex(/^\d+(\.\d{1,2})?$/, "价格格式不正确")
			.meta({
				description: "个人定价（字符串格式）",
				title: "个人定价",
			}),
        estimatedDurationMinutes: z.number().int().positive().meta({
            description: "预计服务时长（分钟）",
            title: "预计服务时长",
        }),
		currency: z.string().max(3).default("CNY").meta({
			description: "币种代码",
			title: "币种代码",
		}),
	})
	.meta({
		title: "设置服务人员定价请求",
		description: "设置或更新服务人员个人定价的请求参数",
	});

// 删除服务人员定价请求 Schema
export const RemovePersonnelPricingRequestSchema = z
	.object({
		serviceId: z.string().min(1, "服务ID不能为空").meta({
			description: "服务ID",
			title: "服务ID",
		}),
	})
	.meta({
		title: "删除服务人员定价请求",
		description: "删除服务人员个人定价的请求参数",
	});

// 服务人员定价信息 Schema
export const PersonnelPricingInfoSchema = ServicePersonnelPricingSchema.omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
}).meta({
	title: "服务人员定价信息",
	description: "服务人员的个人定价信息",
});

// ==================== 服务人员筛选相关 Schema ====================

// 服务人员筛选请求 Schema - 包含所有必要的筛选条件
export const ServicePersonnelFilterRequestSchema = z
	.object({
		// 必选参数
		serviceId: z.string().min(1, "服务类型ID不能为空").meta({
			description: "用户需要的服务类型ID",
			title: "服务类型ID",
		}),
		userLat: z.number().min(-90).max(90).meta({
			description: "用户纬度 (-90 到 90)",
			title: "用户纬度",
		}),
		userLng: z.number().min(-180).max(180).meta({
			description: "用户经度 (-180 到 180)",
			title: "用户经度",
		}),

		// 可选参数
		minPrice: z.number().min(0).optional().meta({
			description: "最低价格（元）",
			title: "最低价格",
		}),
		maxPrice: z.number().min(0).optional().meta({
			description: "最高价格（元）",
			title: "最高价格",
		}),
		maxDistance: z.number().min(0).max(100).default(10).meta({
			description: "最大距离（公里，默认10公里）",
			title: "最大距离",
		}),
		minYearsOfExperience: z.number().int().min(0).optional().meta({
			description: "最少从业年限",
			title: "最少从业年限",
		}),
		needServiceTime: z.date().optional().meta({
			description: "需要服务时间（格式：YYYY-MM-DD HH:mm）",
			title: "需要服务时间",
		}),

		// 分页参数
		page: z.number().int().min(1).default(1).meta({
			description: "页码（从1开始）",
			title: "页码",
		}),
		pageSize: z.number().int().min(1).max(100).default(20).meta({
			description: "每页条数（1-100）",
			title: "每页条数",
		}),

		// 排序参数
		sortBy: z
			.enum(["distance", "price", "experience", "rating"])
			.default("distance")
			.meta({
				description:
					"排序方式：distance(距离), price(价格), experience(经验), rating(评分)",
				title: "排序方式",
			}),
		sortOrder: z.enum(["asc", "desc"]).default("asc").meta({
			description: "排序顺序：asc(升序), desc(降序)",
			title: "排序顺序",
		}),

		// 当前登录用户ID（可选，用于排除自己）
		currentUserId: z.string().optional().meta({
			description: "当前登录用户ID，用于在搜索结果中排除自己",
			title: "当前用户ID",
		}),
	})
	.meta({
		title: "服务人员筛选请求",
		description: "根据地理位置、价格区间、服务类型等条件筛选服务人员",
	})
	.refine(
		(data) => {
			// 价格区间验证
			if (data.minPrice !== undefined && data.maxPrice !== undefined) {
				return data.minPrice <= data.maxPrice;
			}
			return true;
		},
		{
			message: "最低价格不能大于最高价格",
			path: ["minPrice"],
		},
	);

// 匹配的服务人员信息 Schema
export const MatchedPersonnelSchema = z
	.object({
        ...ServicePersonnelSchema.shape,
		price: z.string().meta({
			description: "个人定价（字符串格式）",
			title: "个人定价",
		}),
		distance: z.number().meta({
			description: "与用户的距离（公里）",
			title: "距离",
		}),
		name: z.string().meta({
			description: "服务人员姓名",
			title: "姓名",
		}),
		avatarUrl: z.url().optional().meta({
			description: "服务人员头像URL",
			title: "头像URL",
		}),
        detailedAddress: z.string().optional().meta({
            description: "服务人员详细地址",
            title: "详细地址",
        }),
		reviewCount: z.number().default(0).meta({
			description: "评价总数",
			title: "评价数量",
		}),
		goodReviewCount: z.number().default(0).meta({
			description: "好评数量（4-5星）",
			title: "好评数量",
		}),
		goodReviewRate: z.number().default(0).meta({
			description: "好评率（百分比，如 95.50 表示 95.50%）",
			title: "好评率",
		}),
	})
	.meta({
		title: "匹配的服务人员信息",
		description: "包含匹配度信息的服务人员详情",
	});

// 服务人员筛选响应 Schema
export const ServicePersonnelFilterResponseSchema = MatchedPersonnelSchema.omit(
	{ geom: true },
).meta({
	description: "匹配的服务人员列表",
	title: "服务人员列表",
});

export const ServicePersonnelDetailsQuerySchema = z.object({
    serviceId: z.string(),
    personnelId: z.string(),
})

const specificationSchema = z.object({
    id: z.string().min(1, "id不能为空"),
    userId: z.string().min(1, "userId不能为空"),
    name: z.string().optional(), // 空字符串允许
    serviceId: z.string().min(1, "serviceId不能为空"),
    price: z.string().regex(/^\d+(\.\d+)?$/, "price必须为数字字符串"),
    currency: z.string().min(1, "currency不能为空"),
    estimatedDurationMinutes: z.number().int().positive().optional(),
});

// 已占用时间段 Schema
export const OccupiedTimeSlotSchema = z.object({
    orderId: z.string().min(1, "订单ID不能为空").meta({
        description: "订单ID",
        title: "订单ID",
    }),
    startTime: z.date().meta({
        description: "开始时间",
        title: "开始时间",
    }),
    endTime: z.date().meta({
        description: "结束时间",
        title: "结束时间",
    }),
    status: z.string().meta({
        description: "订单状态",
        title: "订单状态",
    }),
});

export const ServiceDetailsSchema = z.object({
    ...ServicePersonnelSchema.omit({ geom: true }).shape,
    specifications: z.array(specificationSchema),
    description: z.string().nullable(),
    servicedCount: z.number().int().nonnegative(),
    occupiedTimeSlots: z.array(OccupiedTimeSlotSchema).meta({
        description: "服务人员已占用的时间段列表",
        title: "已占用时间段",
    }),
});

export const FileAccessInfoSchema = z
    .object({
        fileId: z.string().min(1, "文件ID不能为空"),
        url: z.string().url(),
        fileName: z.string().min(1, "文件名不能为空"),
        mimeType: z.string().min(1, "MIME类型不能为空"),
        fileSize: z.number().int().nonnegative(),
        expiresIn: z.number().int().positive(),
        blurhash: z.string().optional(),
    })
    .meta({
        title: "文件访问信息",
        description: "通过 files 模块生成的预签名 URL 及其元数据",
    });

export const ServiceOfferingSpecificationInputSchema = z
	.object({
		id: z.string().optional().describe("规格ID，更新已有规格时必填"),
		name: z
			.string()
			.min(1, "规格名称不能为空")
			.max(100, "规格名称过长"),
		price: z.preprocess(
			(value) => {
				if (value === undefined || value === null) {
					return value;
				}
				if (typeof value === "number") {
					return value.toString();
				}
				if (typeof value === "string") {
					return value.trim();
				}
				return String(value);
			},
			z.string().min(1, "价格不能为空"),
		),
		currency: z.string().max(3).default("CNY"),
		estimatedDurationMinutes: z.preprocess((value) => {
			if (typeof value === "string") {
				return Number.parseInt(value.trim(), 10);
			}
			return value;
		}, z.number().int().positive("预计耗时必须为正数")),
	})
    .meta({
        title: "服务规格输入",
        description: "服务人员为某个分类配置的单条规格信息",
    });

export const UpdateServiceOfferingsRequestSchema = z
    .object({
        services: z
            .array(
                z.object({
                    serviceId: z.string().min(1, "服务ID不能为空"),
                    description: z
                        .string()
                        .max(2000, "描述过长")
                        .optional()
                        .nullable(),
                    specifications: z
                        .array(ServiceOfferingSpecificationInputSchema)
                        .min(1, "至少需要保留一条服务规格"),
                }),
            )
            .min(1, "请至少选择一个服务分类"),
    })
    .meta({
        title: "更新服务人员提供的服务",
        description: "批量配置服务分类、描述以及规格信息",
    });

export const ServicePersonnelOfferingSchema = z
	.object({
        serviceId: z.string().min(1, "服务ID不能为空"),
        serviceName: z.string().min(1, "服务名称不能为空"),
        serviceDescription: z.string().nullable(),
        personnelDescription: z.string().nullable(),
        currency: z.string().min(1, "币种不能为空"),
        isActive: z.boolean(),
        specifications: z.array(specificationSchema).default([]),
        pricing: PersonnelPricingInfoSchema.nullable().optional(),
	})
	.meta({
		title: "服务人员可提供的服务及定价",
		description: "聚合后的服务与个人定价信息",
	});

export const ServicePersonnelProfileSchema = z
	.object({
        userId: z.string().min(1, "服务人员ID不能为空"),
        name: z.string().nullable().describe("昵称或实名"),
        bio: z.string().nullable(),
        province: z.string().min(1, "省份不能为空"),
        district: z.string().nullable(),
        county: z.string().nullable(),
        detailedAddress: z.string().nullable(),
        yearsOfExperience: z.number().int().nonnegative(),
        workStartTime: z.string().min(1, "工作开始时间不能为空"),
        workEndTime: z.string().min(1, "工作结束时间不能为空"),
        workDays: z.string().min(1, "工作日不能为空"),
        isAvailable: z.boolean(),
        currentStatus: z.string().min(1, "当前状态不能为空"),
        lastActiveAt: z.date(),
        maskedPhoneNumber: z.string().nullable(),
        avatar: FileAccessInfoSchema.nullable(),
        services: z.array(ServicePersonnelOfferingSchema),
        qualificationImages: z.array(FileAccessInfoSchema).default([]),
        location: z
            .object({
                lng: z.number(),
                lat: z.number(),
            })
            .nullable()
            .meta({
                title: "定位坐标",
                description: "服务人员的经纬度坐标（源自 service_personnel.geom）",
            }),
	})
	.meta({
		title: "服务人员聚合资料",
		description:
		    "聚合 work-skill、service-personnel、files 数据后的服务人员完整资料",
    });

export const ServicePersonnelDashboardStatsSchema = z
	.object({
		userId: z.string().min(1, "服务人员ID不能为空"),
		serviceCount: z.number().int().nonnegative().meta({
			title: "累计服务次数",
			description: "服务人员已完成的订单数量",
		}),
		rating: z
			.object({
				value: z.number().nonnegative().meta({
					title: "评分数值",
					description: "平均评分（0-5）",
				}),
				display: z.string().meta({
					title: "评分展示",
					description: "格式化后的评分字符串",
				}),
				totalReviews: z.number().int().nonnegative().meta({
					title: "评价总数",
					description: "累计评价次数",
				}),
				goodRatePercentage: z
					.number()
					.int()
					.min(0)
					.max(100)
					.meta({
						title: "好评率",
						description: "好评占比（百分数）",
					}),
			})
			.meta({
				title: "评分信息",
				description: "服务人员评价相关统计",
			}),
		balance: z
			.object({
				available: z.number().nonnegative().meta({
					title: "可提现余额",
					description: "当前可提现金额",
				}),
				frozen: z.number().nonnegative().meta({
					title: "冻结金额",
					description: "提现或风控中的冻结金额",
				}),
				currency: z.string().min(1).max(3).default("CNY").meta({
					title: "币种",
					description: "余额币种",
				}),
			})
			.meta({
				title: "余额信息",
				description: "账户余额及冻结金额",
			}),
		generatedAt: z.date().meta({
			title: "统计生成时间",
			description: "本次统计生成的时间",
		}),
	})
	.meta({
		title: "服务人员仪表盘统计",
		description: "个人中心展示的服务次数、评分、账户余额统计",
	});

// ==================== TypeScript 类型定义 ====================

export type UpsertWorkInfoRequest = z.infer<typeof UpsertWorkInfoRequestSchema>;
export type UpdatePersonnelSkillsRequest = z.infer<
	typeof UpdatePersonnelSkillsRequestSchema
>;
export type GetPersonnelInfoRequest = z.infer<
	typeof GetPersonnelInfoRequestSchema
>;
export type SkillUpdateResult = z.infer<typeof SkillUpdateResultSchema>;
export type PersonnelSkill = z.infer<typeof PersonnelSkillSchema>;
export type PersonnelDetailInfo = z.infer<typeof PersonnelDetailInfoSchema>;

// 定价管理相关类型
export type UpsertPersonnelPricingRequest = z.infer<
	typeof UpsertPersonnelPricingRequestSchema
>;
export type RemovePersonnelPricingRequest = z.infer<
	typeof RemovePersonnelPricingRequestSchema
>;
export type PersonnelPricingInfo = z.infer<typeof PersonnelPricingInfoSchema>;
export type UpdateServiceOfferingsRequest = z.infer<
    typeof UpdateServiceOfferingsRequestSchema
>;
export type ServiceOfferingSpecificationInput = z.infer<
    typeof ServiceOfferingSpecificationInputSchema
>;

// 服务人员筛选相关类型
export type ServicePersonnelFilterRequest = z.infer<
	typeof ServicePersonnelFilterRequestSchema
>;
export type MatchedPersonnel = z.infer<typeof MatchedPersonnelSchema>;
export type ServicePersonnelFilterResponse = z.infer<
	typeof ServicePersonnelFilterResponseSchema
>;
export type ServiceDetails = z.infer<typeof ServiceDetailsSchema>;
export type ServicePersonnelDetailsQuery = z.infer<typeof ServicePersonnelDetailsQuerySchema>
export type OccupiedTimeSlot = z.infer<typeof OccupiedTimeSlotSchema>;
export type FileAccessInfo = z.infer<typeof FileAccessInfoSchema>;
export type ServicePersonnelOffering = z.infer<
    typeof ServicePersonnelOfferingSchema
>;
export type ServicePersonnelProfile = z.infer<
    typeof ServicePersonnelProfileSchema
>;
export type ServicePersonnelDashboardStats = z.infer<
	typeof ServicePersonnelDashboardStatsSchema
>;
