import { z } from "zod/v4";
import { PaginationMetaSchema, PaginationQuerySchema } from "./common";
import {
    AssignmentDecisionStatusEnum,
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

/**
 * 订单卡片列表页（mobile-user 订单 tab）查询参数
 *
 * 设计目标：只服务 `apps/mobile-user/app/(tabs)/orders/index.tsx`。
 * 不与现有 OrderListResponse 强绑定，避免影响其它端。
 */
export const OrderCardsTabSchema = z
    .enum(["all", "pending_payment", "paid", "needs_review"])
    .meta({
        title: "订单列表 Tab",
        description:
            "用户端订单列表页 tab 过滤条件。paid tab 语义：pending_acceptance + paid。",
    });

export type OrderCardsTab = z.infer<typeof OrderCardsTabSchema>;

export const OrderCardActionVariantSchema = z
    .enum(["primary", "outline", "outlineMuted", "outlinePrimary"])
    .meta({
        title: "订单卡片按钮样式",
        description:
            "与用户端订单列表页 UI 一致的按钮 variant。来源：apps/mobile-user/app/(tabs)/orders/index.tsx",
    });

export type OrderCardActionVariant = z.infer<
    typeof OrderCardActionVariantSchema
>;

export const OrderCardActionSchema = z
    .object({
        key: z.string().min(1).meta({
            title: "动作 key",
            description:
                "用于前端稳定渲染与埋点，建议固定值，不使用 label 作为 key。",
        }),
        label: z.string().min(1).meta({
            title: "按钮文案",
            description: "订单卡片底部按钮文案。",
        }),
        variant: OrderCardActionVariantSchema,
        disabled: z.boolean().optional(),
    })
    .meta({
        title: "订单卡片操作按钮",
        description: "订单列表页卡片底部按钮定义。",
    });

export type OrderCardAction = z.infer<typeof OrderCardActionSchema>;

export const OrderCardSchema = z
    .object({
        id: z.string().min(1),
        title: z.string().min(1),
        status: OrderStatusEnum,
        statusText: z.string().min(1).optional(),
        workerName: z.string().min(1).nullable(),
        workerAvatar: z.string().min(1).nullable().optional().meta({
            title: "服务人员头像",
            description:
                "服务人员头像标识。可以是 http(s) 直链，也可以是 files 模块可访问的 fileIdentifier（id/hash）。",
        }),
        workerAvatarUrl: z.string().url().nullable().optional().meta({
            title: "服务人员头像预签名 URL",
            description:
                "推荐使用：服务人员头像的预签名访问 URL（减少一次 /files 请求）。",
        }),
        workerAvatarBlurhash: z.string().min(1).nullable().optional().meta({
            title: "服务人员头像 BlurHash",
            description:
                "配合 expo-image placeholder 使用；为空表示暂无 blurhash。",
        }),
        serviceName: z.string().min(1),
        serviceId: z.string().min(1).meta({
            title: "服务ID",
            description: "用于跳转服务详情/再次预约。",
        }),
        servicePersonnelId: z.string().min(1).nullable().optional().meta({
            title: "服务人员ID",
            description: "订单关联的服务人员ID（可能为空）。",
        }),
        itemCount: z.number().int().min(0),
        appointmentTime: z.iso.datetime({ offset: true, local: true }),
        totalAmount: z.number().min(0),
        paymentExpiresAt: z.iso
            .datetime({ offset: true, local: true })
            .nullable()
            .optional()
            .meta({
                title: "支付过期时间",
                description:
                    "支付超时时间（用于 pending_payment 倒计时）。非待支付订单可不返回或返回 null。",
            }),
        needsReview: z.boolean(),
        actions: z.array(OrderCardActionSchema).optional(),
    })
    .meta({
        title: "订单卡片",
        description:
            "用户端订单列表页卡片模型（raw values）。前端负责格式化 appointmentTime/totalAmount/itemCount。",
    });

export type OrderCard = z.infer<typeof OrderCardSchema>;

export const OrderCardsListQuerySchema = z
    .object({
        ...PaginationQuerySchema.shape,
        tab: OrderCardsTabSchema,
    })
    .meta({
        title: "订单卡片列表查询",
        description: "用户端订单列表页卡片接口查询参数。",
    });

export type OrderCardsListQuery = z.infer<typeof OrderCardsListQuerySchema>;

export const OrderCardsListResponseSchema = z
    .object({
        items: z.array(OrderCardSchema),
        meta: PaginationMetaSchema,
    })
    .meta({
        title: "订单卡片列表响应",
        description: "用户端订单列表页卡片接口响应（分页）。",
    });

export type OrderCardsListResponse = z.infer<
    typeof OrderCardsListResponseSchema
>;

export const StaffOrderListRequestSchema = z
    .object({
        ...PaginationQuerySchema.shape,
        page: PaginationQuerySchema.shape.page.optional().default(1),
        limit: PaginationQuerySchema.shape.limit.optional().default(20),
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
        prioritySort: z.boolean().optional().meta({
            description: "按服务人员订单列表业务优先级排序",
            title: "服务人员订单优先级排序",
        }),
        includeGroups: z.boolean().optional().meta({
            description: "返回服务人员订单列表分组",
            title: "返回订单分组",
        }),
    })
    .meta({
        title: "服务人员订单列表查询请求",
        description: "服务人员获取自己的订单列表时的查询参数",
    });

export type StaffOrderListRequest = z.infer<typeof StaffOrderListRequestSchema>;

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
    avatarUrl: z.string().optional().nullable(),
    avatarBlurhash: z.string().min(1).optional().nullable(),
    userName: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
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
        paymentExpiresAt: z.coerce.date(),
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
                imageFileId: z.string().nullable().optional(),
                imageFileUrl: z.string().nullable().optional(),
                imageUrl: z.string().url().nullable().optional(),
                imageBlurhash: z.string().min(1).nullable().optional(),
            })
            .nullable()
            .meta({
                description: "服务信息",
                title: "服务信息",
            }),
        assignment: OrderDetailAssignmentSchema,
        specificationName: z.string().min(1).nullable().optional(),
        estimatedDurationMinutes: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),
        needsReview: z.boolean().optional(),
        canCancel: z.boolean().optional(),
        canPay: z.boolean().optional(),
        showCheckinQr: z.boolean().optional(),
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
export const OrderListSimplifiedItemSchema = z
    .object({
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
        paymentExpiresAt: z.coerce.date().meta({
            description: "支付过期时间",
            title: "支付过期时间",
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
    })
    .meta({
        title: "简化订单列表项",
        description: "用于订单列表展示的简化数据格式",
    });

export type OrderListSimplifiedItem = z.infer<
    typeof OrderListSimplifiedItemSchema
>;

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

export type OrderListSimplifiedResponse = z.infer<
    typeof OrderListSimplifiedResponseSchema
>;

export const StaffOrderListItemSchema = z.object({
    id: z.string(),
    status: OrderStatusEnum,
    createdAt: z.date(),
    appointmentTime: z.date(),
    totalAmount: z.number(),
    serviceName: z.string(),
    serviceSpecification: z.string().nullable(),
    serviceIconUrl: z.string().url().nullable().optional(),
    serviceIconBlurhash: z.string().min(1).nullable().optional(),
    customerName: z.string().nullable(),
    customerPhone: z.string().nullable(),
    customerAvatar: z.string().nullable(),
    address: z.string().nullable(),
    remark: z.string().nullable(),
    acceptedAt: z.date().nullable(),
    decisionStatus: AssignmentDecisionStatusEnum,
    rejectReason: z.string().nullable(),
    rejectedAt: z.date().nullable(),
    serviceStartedAt: z.date().nullable(),
    serviceCompletedAt: z.date().nullable(),
});

export const StaffOrderListGroupKeySchema = z.enum([
    "pending_acceptance",
    "paid",
    "completed",
    "archived",
]);

export const StaffOrderListGroupSchema = z.object({
    key: StaffOrderListGroupKeySchema,
    title: z.string(),
    count: z.number().int().nonnegative(),
    items: z.array(StaffOrderListItemSchema),
});

export const StaffOrderListResponseSchema = z
    .object({
        items: z.array(StaffOrderListItemSchema).meta({
            description: "订单列表",
            title: "订单列表",
        }),
        groups: z.array(StaffOrderListGroupSchema).optional().meta({
            description: "服务人员订单列表分组，仅列表页需要",
            title: "订单分组",
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
export type StaffOrderListGroup = z.infer<typeof StaffOrderListGroupSchema>;
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
        pendingService: z.number().int().nonnegative().meta({
            description: "待服务",
            title: "待服务订单数",
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
    appointmentTime: z.coerce.date(),
    paymentExpiresAt: z.coerce.date(),
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

// ========== Mobile User 确认订单页（designated personnel） ==========

export const PricingItemKeySchema = z
    .enum([
        "service_fee",
        "on_site_fee",
        "platform_fee",
        "coupon_discount",
        "promo_discount",
    ])
    .meta({
        title: "费用项 key",
        description: "确认订单页费用拆分项的稳定 key；折扣项使用负数金额表示。",
    });

export type PricingItemKey = z.infer<typeof PricingItemKeySchema>;

export const PricingItemSchema = z
    .object({
        key: PricingItemKeySchema,
        label: z.string().min(1).meta({
            title: "费用项名称",
            description: "用于前端渲染展示的 label。",
        }),
        amount: z.number().meta({
            title: "金额（元）",
            description:
                "金额单位：元；允许两位小数；优惠/折扣项使用负数表示。",
        }),
    })
    .meta({
        title: "费用拆分项",
        description: "确认订单页费用明细条目。",
    });

export type PricingItem = z.infer<typeof PricingItemSchema>;

export const PricingSchema = z
    .object({
        currency: z.string().default("CNY").meta({
            title: "币种",
            description: "默认 CNY。",
        }),
        items: z.array(PricingItemSchema).meta({
            title: "费用明细",
            description:
                "按约定顺序返回：service_fee、on_site_fee、platform_fee、coupon_discount、promo_discount。",
        }),
        originalAmount: z.number().min(0).meta({
            title: "原价合计",
            description: "正数费用项合计（sum(amount>0)）。",
        }),
        discountAmount: z.number().min(0).meta({
            title: "优惠合计",
            description: "折扣项绝对值合计（abs(sum(amount<0))）。",
        }),
        totalAmount: z.number().min(0).meta({
            title: "应付金额",
            description: "应付金额（originalAmount - discountAmount）。",
        }),
    })
    .meta({
        title: "费用拆分",
        description:
            "确认订单页统一以服务端返回的 pricing.totalAmount 作为展示/下单/支付的金额来源。",
    });

export type Pricing = z.infer<typeof PricingSchema>;

export const OrderConfirmDesignatedPreviewQuerySchema = z
    .object({
        personnelId: z.string().min(1).meta({
            title: "服务人员 ID",
            description: "指定服务人员（userId）。",
        }),
        serviceId: z.string().min(1).meta({
            title: "服务 ID",
            description: "服务项目 ID。",
        }),
        specificationId: z.string().min(1).optional().meta({
            title: "规格 ID",
            description: "可选：service_personnel_pricing 表的 ID。",
        }),
        addressId: z.string().min(1).optional().meta({
            title: "地址 ID",
            description: "可选：用户选择的地址 ID；为空则返回默认地址。",
        }),
        appointmentTime: z.iso
            .datetime({ offset: true, local: true })
            .optional()
            .meta({
                title: "预约时间",
                description: "可选：用于确认页展示。",
            }),
        couponCode: z.string().min(1).optional().meta({
            title: "优惠券码",
            description: "可选：v1 不计算折扣，仅透传/占位。",
        }),
    })
    .meta({
        title: "确认订单预览（指定服务人员）Query",
        description:
            "创建订单前的确认页聚合预览参数：personnelId + serviceId 必填，其余可选。",
    });

export type OrderConfirmDesignatedPreviewQuery = z.infer<
    typeof OrderConfirmDesignatedPreviewQuerySchema
>;

export const OrderConfirmDesignatedPreviewSpecificationSchema = z
    .object({
        id: z.string().min(1),
        userId: z.string().min(1),
        name: z.string().optional(),
        serviceId: z.string().min(1),
        price: z.string().regex(/^\d+(\.\d+)?$/, "price必须为数字字符串"),
        currency: z.string().min(1),
        estimatedDurationMinutes: z.number().int().positive().optional(),
    })
    .meta({
        title: "服务规格",
        description:
            "用于确认订单页展示/选择的规格列表，结构与 service-personnel/getServiceDetails 保持一致。",
    });

export type OrderConfirmDesignatedPreviewSpecification = z.infer<
    typeof OrderConfirmDesignatedPreviewSpecificationSchema
>;

export const OrderConfirmDesignatedPreviewSelectedSchema = z
    .object({
        specificationId: z.string().min(1),
        addressId: z.string().min(1).optional(),
        appointmentTime: z.iso
            .datetime({ offset: true, local: true })
            .optional(),
        couponCode: z.string().min(1).optional(),
    })
    .meta({
        title: "确认页已选项",
        description: "确认订单预览返回当前选中的规格/地址/预约时间等。",
    });

export type OrderConfirmDesignatedPreviewSelected = z.infer<
    typeof OrderConfirmDesignatedPreviewSelectedSchema
>;

export const OrderConfirmDesignatedPreviewResponseSchema = z
    .object({
        address: UserAddressesSchema.nullable().meta({
            title: "地址",
            description: "用户选择的地址或默认地址；无地址则为 null。",
        }),
        servicePersonnel: ServicePersonnelSchema.omit({ geom: true }).meta({
            title: "服务人员",
            description: "确认页展示所需的服务人员信息（不包含 geom）。",
        }),
        service: z
            .object({
                id: z.string().min(1),
                name: z.string().min(1),
                imageFileUrl: z.string().url().nullable().optional(),
            })
            .meta({
                title: "服务信息",
                description: "确认页展示所需的服务信息（最小子集）。",
            }),
        specifications: z.array(
            OrderConfirmDesignatedPreviewSpecificationSchema,
        ),
        selected: OrderConfirmDesignatedPreviewSelectedSchema,
        pricing: PricingSchema,
        paymentExpiresAt: z.iso
            .datetime({ offset: true, local: true })
            .nullable()
            .optional()
            .meta({
                title: "支付过期时间",
                description:
                    "可选：用于确认页展示支付倒计时/有效期；也可仅在下单响应返回。",
            }),
    })
    .meta({
        title: "确认订单预览（指定服务人员）Response",
        description: "用于确认订单页的一次性聚合数据源。",
    });

export type OrderConfirmDesignatedPreviewResponse = z.infer<
    typeof OrderConfirmDesignatedPreviewResponseSchema
>;

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
        designatedPersonnelId: z
            .string()
            .min(1, "指定服务人员ID不能为空")
            .meta({
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
        remark: z.string().max(500, "备注不能超过500字符").optional().meta({
            description: "订单备注信息",
            title: "备注",
        }),
    })
    .meta({
        title: "创建指定服务人员订单",
        description: "创建指定服务人员订单的请求参数",
    });

export type CreateDesignatedOrder = z.infer<typeof CreateDesignatedOrderSchema>;

export const CreateDesignatedOrderResponseSchema = z
    .object({
        orderId: z.string().min(1).meta({
            title: "订单 ID",
            description: "创建成功后的订单 ID。",
        }),
        pricing: PricingSchema.meta({
            title: "费用拆分",
            description:
                "下单后返回 pricing 用于前端二次校验与支付展示金额；displayAmount 应使用 pricing.totalAmount。",
        }),
        paymentExpiresAt: z.iso.datetime({ offset: true, local: true }).meta({
            title: "支付过期时间",
            description: "订单待支付的有效期截止时间。",
        }),
    })
    .meta({
        title: "创建指定服务人员订单 Response",
        description: "创建指定服务人员订单后的响应（含二次校验所需字段）。",
    });

export type CreateDesignatedOrderResponse = z.infer<
    typeof CreateDesignatedOrderResponseSchema
>;

export const OrderRescheduleSchema = z
    .object({
        appointmentTime: z.iso.datetime({ offset: true, local: true }).meta({
            title: "预约窗口起点",
            description:
                "2 小时服务到达窗口的起始时间点（slot start），ISO datetime。",
        }),
    })
    .meta({
        title: "服务人员改期",
        description: "服务人员将订单预约时间改为新的 2 小时窗口起点。",
    });

export type OrderRescheduleDto = z.infer<typeof OrderRescheduleSchema>;

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
        title: "生成订单完成确认二维码",
        description: "生成订单完成确认二维码响应",
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
        title: "确认订单完成二维码",
        description: "确认订单完成二维码请求参数",
    });

export type VerifyOrderCheckinDto = z.infer<typeof VerifyOrderCheckinSchema>;
