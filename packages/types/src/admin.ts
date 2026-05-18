import { z } from "zod/v4";
import { PaginatedDataSchema, PaginationQuerySchema } from "./common";
import {
    AdminCommissionStrategyStatusEnum,
    AdminCommissionStrategyVersionStatusEnum,
    AssignmentTypeEnum,
    OrderStatusEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    ServiceOfferingDraftStatusEnum,
    ServiceOfferingPublicationStatusEnum,
    ServiceCategoriesSchema,
    TransactionTypeEnum,
    UserRoleEnum,
    WithdrawalPayeeAccountTypeEnum,
    WithdrawalStatusEnum,
} from "./database-entity";
import { FileAccessInfoSchema } from "./work-skill";
import { ServiceTagDomainEnum } from "./service-tag";

/**
 * 管理员登录请求
 */
export const AdminLoginRequestSchema = z
    .object({
        email: z.email("请输入有效的管理员邮箱").describe("管理员邮箱"),
        password: z.string().min(6, "密码至少 6 位").describe("登录密码"),
        rememberMe: z.boolean().optional().describe("记住登录状态标记"),
    })
    .describe("管理员登录请求体");

export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

/**
 * 管理员基础资料
 */
export const AdminProfileSchema = z
    .object({
        id: z.string().describe("管理员用户 ID"),
        email: z.string().email().describe("管理员邮箱"),
        name: z.string().nullable().optional().describe("管理员姓名"),
        roles: z.array(UserRoleEnum).describe("管理员角色列表"),
    })
    .describe("管理员登录后的基础资料");

export type AdminProfile = z.infer<typeof AdminProfileSchema>;

/**
 * 管理员登出响应
 */
export const AdminLogoutResponseSchema = z
    .object({
        success: z.boolean().describe("是否登出成功"),
    })
    .describe("管理员登出响应");

export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>;

/**
 * 仪表盘查询支持的时间范围
 */
export const AdminDashboardRangeSchema = z
    .enum(["7d", "30d", "90d"])
    .describe("仪表盘统计的时间范围，单位为天");

export type AdminDashboardRange = z.infer<typeof AdminDashboardRangeSchema>;

const IsoDateTimeStringSchema = z
    .string()
    .datetime({ offset: true })
    .describe("ISO 时间字符串");

const AdminDashboardCurrencySchema = z
    .object({
        amount: z.number().describe("数值"),
        currency: z.string().min(1).max(3).default("CNY").describe("币种"),
    })
    .describe("金额信息");

export const AdminDashboardTrendPointSchema = z
    .object({
        date: z
            .string()
            .regex(/\d{4}-\d{2}-\d{2}/, "日期格式必须为 YYYY-MM-DD")
            .describe("统计日期"),
        orderCount: z.number().int().nonnegative().describe("该日订单数量"),
        revenue: z.number().describe("该日净收益，退款为负值"),
    })
    .describe("按日期的订单/收益统计");

export const AdminDashboardPeriodSummarySchema = z
    .object({
        range: AdminDashboardRangeSchema,
        startDate: IsoDateTimeStringSchema,
        endDate: IsoDateTimeStringSchema,
        orderCount: z
            .number()
            .int()
            .nonnegative()
            .describe("时间范围内的订单数"),
        revenue: AdminDashboardCurrencySchema.describe("时间范围内的净收益"),
    })
    .describe("指定时间范围的汇总信息");

export const AdminDashboardOverviewSchema = z
    .object({
        totals: z
            .object({
                registeredUsers: z
                    .number()
                    .int()
                    .nonnegative()
                    .describe("平台注册用户数"),
                servicePersonnel: z
                    .number()
                    .int()
                    .nonnegative()
                    .describe("服务人员总数"),
                totalRevenue:
                    AdminDashboardCurrencySchema.describe("平台全量收益"),
            })
            .describe("平台总览指标"),
        period: AdminDashboardPeriodSummarySchema,
        charts: z
            .object({
                daily: z
                    .array(AdminDashboardTrendPointSchema)
                    .describe("趋势图数据"),
            })
            .describe("图表数据"),
        generatedAt: IsoDateTimeStringSchema.describe("生成时间"),
    })
    .describe("管理员仪表盘总览数据");

export type AdminDashboardOverview = z.infer<
    typeof AdminDashboardOverviewSchema
>;

export type AdminDashboardPeriodSummary = z.infer<
    typeof AdminDashboardPeriodSummarySchema
>;

export type AdminDashboardTrendPoint = z.infer<
    typeof AdminDashboardTrendPointSchema
>;

export const AdminDashboardOverviewQuerySchema = z
    .object({
        range: AdminDashboardRangeSchema.default("30d"),
    })
    .describe("管理员仪表盘查询参数");

export type AdminDashboardOverviewQuery = z.infer<
    typeof AdminDashboardOverviewQuerySchema
>;

const AdminUserStatusSchema = z
    .enum(["active", "inactive"])
    .describe("用户状态：active-启用，inactive-禁用");

export type AdminUserStatus = z.infer<typeof AdminUserStatusSchema>;

export const AdminUserProfileSchema = z
    .object({
        realName: z.string().nullable().optional().describe("实名信息"),
        idCardNumber: z
            .string()
            .nullable()
            .optional()
            .describe("实名认证身份证号"),
    })
    .describe("用户扩展资料");

export type AdminUserProfile = z.infer<typeof AdminUserProfileSchema>;

export const AdminUserOrdersSummarySchema = z
    .object({
        totalOrders: z.number().int().nonnegative().describe("累计订单数"),
        completedOrders: z
            .number()
            .int()
            .nonnegative()
            .describe("已完成订单数"),
        cancelledOrders: z.number().int().nonnegative().describe("取消订单数"),
        totalSpent: AdminDashboardCurrencySchema.describe("总消费金额"),
        lastOrderAt:
            IsoDateTimeStringSchema.nullable().describe("最近下单时间"),
    })
    .describe("管理员用户订单统计");

export type AdminUserOrdersSummary = z.infer<
    typeof AdminUserOrdersSummarySchema
>;

