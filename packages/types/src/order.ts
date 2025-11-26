import { z } from "zod/v4";
import { PaginationMetaSchema, PaginationQuerySchema } from "./common";
import {
	CouponUsageRecordsSchema,
	OrderAssignmentsSchema,
	OrderStatusEnum,
	OrdersSchema,
	PaymentsSchema,
	ServicePersonnelSchema,
	ServicesSchema,
	UserAddressesSchema,
} from "./database-entity";

// 订单列表查询请求 Schema（继承通用分页参数）
export const OrderListRequestSchema = z
	.object({
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
	})
	.meta({
		title: "订单列表查询请求",
		description: "获取订单列表的查询参数",
	});

export type OrderListRequest = z.infer<typeof OrderListRequestSchema>;

export const StaffOrderListRequestSchema = z
	.object({
		...PaginationQuerySchema.shape,
		status: OrderStatusEnum.optional().meta({
			description: "订单状态",
			title: "订单状态",
		}),
		servicePersonnelId: z.string().min(1, "服务人员ID不能为空").meta({
			description: "服务人员ID",
			title: "服务人员ID",
		}),
		startTime: z.date().optional().meta({
			description: "开始时间",
			title: "开始时间",
		}),
		endTime: z.date().optional().meta({
			description: "结束时间",
			title: "结束时间",
		}),
		onlyAccepted: z.boolean().optional().meta({
			description: "仅显示已接单订单",
			title: "仅显示已接单订单",
		}),
	})
	.meta({
		title: "服务人员订单列表查询请求",
		description: "服务人员获取自己的订单列表时的查询参数",
	});

export type StaffOrderListRequest = z.infer<
	typeof StaffOrderListRequestSchema
>;

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

const OrderDetailServicePersonnelSchema = z.object({
    ...ServicePersonnelSchema.shape,
	lastActiveAt: z.coerce.date(),
});

const OrderDetailAssignmentSchema = z
	.object({
		...OrderAssignmentsSchema.shape,
		assignedAt: z.coerce.date(),
		acceptedAt: z.coerce.date().nullable().optional(),
		servicePersonnel: OrderDetailServicePersonnelSchema.meta({
			description: "服务人员信息",
			title: "服务人员信息",
		}),
	})
	.nullable()
	.meta({
		description: "订单分配信息",
		title: "订单分配信息",
	});

const OrderDetailPaymentSchema = z.object({
	id: z.string(),
	amount: z.number(),
	paymentMethod: z.string(),
	status: z.string(),
	transactionId: z.string().optional().nullable(),
	paidAt: z.coerce.date().nullable(),
});

// 订单详情 Schema
export const OrderDetailSchema = z
	.object({
		...OrdersSchema.shape,
		originalAmount: z.number(),
		discountAmount: z.number(),
		totalAmount: z.number(),
		appointmentTime: z.coerce.date(),
		serviceStartedAt: z.coerce.date().nullable().optional(),
		serviceCompletedAt: z.coerce.date().nullable().optional(),
		cancelledAt: z.coerce.date().nullable().optional(),
		createdAt: z.coerce.date(),
		updatedAt: z.coerce.date(),
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
		assignment: OrderDetailAssignmentSchema,
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
			.array(OrderDetailPaymentSchema)
			.meta({
				description: "支付信息",
				title: "支付信息",
			})
			.nullable(),
	})
	.meta({
		title: "订单详情",
		description: "包含详细信息的订单",
	});

export type OrderDetail = z.infer<typeof OrderDetailSchema>;

// 简化的订单列表项 Schema - 用于列表展示
export const OrderListSimplifiedItemSchema = z.object({
    id: z.string().meta({
        description: "订单ID",
        title: "订单ID",
    }),
    status: OrderStatusEnum.meta({
        description: "订单状态",
        title: "订单状态",
    }),
    totalAmount: z.string().meta({
        description: "订单总金额",
        title: "订单总金额",
    }),
    appointmentTime: z.date().meta({
        description: "预约时间",
        title: "预约时间",
    }),
    serviceName: z.string().meta({
        description: "服务名称",
        title: "服务名称",
    }),
    servicePersonnelName: z.string().meta({
        description: "服务人员名称",
        title: "服务人员名称",
    }),
    serviceSpecifications: z.string().meta({
        description: "服务规格",
        title: "服务规格",
    }),
    servicePersonnelImage: z.string().meta({
        description: "服务人员图片",
        title: "服务人员图片",
    }),
}).meta({
    title: "简化订单列表项",
    description: "用于订单列表展示的简化数据格式",
});

export type OrderListSimplifiedItem = z.infer<typeof OrderListSimplifiedItemSchema>;

// 简化订单列表响应 Schema
export const OrderListSimplifiedResponseSchema = z
	.object({
		items: z.array(OrderListSimplifiedItemSchema).meta({
			description: "数据列表",
			title: "数据列表",
        }),
        meta: PaginationMetaSchema.meta({
            description: "分页元数据",
            title: "分页元数据",
        }),
    })
    .meta({
        title: "简化订单列表响应",
        description: "分页订单列表响应数据（简化格式）",
    });

