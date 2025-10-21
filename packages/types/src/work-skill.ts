import { z } from "zod/v4";
import {
	ServicePersonnelPricingSchema,
	ServicePersonnelSchema,
	ServicesSchema,
} from "./database-entity";

// ==================== Work Skill 相关 Zod Schema ====================

// 更新工作人员信息请求 Schema（不包含 userId，由认证中间件提供）
export const UpsertWorkInfoRequestSchema = z.object({
	...ServicePersonnelSchema.omit({
		userId: true,
        geom: true,
	}).shape,
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

// 服务人员筛选相关类型
export type ServicePersonnelFilterRequest = z.infer<
	typeof ServicePersonnelFilterRequestSchema
>;
export type MatchedPersonnel = z.infer<typeof MatchedPersonnelSchema>;
export type ServicePersonnelFilterResponse = z.infer<
	typeof ServicePersonnelFilterResponseSchema
>;