const AdminUserBaseSchema = z
    .object({
        id: z.string().describe("用户 ID"),
        name: z.string().nullable().describe("用户名"),
        email: z.email().describe("邮箱"),
        phoneNumber: z.string().nullable().describe("手机号"),
        role: z.array(UserRoleEnum).describe("角色"),
        isActive: z.boolean().describe("是否启用"),
        createdAt: IsoDateTimeStringSchema.describe("创建时间"),
        updatedAt: IsoDateTimeStringSchema.describe("更新时间"),
        emailVerified: z.boolean().describe("邮箱是否验证"),
        phoneNumberVerified: z.boolean().describe("手机号是否验证"),
        profile: AdminUserProfileSchema.optional().describe("扩展资料"),
    })
    .describe("管理员用户基础信息");

export const AdminUserListItemSchema = AdminUserBaseSchema.extend({
    stats: AdminUserOrdersSummarySchema.describe("订单汇总"),
}).describe("管理员用户列表项");

export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AdminUserDetailSchema = AdminUserBaseSchema.extend({
    stats: AdminUserOrdersSummarySchema.describe("订单统计"),
}).describe("管理员用户详情");

export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminUserListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        name: z.string().optional().describe("用户名模糊搜索"),
        role: UserRoleEnum.optional().describe("角色筛选"),
        phone: z.string().optional().describe("手机号筛选"),
        status: AdminUserStatusSchema.optional().describe("账户状态"),
    })
    .describe("管理员用户列表查询参数");

export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const AdminUpdateUserStatusSchema = z
    .object({
        isActive: z.boolean().describe("是否启用"),
    })
    .describe("管理员更新用户状态请求");

export type AdminUpdateUserStatus = z.infer<typeof AdminUpdateUserStatusSchema>;

export const AdminUpdateUserRoleSchema = z
    .object({
        role: UserRoleEnum.describe("新的角色"),
    })
    .describe("管理员更新用户角色请求");

export type AdminUpdateUserRole = z.infer<typeof AdminUpdateUserRoleSchema>;

const AdminOrderCustomerSchema = z
    .object({
        id: z.string().describe("用户 ID"),
        name: z.string().nullable().describe("用户名"),
        email: z.string().email().describe("邮箱"),
        phoneNumber: z.string().nullable().describe("手机号"),
    })
    .describe("下单用户信息");

const AdminOrderServicePersonnelSchema = z
    .object({
        id: z.string().describe("服务人员用户 ID"),
        name: z.string().nullable().describe("姓名"),
        phoneNumber: z.string().nullable().describe("手机号"),
    })
    .describe("服务人员信息");

const AdminOrderServiceSummarySchema = z
    .object({
        id: z.string().describe("服务 ID"),
        name: z.string().describe("服务名称"),
        categoryId: z.string().nullable().describe("服务分类 ID"),
        categoryName: z.string().nullable().describe("服务分类名称"),
    })
    .describe("服务信息");

export const AdminOrderListItemSchema = z
    .object({
        id: z.string().describe("订单 ID"),
        orderSerial: z.string().describe("订单编号"),
        status: OrderStatusEnum.describe("订单状态"),
        createdAt: IsoDateTimeStringSchema.describe("创建时间"),
        appointmentTime: IsoDateTimeStringSchema.describe("预约时间"),
        totalAmount: AdminDashboardCurrencySchema.describe("订单总金额"),
        paidAmount: AdminDashboardCurrencySchema.describe("已支付金额"),
        paymentStatus: PaymentStatusEnum.describe("支付状态"),
        assignmentType: AssignmentTypeEnum.nullable().describe("分配方式"),
        customer: AdminOrderCustomerSchema.describe("下单用户"),
        servicePersonnel:
            AdminOrderServicePersonnelSchema.nullable().describe("服务人员"),
        service: AdminOrderServiceSummarySchema.describe("服务信息"),
        canUpdateStatus: z.boolean().describe("管理员是否可继续流转状态"),
    })
    .describe("管理员订单列表项");

export type AdminOrderListItem = z.infer<typeof AdminOrderListItemSchema>;

export const AdminOrderListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        orderSerial: z.string().optional().describe("订单编号关键词"),
        customerKeyword: z
            .string()
            .optional()
            .describe("用户(姓名/手机号)关键词"),
        servicePersonnelKeyword: z
            .string()
            .optional()
            .describe("服务人员关键词"),
        status: OrderStatusEnum.optional().describe("订单状态"),
        assignmentType: AssignmentTypeEnum.optional().describe("分配方式"),
        startDate: IsoDateTimeStringSchema.optional().describe("开始时间"),
        endDate: IsoDateTimeStringSchema.optional().describe("结束时间"),
        minAmount: z
            .number()
            .nonnegative()
            .optional()
            .describe("最小金额（元）"),
        maxAmount: z
            .number()
            .nonnegative()
            .optional()
            .describe("最大金额（元）"),
        sortBy: z
            .enum(["createdAt", "appointmentTime", "totalAmount"])
            .optional()
            .describe("排序字段"),
        sortOrder: z.enum(["asc", "desc"]).optional().describe("排序方式"),
    })
    .refine(
        (value) =>
            !value.startDate ||
            !value.endDate ||
            new Date(value.startDate) <= new Date(value.endDate),
        {
            message: "开始时间必须早于结束时间",
            path: ["endDate"],
        },
    )
    .refine(
        (value) =>
            value.minAmount === undefined ||
            value.maxAmount === undefined ||
            value.minAmount <= value.maxAmount,
        {
            message: "最小金额不能大于最大金额",
            path: ["maxAmount"],
        },
    )
    .describe("管理员订单查询参数");

export type AdminOrderListQuery = z.infer<typeof AdminOrderListQuerySchema>;

export const AdminOrderListResponseSchema = PaginatedDataSchema(
    AdminOrderListItemSchema,
).describe("管理员订单列表响应");

export type AdminOrderListResponse = z.infer<
    typeof AdminOrderListResponseSchema
>;

export const AdminUpdateOrderStatusSchema = z
    .object({
        status: OrderStatusEnum.describe("目标订单状态"),
    })
    .describe("管理员单条订单状态更新请求");

export type AdminUpdateOrderStatus = z.infer<
    typeof AdminUpdateOrderStatusSchema
>;

