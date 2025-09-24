import { z } from "zod/v4";
import { PaginationMetaSchema, PaginationQuerySchema } from "./common";
import {
	OrderAssignmentsSchema,
	OrderStatusEnum,
	OrdersSchema,
} from "./database-entity";

// 订单列表查询请求 Schema（继承通用分页参数）
export const OrderListRequestSchema = z.object({
	...PaginationQuerySchema.shape,
	status: OrderStatusEnum.optional().meta({
		description: "订单状态",
		title: "订单状态",
	}),
	customerId: z.string().min(1, "客户ID不能为空").meta({
		description: "客户ID",
		title: "客户ID",
	}),
	startTime: z.date().optional().meta({
		description: "开始时间",
		title: "开始时间",
	}),
	endTime: z.date().optional().meta({
		description: "结束时间",
		title: "结束时间",
	}),
}).meta({
	title: "订单列表查询请求",
	description: "获取订单列表的查询参数",
});

export type OrderListRequest = z.infer<typeof OrderListRequestSchema>;

// 创建订单 Schema
export const CreateOrderSchema = OrdersSchema.omit({
	id: true,
	orderSerial: true,
	createdAt: true,
	updatedAt: true,
}).meta({
	title: "创建订单",
	description: "创建订单的请求参数",
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;

// 更新订单 Schema
export const UpdateOrderSchema = OrdersSchema.partial()
	.required({ id: true })
	.meta({
		title: "更新订单",
		description: "更新订单的请求参数",
	});

export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;

// 订单详情 Schema
export const OrderDetailSchema = OrdersSchema.safeExtend({
	service: z
		.object({
			id: z.string(),
			name: z.string(),
			description: z.string().nullable(),
		})
		.nullable()
		.meta({
			description: "服务信息",
			title: "服务信息",
		}),
	assignment: OrderAssignmentsSchema.nullable().meta({
		description: "订单分配信息",
		title: "订单分配信息",
	}),
	address: z
		.object({
			id: z.string(),
			detailedAddress: z.string(),
			recipientName: z.string(),
			recipientPhone: z.string(),
		})
		.nullable()
		.meta({
			description: "地址信息",
			title: "地址信息",
		}),
	payments: z
		.array(
			z.object({
				id: z.string(),
				amount: z.number(),
				paymentMethod: z.string(),
				status: z.string(),
				paidAt: z.date().nullable(),
			}),
		)
		.meta({
			description: "支付信息",
			title: "支付信息",
		})
		.nullable(),
}).meta({
	title: "订单详情",
	description: "包含详细信息的订单",
});

export type OrderDetail = z.infer<typeof OrderDetailSchema>;

// 订单列表响应 Schema
export const OrderListResponseSchema = z
	.object({
		items: z.array(OrderDetailSchema).meta({
			description: "数据列表",
			title: "数据列表",
		}),
		meta: PaginationMetaSchema.meta({
			description: "分页元数据",
			title: "分页元数据",
		}),
	})
	.meta({
		title: "订单列表响应",
		description: "分页订单列表响应数据",
	});

export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

// 创建指定服务人员订单的 Schema
export const CreateDesignatedOrderSchema = z
	.object({
		customerId: z.string().min(1, "客户ID不能为空").meta({
			description: "客户ID",
			title: "客户ID",
		}),
		serviceId: z.string().min(1, "服务ID不能为空").meta({
			description: "服务ID",
			title: "服务ID",
		}),
		addressId: z.string().min(1, "地址ID不能为空").meta({
			description: "地址ID",
			title: "地址ID",
		}),
		appointmentTime: z.date().meta({
			description: "预约时间",
			title: "预约时间",
		}),
		discountAmount: z.number().min(0).meta({
			description: "折扣金额",
			title: "折扣金额",
		}),
		designatedPersonnelId: z.string().min(1, "指定服务人员ID不能为空").meta({
			description: "指定服务人员ID",
			title: "指定服务人员ID",
		}),
		displayPrice: z.number().min(0.01).meta({
			description: "用户在应用中看到的价格",
			title: "展示价格",
		}),
	})
	.meta({
		title: "创建指定服务人员订单",
		description: "创建指定服务人员订单的请求参数",
	});

export type CreateDesignatedOrder = z.infer<typeof CreateDesignatedOrderSchema>;

export const GenerateOrderCheckinSchema = z
	.object({
		orderId: z.string().min(1, "订单 ID 不能为空"),
	})
	.meta({
		title: "生成订单核验二维码",
		description: "生成订单核验二维码请求参数",
	});

export type GenerateOrderCheckinDto = z.infer<typeof GenerateOrderCheckinSchema>;

export const VerifyOrderCheckinSchema = z
	.object({
		token: z.string().min(1, "二维码令牌不能为空"),
		latitude: z.number().gte(-90).lte(90),
		longitude: z.number().gte(-180).lte(180),
		orderId: z.string().min(1).optional(),
		remark: z.string().max(200).optional(),
	})
	.meta({
		title: "核验订单二维码",
		description: "核验订单二维码请求参数",
	});

export type VerifyOrderCheckinDto = z.infer<typeof VerifyOrderCheckinSchema>;