export type OrderListSimplifiedResponse = z.infer<typeof OrderListSimplifiedResponseSchema>;

export const StaffOrderListItemSchema = z.object({
	id: z.string(),
	status: OrderStatusEnum,
	appointmentTime: z.date(),
	totalAmount: z.number(),
	serviceName: z.string(),
	serviceSpecification: z.string().nullable(),
	customerName: z.string().nullable(),
	customerPhone: z.string().nullable(),
	customerAvatar: z.string().nullable(),
	address: z.string().nullable(),
	acceptedAt: z.date().nullable(),
	serviceStartedAt: z.date().nullable(),
	serviceCompletedAt: z.date().nullable(),
});

export const StaffOrderListResponseSchema = z
	.object({
		items: z.array(StaffOrderListItemSchema).meta({
			description: "订单列表",
			title: "订单列表",
		}),
		meta: PaginationMetaSchema.meta({
			description: "分页信息",
			title: "分页信息",
		}),
	})
	.meta({
		title: "服务人员订单列表响应",
		description: "服务人员端分页订单列表数据",
	});

export type StaffOrderListItem = z.infer<typeof StaffOrderListItemSchema>;
export type StaffOrderListResponse = z.infer<
	typeof StaffOrderListResponseSchema
>;

export const StaffOrderStatsSchema = z
	.object({
		total: z.number().int().nonnegative().meta({
			description: "订单总数",
			title: "订单总数",
		}),
		completed: z.number().int().nonnegative().meta({
			description: "已完成订单数",
			title: "已完成订单数",
		}),
		inProgress: z.number().int().nonnegative().meta({
			description: "进行中订单数",
			title: "进行中订单数",
		}),
	})
	.meta({
		title: "服务人员订单统计",
		description: "用于个人中心展示的订单统计数据",
	});

export type StaffOrderStats = z.infer<typeof StaffOrderStatsSchema>;

// 原始完整的订单列表项 Schema（保留用于需要详细信息的场景）
export const OrderListResponseItemSchema = z.object({
	...OrdersSchema.omit({
		customerId: true,
		serviceId: true,
		addressId: true,
		originalAmount: true,
		discountAmount: true,
        couponCode: true,
	}).shape,
    totalAmount: z.string().meta({
        description: "订单总金额，包含折扣后的最终金额",
        title: "订单总金额",
    }),
	assignment: z.object({
		...OrderAssignmentsSchema.omit({
			id: true,
			orderId: true,
			servicePersonnelId: true,
			assignmentType: true,
		}).shape,
		servicePersonnel: ServicePersonnelSchema.omit({
			geom: true,
			userId: true,
			currentStatus: true,
		}),
	}),
	service: ServicesSchema.omit({
		categoryId: true,
		basePrice: true,
	}),
	address: UserAddressesSchema.omit({
		geom: true,
		userId: true,
	}),
	payments: z.array(PaymentsSchema.omit({ orderId: true })),
	couponUsageRecords: z.array(
		CouponUsageRecordsSchema.omit({
			orderId: true,
		}),
	),
});

export type OrderListResponseItem = z.infer<typeof OrderListResponseItemSchema>;

// 订单列表响应 Schema
export const OrderListResponseSchema = z
	.object({
		items: z.array(OrderListResponseItemSchema).meta({
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
		appointmentTime: z.iso.datetime({ offset: true, local: true }).meta({
			description: "预约时间",
			title: "预约时间",
		}),
		discountAmount: z
			.number()
			.min(0)
			.meta({
				description: "折扣金额",
				title: "折扣金额",
			})
			.optional(),
		designatedPersonnelId: z.string().min(1, "指定服务人员ID不能为空").meta({
			description: "指定服务人员ID",
			title: "指定服务人员ID",
		}),
        specificationId: z.string().min(1, "服务规格ID不能为空").meta({
            description: "服务规格ID（service_personnel_pricing表的ID）",
            title: "服务规格ID",
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

export const orderCheckinPayloadSchema = z.object({
	orderId: z.string().min(1, "订单 ID 不能为空"),
	token: z.string().min(1, "二维码令牌不能为空"),
});

export type OrderCheckinPayload = z.infer<typeof orderCheckinPayloadSchema>;

export const GenerateOrderCheckinSchema = z
	.object({
		orderId: z.string().min(1, "订单 ID 不能为空"),
		token: z.string().min(1, "二维码令牌不能为空"),
		expiresAt: z.iso.datetime({ offset: true, local: true }),
		ttlSeconds: z.number().int().min(1),
		qrCodeDataUrl: z.string().min(1, "二维码数据不能为空"),
		payload: orderCheckinPayloadSchema.shape,
	})
	.meta({
		title: "生成订单核验二维码",
		description: "生成订单核验二维码请求参数",
	});

export type GenerateOrderCheckinDto = z.infer<
	typeof GenerateOrderCheckinSchema
>;

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