export const AdminBulkUpdateOrderStatusSchema = z
    .object({
        orderIds: z
            .array(z.string().min(1))
            .min(1)
            .describe("需要更新的订单 ID 列表"),
        status: OrderStatusEnum.describe("目标订单状态"),
    })
    .describe("管理员批量更新订单状态请求");

export type AdminBulkUpdateOrderStatus = z.infer<
    typeof AdminBulkUpdateOrderStatusSchema
>;

export const AdminBulkUpdateOrderStatusResultSchema = z
    .object({
        updated: z.number().int().nonnegative().describe("成功更新的订单数量"),
        failed: z
            .array(
                z
                    .object({
                        orderId: z.string().describe("失败的订单ID"),
                        message: z.string().describe("失败原因"),
                    })
                    .describe("失败记录"),
            )
            .default([])
            .describe("失败记录列表"),
    })
    .describe("批量更新订单状态的结果");

export type AdminBulkUpdateOrderStatusResult = z.infer<
    typeof AdminBulkUpdateOrderStatusResultSchema
>;

// =========================
// 服务上架审核管理
// =========================

export const ServiceOfferingLifecycleEnum = z
    .enum([
        "pending_review",
        "rejected",
        "active",
        "taken_down",
        "appeal_pending",
    ])
    .describe(
        "服务生命周期：待审核/已拒绝/已上架/已下架/申诉待处理",
    );

export type ServiceOfferingLifecycle = z.infer<
    typeof ServiceOfferingLifecycleEnum
>;

export const ServiceOfferingLifecycleFilterEnum = z
    .enum([
        "all",
        "pending_review",
        "rejected",
        "active",
        "taken_down",
        "appeal_pending",
    ])
    .describe("服务生命周期筛选");

export type ServiceOfferingLifecycleFilter = z.infer<
    typeof ServiceOfferingLifecycleFilterEnum
>;

export const AdminServiceOfferingListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        keyword: z.string().trim().optional().describe("服务人员或服务关键词"),
        lifecycle: ServiceOfferingLifecycleFilterEnum.default("all").describe(
            "生命周期筛选",
        ),
    })
    .describe("管理员服务上架审核列表查询参数");

export type AdminServiceOfferingListQuery = z.infer<
    typeof AdminServiceOfferingListQuerySchema
>;

export const AdminServiceOfferingReasonSchema = z
    .object({
        reason: z
            .string()
            .trim()
            .min(1, "原因不能为空")
            .max(500, "原因不能超过 500 个字符"),
    })
    .describe("管理员服务审核或下架原因");

export type AdminServiceOfferingReason = z.infer<
    typeof AdminServiceOfferingReasonSchema
>;

export const AdminServiceOfferingApproveSchema = z
    .object({
        draftId: z.string().min(1, "草稿ID不能为空"),
    })
    .describe("管理员通过服务上架审核请求");

export type AdminServiceOfferingApprove = z.infer<
    typeof AdminServiceOfferingApproveSchema
>;

export const AdminServiceOfferingRejectSchema =
    AdminServiceOfferingReasonSchema.extend({
        draftId: z.string().min(1, "草稿ID不能为空"),
    }).describe("管理员拒绝服务上架审核请求");

export type AdminServiceOfferingReject = z.infer<
    typeof AdminServiceOfferingRejectSchema
>;

export const AdminServiceOfferingTakeDownSchema =
    AdminServiceOfferingReasonSchema.extend({
        personnelUserId: z.string().min(1, "服务人员用户ID不能为空"),
        serviceId: z.string().min(1, "服务ID不能为空"),
    }).describe("管理员下架服务请求");

export type AdminServiceOfferingTakeDown = z.infer<
    typeof AdminServiceOfferingTakeDownSchema
>;

export const AdminServiceOfferingRestoreSchema = z
    .object({
        personnelUserId: z.string().min(1, "服务人员用户ID不能为空"),
        serviceId: z.string().min(1, "服务ID不能为空"),
    })
    .describe("管理员恢复已下架服务请求");

export type AdminServiceOfferingRestore = z.infer<
    typeof AdminServiceOfferingRestoreSchema
>;

export const AdminServiceOfferingPersonnelSummarySchema = z
    .object({
        id: z.string().describe("服务人员用户 ID"),
        name: z.string().nullable().describe("服务人员姓名"),
        phoneNumber: z.string().nullable().describe("服务人员手机号"),
        merchantQualificationFileId: z
            .string()
            .nullable()
            .optional()
            .describe("商家资质文件 ID"),
        vocationalQualificationFileId: z
            .string()
            .nullable()
            .optional()
            .describe("职业资质文件 ID"),
        merchantQualification: FileAccessInfoSchema.nullable()
            .optional()
            .describe("商家资质文件访问数据"),
        vocationalQualification: FileAccessInfoSchema.nullable()
            .optional()
            .describe("职业资质文件访问数据"),
    })
    .describe("服务人员摘要");

export type AdminServiceOfferingPersonnelSummary = z.infer<
    typeof AdminServiceOfferingPersonnelSummarySchema
>;

export const AdminServiceOfferingServiceSummarySchema = z
    .object({
        id: z.string().describe("服务 ID"),
        name: z.string().describe("服务名称"),
        categoryId: z.string().nullable().optional().describe("服务分类 ID"),
        categoryName: z
            .string()
            .nullable()
            .optional()
            .describe("服务分类名称"),
        description: z.string().nullable().optional().describe("服务人员端服务描述"),
        galleryFileIds: z
            .array(z.string())
            .default([])
            .describe("宣传图文件 ID 列表"),
        gallery: z
            .array(FileAccessInfoSchema)
            .default([])
            .describe("宣传图访问数据"),
    })
    .describe("服务摘要");

export type AdminServiceOfferingServiceSummary = z.infer<
    typeof AdminServiceOfferingServiceSummarySchema
>;

export const AdminServiceOfferingSpecificationSchema = z
    .object({
        id: z.string().describe("规格 ID"),
        name: z.string().nullable().optional().describe("规格名称"),
        serviceId: z.string().describe("服务 ID"),
        price: z.string().describe("规格价格"),
        currency: z.string().describe("币种"),
        estimatedDurationMinutes: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional()
            .describe("预计耗时分钟数"),
        isActive: z.boolean().describe("是否有效"),
    })
    .describe("管理员服务规格摘要");

