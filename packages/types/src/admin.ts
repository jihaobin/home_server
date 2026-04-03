import { z } from "zod/v4";
import { PaginatedDataSchema, PaginationQuerySchema } from "./common";
import {
    AssignmentTypeEnum,
    OrderStatusEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    ServiceCategoriesSchema,
    TransactionTypeEnum,
    UserRoleEnum,
    WithdrawalPayeeAccountTypeEnum,
    WithdrawalStatusEnum,
} from "./database-entity";

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