export type AdminServiceOfferingSpecification = z.infer<
    typeof AdminServiceOfferingSpecificationSchema
>;

export const AdminServiceOfferingAppealSummarySchema = z
    .object({
        id: z.string().min(1, "申诉ID不能为空"),
        status: z.enum(["pending", "approved", "rejected", "canceled"]),
        appealReason: z.string(),
        reviewResultReason: z.string().nullable(),
        takeDownReasonSnapshot: z.string().nullable(),
        takenDownAtSnapshot: IsoDateTimeStringSchema,
        createdAt: IsoDateTimeStringSchema,
        reviewedAt: IsoDateTimeStringSchema.nullable(),
    })
    .describe("服务下架申诉摘要");

export type AdminServiceOfferingAppealSummary = z.infer<
    typeof AdminServiceOfferingAppealSummarySchema
>;

export const AdminServiceOfferingDraftListItemSchema = z
    .object({
        draftId: z.string().describe("草稿 ID"),
        personnel: AdminServiceOfferingPersonnelSummarySchema,
        reviewStatus: ServiceOfferingDraftStatusEnum.describe("审核状态"),
        lifecycle: ServiceOfferingLifecycleEnum.describe("生命周期阶段"),
        rejectionReason: z.string().nullable().optional().describe("拒绝原因"),
        submittedSnapshot: z.unknown().describe("提交快照"),
        reviewedBy: z.string().nullable().optional().describe("审核人用户 ID"),
        reviewedAt: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("审核时间"),
        createdAt: IsoDateTimeStringSchema.describe("提交时间"),
        updatedAt: IsoDateTimeStringSchema.describe("更新时间"),
    })
    .describe("管理员服务待审核草稿列表项");

export type AdminServiceOfferingDraftListItem = z.infer<
    typeof AdminServiceOfferingDraftListItemSchema
>;

export const AdminServiceOfferingPublishedListItemSchema = z
    .object({
        personnel: AdminServiceOfferingPersonnelSummarySchema,
        service: AdminServiceOfferingServiceSummarySchema,
        specifications: z
            .array(AdminServiceOfferingSpecificationSchema)
            .default([])
            .describe("服务规格列表"),
        reviewStatus: ServiceOfferingDraftStatusEnum.describe("最近审核状态"),
        publicationStatus:
            ServiceOfferingPublicationStatusEnum.describe("发布状态"),
        lifecycle: ServiceOfferingLifecycleEnum.describe("生命周期阶段"),
        takeDownReason: z.string().nullable().optional().describe("下架原因"),
        takenDownBy: z
            .string()
            .nullable()
            .optional()
            .describe("下架操作人用户 ID"),
        takenDownAt: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("下架时间"),
        lastApprovedDraftId: z
            .string()
            .nullable()
            .optional()
            .describe("最近通过审核的草稿 ID"),
        lastApprovedAt: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("最近通过审核时间"),
        appeal: AdminServiceOfferingAppealSummarySchema.nullable()
            .optional()
            .describe("当前下架轮次的最新申诉"),
        createdAt: IsoDateTimeStringSchema.describe("创建时间"),
        updatedAt: IsoDateTimeStringSchema.describe("更新时间"),
    })
    .describe("管理员已上架服务列表项");

export type AdminServiceOfferingPublishedListItem = z.infer<
    typeof AdminServiceOfferingPublishedListItemSchema
>;

export const AdminServiceOfferingListItemSchema = z.discriminatedUnion("kind", [
    AdminServiceOfferingDraftListItemSchema.extend({
        kind: z.literal("draft"),
    }),
    AdminServiceOfferingPublishedListItemSchema.extend({
        kind: z.literal("published"),
    }),
]);

export type AdminServiceOfferingListItem = z.infer<
    typeof AdminServiceOfferingListItemSchema
>;

export const AdminServiceOfferingDraftListResponseSchema = PaginatedDataSchema(
    AdminServiceOfferingDraftListItemSchema,
).describe("管理员服务待审核列表响应");

export type AdminServiceOfferingDraftListResponse = z.infer<
    typeof AdminServiceOfferingDraftListResponseSchema
>;

export const AdminServiceOfferingPublishedListResponseSchema =
    PaginatedDataSchema(AdminServiceOfferingPublishedListItemSchema).describe(
        "管理员已上架服务列表响应",
    );

export type AdminServiceOfferingPublishedListResponse = z.infer<
    typeof AdminServiceOfferingPublishedListResponseSchema
>;

export const AdminServiceOfferingListResponseSchema = PaginatedDataSchema(
    AdminServiceOfferingListItemSchema,
).describe("管理员服务上架审核统一列表响应");

export type AdminServiceOfferingListResponse = z.infer<
    typeof AdminServiceOfferingListResponseSchema
>;

// =========================
// 服务分类管理
// =========================

const AdminServiceCategoryBaseSchema = z
    .object({
        ...ServiceCategoriesSchema.shape,
        iconFileUrl: z.string().nullable().optional().describe("图标访问地址"),
    })
    .describe("管理员服务分类基础信息");

function createAdminServiceCategoryTreeSchema(
    maxDepth = 2,
    current = 1,
): z.ZodType<any> {
    if (current >= maxDepth) {
        return z.object({
            ...AdminServiceCategoryBaseSchema.shape,
            children: z
                .array(z.never())
                .default([])
                .describe("叶子分类不包含子项"),
        });
    }

    return z.object({
        ...AdminServiceCategoryBaseSchema.shape,
        children: z
            .array(createAdminServiceCategoryTreeSchema(maxDepth, current + 1))
            .default([])
            .describe("子分类列表"),
    });
}

export const AdminServiceCategorySchema = AdminServiceCategoryBaseSchema;

export type AdminServiceCategory = z.infer<typeof AdminServiceCategorySchema>;

export const AdminServiceCategoryTreeSchema =
    createAdminServiceCategoryTreeSchema();

export type AdminServiceCategoryTree = z.infer<
    typeof AdminServiceCategoryTreeSchema
>;

export const AdminServiceCategoryListResponseSchema = z
    .object({
        tree: z.array(AdminServiceCategoryTreeSchema).describe("树形分类结构"),
        flat: z
            .array(AdminServiceCategorySchema)
            .describe("按排序拍平的分类列表"),
    })
    .describe("管理员服务分类列表响应");

export type AdminServiceCategoryListResponse = z.infer<
    typeof AdminServiceCategoryListResponseSchema
>;

const AdminServiceCategoryEditableSchema = z.object({
    name: ServiceCategoriesSchema.shape.name
        .min(1, "分类名称不能为空")
        .describe("分类名称"),
    parentId: ServiceCategoriesSchema.shape.parentId
        .optional()
        .describe("父分类 ID"),
    description: ServiceCategoriesSchema.shape.description
        .optional()
        .describe("分类描述"),
    isActive: ServiceCategoriesSchema.shape.isActive
        .optional()
        .describe("是否启用"),
    sortOrder: ServiceCategoriesSchema.shape.sortOrder
        .optional()
        .describe("排序值"),
    commissionRate: ServiceCategoriesSchema.shape.commissionRate
        .optional()
        .describe("平台抽成比例"),
    iconFileId: ServiceCategoriesSchema.shape.iconFileId
        .optional()
        .describe("分类图标文件 ID"),
});

export const CreateAdminServiceCategorySchema =
    AdminServiceCategoryEditableSchema.describe("创建服务分类请求");

export type CreateAdminServiceCategoryInput = z.infer<
    typeof CreateAdminServiceCategorySchema
>;

export const UpdateAdminServiceCategorySchema =
    AdminServiceCategoryEditableSchema.partial().describe("更新服务分类请求");

export type UpdateAdminServiceCategoryInput = z.infer<
    typeof UpdateAdminServiceCategorySchema
>;

// =========================
// 服务分类抽成策略管理
// =========================

const AdminCommissionStrategyRuleThresholdSchema = z
    .number()
    .nonnegative()
    .multipleOf(0.01, "规则阈值最多支持两位小数")
    .describe("规则阈值（>= 0）");

const AdminCommissionStrategyRuleRateSchema = z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("抽成比例（0-100）");

const AdminCommissionStrategyProtectionPeriodDaysSchema = z
    .number()
    .int()
    .min(1)
    .describe("保护期天数（>= 1）");

const AdminCommissionStrategyMonthlyIncomeThresholdSchema = z
    .number()
    .nonnegative()
    .multipleOf(0.01, "月收入阈值最多支持两位小数")
    .describe("保护期月收入阈值（>= 0）");

const AdminCommissionStrategyFixedCommissionRateSchema = z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("保护期固定抽成比例（0-100）");

export const AdminCommissionStrategyRuleSchema = z
    .object({
        id: z.string().min(1, "规则 ID 不能为空").describe("规则 ID"),
        threshold: AdminCommissionStrategyRuleThresholdSchema,
        commissionRate: AdminCommissionStrategyRuleRateSchema,
        isEnabled: z.boolean().default(true).describe("规则是否启用"),
        sortOrder: z.number().int().nonnegative().default(0).describe("排序"),
    })
    .describe("管理员抽成策略规则");

export type AdminCommissionStrategyRule = z.infer<
    typeof AdminCommissionStrategyRuleSchema
>;

export const AdminCommissionStrategyBeginnerProtectionSchema = z
    .object({
        isEnabled: z.boolean().describe("是否启用新手保护期"),
        protectionDays: AdminCommissionStrategyProtectionPeriodDaysSchema,
        monthlyIncomeThreshold: AdminCommissionStrategyMonthlyIncomeThresholdSchema,
        fixedCommissionRate: AdminCommissionStrategyFixedCommissionRateSchema,
    })
    .describe("新手保护期配置");

export type AdminCommissionStrategyBeginnerProtection = z.infer<
    typeof AdminCommissionStrategyBeginnerProtectionSchema
>;

export const AdminCommissionStrategyVersionSchema = z
    .object({
        id: z.string().describe("版本 ID"),
        strategyId: z.string().describe("策略 ID"),
        versionNo: z.number().int().positive().describe("版本号"),
        status: AdminCommissionStrategyVersionStatusEnum.describe("版本状态"),
        versionNote: z.string().nullable().optional().describe("版本备注"),
        effectiveFrom: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("生效开始时间"),
        effectiveTo: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("生效结束时间"),
        beginnerProtection:
            AdminCommissionStrategyBeginnerProtectionSchema.describe(
                "版本级新手保护期配置",
            ),
        publishedAt: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("发布时间"),
        createdAt: IsoDateTimeStringSchema.describe("创建时间"),
        updatedAt: IsoDateTimeStringSchema.describe("更新时间"),
        rules: z.array(AdminCommissionStrategyRuleSchema).default([]),
    })
    .describe("管理员抽成策略版本");

export type AdminCommissionStrategyVersion = z.infer<
    typeof AdminCommissionStrategyVersionSchema
>;

export const AdminCommissionStrategySchema = z
    .object({
        id: z.string().describe("策略 ID"),
        categoryId: z.string().describe("服务分类 ID"),
        strategyName: z.string().describe("策略名称"),
        status: AdminCommissionStrategyStatusEnum.describe("策略状态"),
        currentVersionId: z.string().nullable().optional().describe("当前生效版本 ID"),
        publishedAt: IsoDateTimeStringSchema.nullable()
            .optional()
            .describe("策略发布时间"),
        createdAt: IsoDateTimeStringSchema.describe("创建时间"),
        updatedAt: IsoDateTimeStringSchema.describe("更新时间"),
        versions: z.array(AdminCommissionStrategyVersionSchema).default([]),
    })
    .describe("管理员抽成策略");

export type AdminCommissionStrategy = z.infer<
    typeof AdminCommissionStrategySchema
>;

export const AdminCommissionStrategyDraftSchema = z
    .object({
        categoryId: z.string().min(1, "categoryId 不能为空").describe("服务分类 ID"),
        draftVersionId: z
            .string()
            .min(1, "draftVersionId 不能为空")
            .describe("草稿版本 ID"),
        beginnerProtection:
            AdminCommissionStrategyBeginnerProtectionSchema.describe(
                "新手保护期配置",
            ),
        rules: z
            .array(AdminCommissionStrategyRuleSchema)
            .min(1, "至少提供一条规则")
            .describe("规则列表"),
    })
    .describe("抽成策略草稿主契约");

export type AdminCommissionStrategyDraft = z.infer<
    typeof AdminCommissionStrategyDraftSchema
>;

const AdminCommissionStrategyDraftUpsertInputSchema =
    AdminCommissionStrategyDraftSchema.omit({
        draftVersionId: true,
    }).describe("创建/保存抽成策略草稿输入");

export const CreateAdminCommissionStrategyDraftSchema =
    AdminCommissionStrategyDraftUpsertInputSchema;

export type CreateAdminCommissionStrategyDraftInput =
    z.infer<typeof CreateAdminCommissionStrategyDraftSchema>;

export const SaveAdminCommissionStrategyDraftSchema =
    AdminCommissionStrategyDraftUpsertInputSchema.describe(
        "保存抽成策略草稿输入；仅有已发布版本且无草稿时，服务端会先复制已发布版本为新草稿，再应用本次输入覆盖",
    );

export type SaveAdminCommissionStrategyDraftInput = z.infer<
    typeof SaveAdminCommissionStrategyDraftSchema
>;

export const AdminCommissionStrategyPublishInputSchema = z
    .object({
        categoryId: z.string().min(1, "categoryId 不能为空").describe("服务分类 ID"),
        publishReason: z
            .string()
            .max(500, "publishReason 长度不能超过 500")
            .optional()
            .describe("发布说明"),
    })
    .describe("发布抽成策略请求");

export type AdminCommissionStrategyPublishInput = z.infer<
    typeof AdminCommissionStrategyPublishInputSchema
>;

export const AdminCommissionStrategyDetailSchema = z
    .object({
        categoryId: z.string().describe("服务分类 ID"),
        categoryName: z.string().describe("服务分类名称"),
        fixedCommissionRate: AdminCommissionStrategyRuleRateSchema.describe(
            "分类固定抽成比例",
        ),
        strategyId: z.string().nullable().describe("策略 ID"),
        strategyName: z.string().nullable().describe("策略名称"),
        status: AdminCommissionStrategyStatusEnum.nullable().describe(
            "策略当前状态",
        ),
        draftVersion: AdminCommissionStrategyVersionSchema.nullable().describe(
            "当前草稿版本",
        ),
        currentPublishedVersion:
            AdminCommissionStrategyVersionSchema.nullable().describe(
                "当前已发布版本",
            ),
    })
    .describe("管理员抽成策略详情");

export type AdminCommissionStrategyDetail = z.infer<
    typeof AdminCommissionStrategyDetailSchema
>;

export const AdminCommissionStrategySimulationRuleTypeSchema = z
    .enum(["fixed", "dynamic", "beginner-protection"])
    .describe("试算命中规则类型");

export type AdminCommissionStrategySimulationRuleType = z.infer<
    typeof AdminCommissionStrategySimulationRuleTypeSchema
>;

export const AdminCommissionStrategySimulationInputSchema = z
    .object({
        categoryId: z.string().min(1, "categoryId 不能为空").describe("服务分类 ID"),
        workerId: z.string().min(1, "workerId 不能为空").describe("服务人员 ID"),
        settlementDate: IsoDateTimeStringSchema.describe("试算结算时间"),
        monthlyIncomeBeforeSettlement:
            AdminCommissionStrategyMonthlyIncomeThresholdSchema.describe(
                "结算前当月已入账收益",
            ),
        isWithinBeginnerProtection: z
            .boolean()
            .describe("是否处于新手保护期"),
    })
    .describe("抽成策略试算输入");

export type AdminCommissionStrategySimulationInput = z.infer<
    typeof AdminCommissionStrategySimulationInputSchema
>;

export const AdminCommissionStrategySimulationResultSchema = z
    .object({
        categoryId: z.string().describe("服务分类 ID"),
        strategyVersionId: z.string().nullable().describe("命中的策略版本 ID"),
        ruleType: AdminCommissionStrategySimulationRuleTypeSchema,
        commissionRate: AdminCommissionStrategyRuleRateSchema.describe(
            "最终抽成比例",
        ),
        matchedRuleId: z.string().nullable().describe("命中的动态规则 ID"),
        matchedThreshold:
            AdminCommissionStrategyRuleThresholdSchema.nullable().describe(
                "命中的动态规则门槛",
            ),
        fixedCommissionRate: AdminCommissionStrategyRuleRateSchema.describe(
            "分类固定抽成比例",
        ),
        monthlyIncomeBeforeSettlement:
            AdminCommissionStrategyMonthlyIncomeThresholdSchema.describe(
                "结算前当月已入账收益",
            ),
        isWithinBeginnerProtection: z
            .boolean()
            .describe("试算时是否处于新手保护期"),
        settlementDate: IsoDateTimeStringSchema.describe("试算结算时间"),
    })
    .describe("抽成策略试算结果");

export type AdminCommissionStrategySimulationResult = z.infer<
    typeof AdminCommissionStrategySimulationResultSchema
>;

// =========================
// 平台收益流水
// =========================

export const AdminRevenueDirectionSchema = z
    .enum(["income", "expense"])
    .describe("收入方向：income 表示收入，expense 表示支出");

export type AdminRevenueDirection = z.infer<typeof AdminRevenueDirectionSchema>;

export const AdminRevenueLogOrderRefSchema = z
    .object({
        id: z.string().describe("关联订单 ID"),
        orderSerial: z.string().nullable().describe("关联订单编号"),
        status: OrderStatusEnum.nullable().describe("关联订单状态"),
    })
    .describe("关联订单信息");

export type AdminRevenueLogOrderRef = z.infer<
    typeof AdminRevenueLogOrderRefSchema
>;

export const AdminRevenueLogUserRefSchema = z
    .object({
        id: z.string().describe("关联用户 ID"),
        name: z.string().nullable().describe("用户姓名"),
        email: z.string().nullable().describe("用户邮箱"),
        phoneNumber: z.string().nullable().describe("用户手机号"),
    })
    .describe("关联用户信息");

export type AdminRevenueLogUserRef = z.infer<
    typeof AdminRevenueLogUserRefSchema
>;

export const AdminRevenueLogSchema = z
    .object({
        id: z.string().describe("收益流水 ID"),
        transactionType: TransactionTypeEnum.describe("交易类型"),
        direction: AdminRevenueDirectionSchema.describe("金额方向"),
        amount: AdminDashboardCurrencySchema.describe("金额"),
        description: z.string().nullable().describe("流水描述"),
        referenceId: z.string().nullable().describe("外部引用号"),
        createdAt: IsoDateTimeStringSchema.describe("记录时间"),
        metadata: z.string().nullable().describe("元数据"),
        order: AdminRevenueLogOrderRefSchema.nullable().describe("关联订单"),
        user: AdminRevenueLogUserRefSchema.nullable().describe("关联用户"),
        withdrawal: z
            .object({
                id: z.string().describe("提现记录 ID"),
                status: WithdrawalStatusEnum.describe("提现状态"),
            })
            .nullable()
            .describe("关联提现记录"),
    })
    .describe("平台收益流水记录");

export type AdminRevenueLog = z.infer<typeof AdminRevenueLogSchema>;

export const AdminRevenueLogListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        startDate: IsoDateTimeStringSchema.optional().describe("开始时间"),
        endDate: IsoDateTimeStringSchema.optional().describe("结束时间"),
        minAmount: z.number().nonnegative().optional().describe("最小金额"),
        maxAmount: z.number().nonnegative().optional().describe("最大金额"),
        transactionType: TransactionTypeEnum.optional().describe("交易类型"),
        direction:
            AdminRevenueDirectionSchema.optional().describe("金额方向筛选"),
    })
    .refine(
        (value) =>
            !value.startDate ||
            !value.endDate ||
            new Date(value.startDate) <= new Date(value.endDate),
        {
            path: ["endDate"],
            message: "结束时间必须晚于开始时间",
        },
    )
    .refine(
        (value) =>
            value.minAmount === undefined ||
            value.maxAmount === undefined ||
            value.minAmount <= value.maxAmount,
        {
            path: ["maxAmount"],
            message: "最小金额不能大于最大金额",
        },
    )
    .describe("收益流水查询参数");

export type AdminRevenueLogListQuery = z.infer<
    typeof AdminRevenueLogListQuerySchema
>;

export const AdminRevenueLogListResponseSchema = PaginatedDataSchema(
    AdminRevenueLogSchema,
).describe("收益流水分页响应");

export type AdminRevenueLogListResponse = z.infer<
    typeof AdminRevenueLogListResponseSchema
>;

// =========================
// 提现审核
// =========================

export const AdminWithdrawalUserSchema = z
    .object({
        id: z.string().describe("用户 ID"),
        name: z.string().nullable().describe("姓名"),
        email: z.string().nullable().describe("邮箱"),
        phoneNumber: z.string().nullable().describe("手机号"),
    })
    .describe("提现申请人信息");

export type AdminWithdrawalUser = z.infer<typeof AdminWithdrawalUserSchema>;

export const AdminWithdrawalReviewerSchema = z
    .object({
        id: z.string().describe("管理员 ID"),
        name: z.string().nullable().describe("管理员姓名"),
    })
    .describe("审核管理员信息");

export type AdminWithdrawalReviewer = z.infer<
    typeof AdminWithdrawalReviewerSchema
>;

export const AdminWithdrawalSchema = z
    .object({
        id: z.string().describe("提现记录 ID"),
        status: WithdrawalStatusEnum.describe("提现状态"),
        method: PaymentMethodEnum.describe("提现方式"),
        amount: AdminDashboardCurrencySchema.describe("提现金额"),
        payeeAccount: z.string().describe("收款账号"),
        payeeAccountType:
            WithdrawalPayeeAccountTypeEnum.describe("收款账号类型"),
        payeeName: z.string().nullable().describe("收款人姓名"),
        remark: z.string().nullable().describe("用户备注"),
        reviewNote: z.string().nullable().describe("审核备注"),
        requestedAt: IsoDateTimeStringSchema.describe("申请时间"),
        reviewedAt: IsoDateTimeStringSchema.nullable().describe("审核时间"),
        processedAt: IsoDateTimeStringSchema.nullable().describe(
            "进入终态时间（完成、失败、取消、驳回）",
        ),
        payoutReferenceId: z.string().nullable().describe("第三方打款流水号"),
        providerState: z.string().nullable().describe("渠道原始状态"),
        providerAppId: z.string().nullable().describe("渠道 appId"),
        providerBillNo: z.string().nullable().describe("渠道侧单号"),
        providerPackageInfo: z.string().nullable().describe("渠道补充信息"),
        providerMeta: z
            .record(z.string(), z.unknown())
            .nullable()
            .optional()
            .describe("渠道扩展元数据"),
        failureReason: z.string().nullable().describe("失败原因"),
        user: AdminWithdrawalUserSchema.nullable().describe("申请人"),
        reviewer:
            AdminWithdrawalReviewerSchema.nullable().describe("审核管理员"),
    })
    .describe("提现申请记录");

export type AdminWithdrawal = z.infer<typeof AdminWithdrawalSchema>;

export const AdminWithdrawalListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        startDate: IsoDateTimeStringSchema.optional().describe("开始时间"),
        endDate: IsoDateTimeStringSchema.optional().describe("结束时间"),
        minAmount: z.number().nonnegative().optional().describe("最小提现金额"),
        maxAmount: z.number().nonnegative().optional().describe("最大提现金额"),
        status: WithdrawalStatusEnum.optional().describe("提现状态"),
        method: PaymentMethodEnum.optional().describe("提现方式"),
        keyword: z
            .string()
            .min(1)
            .max(255)
            .optional()
            .describe("姓名/手机号/账号关键词"),
    })
    .refine(
        (value) =>
            !value.startDate ||
            !value.endDate ||
            new Date(value.startDate) <= new Date(value.endDate),
        {
            path: ["endDate"],
            message: "结束时间必须晚于开始时间",
        },
    )
    .refine(
        (value) =>
            value.minAmount === undefined ||
            value.maxAmount === undefined ||
            value.minAmount <= value.maxAmount,
        {
            path: ["maxAmount"],
            message: "最小金额不能大于最大金额",
        },
    )
    .describe("提现列表查询参数");

export type AdminWithdrawalListQuery = z.infer<
    typeof AdminWithdrawalListQuerySchema
>;

export const AdminWithdrawalListResponseSchema = PaginatedDataSchema(
    AdminWithdrawalSchema,
).describe("提现列表分页响应");

export type AdminWithdrawalListResponse = z.infer<
    typeof AdminWithdrawalListResponseSchema
>;

export const AdminReviewWithdrawalBodySchema = z
    .object({
        action: z
            .enum(["approve", "reject"])
            .describe("审核动作：approve=审核通过并触发打款，reject=驳回"),
        note: z
            .string()
            .max(1000, "备注不能超过 1000 字")
            .optional()
            .describe("审核备注"),
    })
    .refine(
        (value) =>
            value.action !== "reject" ||
            (typeof value.note === "string" && value.note.trim().length > 0),
        {
            path: ["note"],
            message: "驳回时必须填写备注",
        },
    )
    .describe("提现审核请求体");

export type AdminReviewWithdrawalBody = z.infer<
    typeof AdminReviewWithdrawalBodySchema
>;

// =========================
// 商户加盟申请管理
// =========================

export const AdminMerchantJoinRequestContactStatusSchema = z
    .enum(['all', 'contacted', 'uncontacted'])
    .describe('商户加盟申请联系状态筛选');

export type AdminMerchantJoinRequestContactStatus = z.infer<
    typeof AdminMerchantJoinRequestContactStatusSchema
>;

export const AdminMerchantJoinRequestSchema = z
    .object({
        id: z.string().max(255).describe('申请 ID'),
        merchantName: z.string().max(50).describe('姓名'),
        gender: z.enum(['male', 'female']).describe('性别'),
        phone: z.string().max(20).describe('手机号'),
        age: z.number().int().describe('年龄'),
        intentCity: z.string().max(255).describe('意向合作城市'),
        photoFileId: z.string().max(255).nullable().describe('照片文件 ID'),
        photoFileUrl: z.string().url().nullable().describe('照片访问地址'),
        isContacted: z.boolean().describe('是否已联系'),
        adminRemark: z.string().nullable().describe('管理员备注'),
        contactedAt: IsoDateTimeStringSchema.nullable().describe('联系时间'),
        createdAt: IsoDateTimeStringSchema.describe('创建时间'),
        updatedAt: IsoDateTimeStringSchema.describe('更新时间'),
    })
    .describe('管理员商户加盟申请记录');

export type AdminMerchantJoinRequest = z.infer<
    typeof AdminMerchantJoinRequestSchema
>;

export const AdminMerchantJoinRequestListQuerySchema = z
    .object({
        page: PaginationQuerySchema.shape.page.default(1),
        limit: PaginationQuerySchema.shape.limit.default(20),
        keyword: z.string().trim().max(255).optional().describe('姓名/手机号/城市关键词'),
        contactStatus: AdminMerchantJoinRequestContactStatusSchema.default('all').describe(
            '联系状态筛选',
        ),
    })
    .describe('商户加盟申请列表查询参数');

export type AdminMerchantJoinRequestListQuery = z.infer<
    typeof AdminMerchantJoinRequestListQuerySchema
>;

export const AdminMerchantJoinRequestListResponseSchema = PaginatedDataSchema(
    AdminMerchantJoinRequestSchema,
).describe('商户加盟申请分页响应');

export type AdminMerchantJoinRequestListResponse = z.infer<
    typeof AdminMerchantJoinRequestListResponseSchema
>;

export const AdminUpdateMerchantJoinRequestSchema = z
    .object({
        isContacted: z.boolean().describe('是否已联系'),
        adminRemark: z
            .string()
            .max(2000, '管理员备注不能超过 2000 个字符')
            .nullable()
            .optional()
            .describe('管理员备注'),
    })
    .describe('更新商户加盟申请请求');

export type AdminUpdateMerchantJoinRequest = z.infer<
    typeof AdminUpdateMerchantJoinRequestSchema
>;

// =========================
// 服务标签管理
// =========================

export const AdminServiceTagStatusSchema = z
    .enum(["all", "active", "inactive"])
    .describe("管理端服务标签状态筛选");

export const AdminServiceTagSchema = z
    .object({
        id: z.string().max(255).describe("标签 ID"),
        name: z.string().max(100).describe("标签名称"),
        slug: z.string().max(100).describe("标签 slug"),
        domain: ServiceTagDomainEnum.describe("业务域"),
        sortOrder: z.number().int().describe("排序值"),
        isActive: z.boolean().describe("是否启用"),
        description: z.string().nullable().describe("标签描述"),
        serviceCount: z.number().int().nonnegative().describe("已绑定服务数"),
    })
    .describe("管理端服务标签");

export type AdminServiceTag = z.infer<typeof AdminServiceTagSchema>;

export const AdminServiceTagListQuerySchema = z
    .object({
        domain: ServiceTagDomainEnum.optional(),
        keyword: z.string().trim().optional(),
        status: AdminServiceTagStatusSchema.default("all"),
    })
    .describe("管理端服务标签列表查询参数");

export type AdminServiceTagListQuery = z.infer<
    typeof AdminServiceTagListQuerySchema
>;

export const AdminServiceTagListResponseSchema = z
    .object({
        items: z.array(AdminServiceTagSchema),
    })
    .describe("管理端服务标签列表响应");

export type AdminServiceTagListResponse = z.infer<
    typeof AdminServiceTagListResponseSchema
>;

export const CreateAdminServiceTagSchema = z
    .object({
        name: z.string().trim().min(1, "标签名称不能为空").max(100),
        slug: z.string().trim().min(1, "slug 不能为空").max(100),
        domain: ServiceTagDomainEnum,
        sortOrder: z.number().int(),
        description: z.string().trim().nullable().optional(),
        isActive: z.boolean(),
    })
    .describe("创建管理端服务标签请求");

export type CreateAdminServiceTagInput = z.infer<
    typeof CreateAdminServiceTagSchema
>;

export const UpdateAdminServiceTagSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
        slug: z.string().trim().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
        description: z.string().trim().nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .describe("更新管理端服务标签请求");

export type UpdateAdminServiceTagInput = z.infer<
    typeof UpdateAdminServiceTagSchema
>;
