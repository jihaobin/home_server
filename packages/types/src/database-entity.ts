import { optional, z } from "zod/v4";

// ==================== 枚举定义 ====================

// 用户角色枚举
export const UserRoleEnum = z.enum([
    "customer",
    "service_personnel",
    "shop_admin",
    "admin",
    "super_admin",
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

// 订单状态枚举 - MVP简化版本
export const OrderStatusEnum = z.enum([
    "pending_payment", // 待支付
    "payment_timeout", // 支付超时
    "paid", // 已接单待服务
    "pending_acceptance", // 待接单（等待服务人员确认）
    "staff_rejected", // 服务人员拒绝接单
    "completed", // 已完成（包含已评价和未评价）
    "cancelled", // 已取消（各种原因的取消统一处理）
    "refunded", // 已退款
]);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// 支付状态枚举
export const PaymentStatusEnum = z.enum([
    "pending",
    "succeeded",
    "failed",
    "refunded",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// 支付方法
export const PaymentMethodEnum = z.enum([
    "wechat_pay", // 微信支付
    "alipay", // 支付宝
    "bank_transfer", // 银行转账
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const WithdrawalPayeeAccountTypeEnum = z.enum([
    "ALIPAY_USER_ID",
    "ALIPAY_LOGON_ID",
    "ALIPAY_OPEN_ID",
    "WECHAT_OPENID",
]);
export type WithdrawalPayeeAccountType = z.infer<
    typeof WithdrawalPayeeAccountTypeEnum
>;

// 分配类型枚举 - MVP纯个人模式
export const AssignmentTypeEnum = z.enum([
    "system_auto", // 系统自动派单
    "customer_designated", // 用户指定
    "grab", // 服务人员抢单
]);
export type AssignmentType = z.infer<typeof AssignmentTypeEnum>;

export const AssignmentDecisionStatusEnum = z.enum([
    "pending",
    "accepted",
    "rejected",
]);
export type AssignmentDecisionStatus = z.infer<
    typeof AssignmentDecisionStatusEnum
>;

// 提现状态枚举
export const WithdrawalStatusEnum = z.enum([
    "pending", // 待审核
    "approved", // 审核通过
    "processing", // 渠道处理中
    "failed", // 渠道打款失败
    "cancelled", // 渠道取消或系统取消
    "rejected", // 审核拒绝
    "completed", // 已完成
]);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatusEnum>;

// 通知模块枚举
export const NotificationPriorityEnum = z.enum([
    "high", // 关键事务，必须实时送达
    "normal", // 默认优先级
    "low", // 可延迟或批量处理
]);
export type NotificationPriority = z.infer<typeof NotificationPriorityEnum>;

export const NotificationStatusEnum = z.enum([
    "pending", // 初始写入数据库，等待出队
    "queued", // 已进入 Redis Stream 等队列
    "dispatching", // Dispatcher 正在执行渠道
    "succeeded", // 全部流程完成
    "failed", // 全部渠道失败或超限
    "cancelled", // 被业务主动撤销
]);
export type NotificationStatus = z.infer<typeof NotificationStatusEnum>;

export const NotificationDeliveryModeEnum = z.enum([
    "strict", // 需要客户端 ACK
    "best-effort", // 尽力而为，发送即算完成
]);
export type NotificationDeliveryMode = z.infer<
    typeof NotificationDeliveryModeEnum
>;

export const NotificationTraceLevelEnum = z.enum([
    "none", // 不留轨迹
    "minimal", // 只记录关键节点
    "full", // 详细记录调度与重试
]);
export type NotificationTraceLevel = z.infer<typeof NotificationTraceLevelEnum>;

export const NotificationChannelEnum = z.enum([
    "in_app", // 应用内 WS/Socket 推送
    "tencent_cloud_push", // 腾讯云消息推送，面向后台/未启动场景
    "sms", // 短信兜底
]);
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

export const NotificationTargetTypeEnum = z.enum([
    "user", // 单个用户
    "service_personnel", // 服务人员实体
    "shop", // 店铺/商户
    "role", // 按角色广播
    "custom", // 业务自定义主体
]);
export type NotificationTargetType = z.infer<typeof NotificationTargetTypeEnum>;

export const NotificationDeliveryStatusEnum = z.enum([
    "pending", // 等待渠道执行
    "scheduled", // 渠道内部排队
    "sent", // 渠道调用成功
    "delivered", // 渠道确认送达
    "failed", // 渠道失败或拒绝
    "acknowledged", // 客户端确认收到
]);
export type NotificationDeliveryStatus = z.infer<
    typeof NotificationDeliveryStatusEnum
>;

// 复用型 JSON 字段（payload/metadata 等）使用统一 schema，便于在多个表中引用。
const JsonRecordSchema = z.record(z.string(), z.any());

export const NotificationChannelPlanItemSchema = z.object({
    channel: NotificationChannelEnum,
    when: z.enum(["online", "offline", "always"]).optional(),
    fallbackAfterMs: z.number().int().nonnegative().optional(),
    metadata: JsonRecordSchema.optional(),
});
export type NotificationChannelPlanItem = z.infer<
    typeof NotificationChannelPlanItemSchema
>;

// 优惠券类型枚举
export const CouponTypeEnum = z.enum([
    "fixed_amount", // 固定金额折扣
    "percentage", // 百分比折扣
    "free_shipping", // 免费配送
]);
export type CouponType = z.infer<typeof CouponTypeEnum>;

// 优惠券状态枚举
export const CouponStatusEnum = z.enum([
    "active", // 激活状态
    "inactive", // 未激活
    "expired", // 已过期
    "disabled", // 已禁用
]);
export type CouponStatus = z.infer<typeof CouponStatusEnum>;

// 评价目标类型枚举
export const ReviewTargetTypeEnum = z.enum(["personnel", "shop"]);
export type ReviewTargetType = z.infer<typeof ReviewTargetTypeEnum>;

// 用户优惠券状态枚举
export const UserCouponStatusEnum = z.enum(["available", "used", "expired"]);
export type UserCouponStatus = z.infer<typeof UserCouponStatusEnum>;

export const NotificationDeviceInfoSchema = z.object({
    deviceId: z.string().max(255, "设备ID长度不能超过255个字符").optional(),
    platform: z.enum(["ios", "android", "web", "unknown"]).optional(),
    appVersion: z.string().max(64, "App 版本号长度不能超过64个字符").optional(),
    connectionId: z.string().max(255, "连接ID长度不能超过255个字符").optional(),
    registrationId: z
        .string()
        .max(512, "RegistrationID 长度不能超过512个字符")
        .optional(),
    updatedAt: z.string().optional(),
});
export type NotificationDeviceInfo = z.infer<
    typeof NotificationDeviceInfoSchema
>;

// 订单完成确认二维码状态枚举
export const OrderCheckinStatusEnum = z.enum([
    "pending", // 待确认
    "verified", // 已确认
    "revoked", // 主动作废
    "expired", // 已过期
]);
export type OrderCheckinStatus = z.infer<typeof OrderCheckinStatusEnum>;

// 应用发布枚举
export const AppReleaseAppEnum = z.enum(["mobile-user", "mobile-worker"]);
export type AppReleaseApp = z.infer<typeof AppReleaseAppEnum>;

export const AppReleasePlatformEnum = z.enum(["android", "ios"]);
export type AppReleasePlatform = z.infer<typeof AppReleasePlatformEnum>;

export const AppReleaseStatusEnum = z.enum([
    "draft",
    "published",
    "rollbacked",
]);
export type AppReleaseStatus = z.infer<typeof AppReleaseStatusEnum>;

export const AppReleaseChannelEnum = z.enum(["production", "staging"]);
export type AppReleaseChannel = z.infer<typeof AppReleaseChannelEnum>;

// 管理端抽成策略枚举
export const AdminCommissionStrategyStatusEnum = z.enum([
    "draft",
    "published",
    "archived",
]);
export type AdminCommissionStrategyStatus = z.infer<
    typeof AdminCommissionStrategyStatusEnum
>;

export const AdminCommissionStrategyVersionStatusEnum = z.enum([
    "draft",
    "published",
    "archived",
]);
export type AdminCommissionStrategyVersionStatus = z.infer<
    typeof AdminCommissionStrategyVersionStatusEnum
>;

export const AdminCommissionStrategyRuleTypeEnum = z.enum([
    "fixed",
    "dynamic",
    "beginner-protection",
]);
export type AdminCommissionStrategyRuleType = z.infer<
    typeof AdminCommissionStrategyRuleTypeEnum
>;

const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

// 交易类型枚举
export const TransactionTypeEnum = z.enum([
    "service_earning", // 服务收入
    "platform_fee", // 平台手续费
    "withdrawal", // 提现
    "refund_paid", // 退款支出
    "bonus", // 奖金
    "penalty", // 罚金
    "adjustment", // 手动调整
    "payment_received", // 支付收款
]);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

// ==================== 基础表 Schema ====================

// 用户表
export const UsersSchema = z
    .object({
        id: z.string().max(255, "用户ID长度不能超过255个字符").meta({
            description: "用户的唯一标识符",
            title: "用户ID",
        }),
        email: z
            .email("请输入有效的邮箱地址")
            .max(255, "邮箱长度不能超过255个字符")
            .default("")
            .meta({
                description: "用户的邮箱地址",
                title: "邮箱",
            }),
        emailVerified: z.boolean().default(false).meta({
            description: "邮箱是否已验证",
            title: "邮箱验证状态",
        }),
        phoneNumberVerified: z.boolean().default(false).meta({
            description: "手机号码是否已验证",
            title: "手机号码验证状态",
        }),
        name: z.string().max(50, "姓名长度不能超过50个字符").default("").meta({
            description: "用户的姓名",
            title: "姓名",
        }),
        sex: z.boolean().default(true).meta({
            description: "用户的性别，true-男，false-女",
            title: "性别",
        }),
        phoneNumber: z
            .string()
            .max(20, "手机号长度不能超过20个字符")
            .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码")
            .optional()
            .meta({
                description: "用户的手机号码",
                title: "手机号码",
            }),
        role: z
            .array(UserRoleEnum)
            .default(["customer"])
            .meta({
                description: "用户角色",
                examples: [
                    "customer (客户)",
                    "service_personnel (服务人员)",
                    "shop_admin (店铺管理员)",
                    "admin (管理员)",
                    "super_admin (超级管理员)",
                ],
            }),
        isActive: z.boolean().default(true).meta({
            title: "该用户是否可用",
        }),
        image: z
            .string()
            .max(255, "头像URL长度不能超过255个字符")
            .default("")
            .meta({
                description: "用户头像的URL",
                title: "头像URL",
            }),
        devices: z.array(NotificationDeviceInfoSchema).default([]).meta({
            description:
                "用户绑定的设备列表，用于记录 RegistrationID 等推送信息",
            title: "设备列表",
        }),
        createdAt: z.date().meta({
            description: "用户创建时间",
            title: "创建时间",
        }),
        updatedAt: z.date().optional().meta({
            description: "用户更新时间",
            title: "更新时间",
        }),
    })
    .meta({
        title: "用户表",
        description: "存储用户信息的表",
    });

// 验证令牌表
export const VerificationsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "验证令牌的唯一标识符",
            title: "验证ID",
        }),
        identifier: z.string().max(255).meta({
            description: "验证标识符，例如邮箱地址",
            title: "标识符",
        }),
        value: z.string().max(255).meta({
            description: "验证令牌的值",
            title: "值",
        }),
        expiresAt: z.date().meta({
            description: "验证令牌过期时间",
            title: "过期时间",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "令牌创建时间",
                title: "创建时间",
            }),
        updatedAt: z.date().optional().meta({
            description: "令牌更新时间",
            title: "更新时间",
        }),
    })
    .meta({
        title: "验证令牌表",
        description: "存储用于邮箱验证或密码重置等一次性令牌",
    });

// 资金流水表
export const FinancialTransactionsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "交易流水唯一标识",
            title: "交易流水ID",
        }),
        orderId: z.string().max(255).optional().nullable().meta({
            description: "关联订单ID，可以为空",
            title: "订单ID",
        }),
        paymentId: z.string().max(255).optional().nullable().meta({
            description: "关联支付记录ID，可以为空",
            title: "支付ID",
        }),
        withdrawalId: z.string().max(255).optional().nullable().meta({
            description: "关联提现记录ID，可以为空",
            title: "提现ID",
        }),
        userId: z.string().max(255).meta({
            description: "关联的用户ID",
            title: "用户ID",
        }),
        transactionType: TransactionTypeEnum.meta({
            description: "交易类型",
            title: "交易类型",
        }),
        amount: z.number().multipleOf(0.01).meta({
            description: "交易金额 (正数为收入，负数为支出)",
            title: "交易金额",
        }),
        currency: z.string().max(3).default("CNY").meta({
            description: "币种代码",
            title: "币种",
        }),
        description: z.string().max(500).optional().nullable().meta({
            description: "交易描述",
            title: "交易描述",
        }),
        referenceId: z.string().max(255).optional().nullable().meta({
            description: "外部引用ID (如第三方支付号)",
            title: "外部引用ID",
        }),
        metadata: z.string().max(1000).optional().nullable().meta({
            description: "额外元数据 (JSON格式)",
            title: "元数据",
        }),
        createdAt: z.date().meta({
            description: "交易创建时间",
            title: "创建时间",
        }),
    })
    .meta({
        title: "资金流水表",
        description: "记录所有资金流动，实现财务对账机制",
    });

// 用户余额表
export const UserBalancesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "余额记录唯一标识",
            title: "余额记录ID",
        }),
        userId: z.string().max(255).meta({
            description: "关联的用户ID",
            title: "用户ID",
        }),
        availableBalance: z.number().multipleOf(0.01).default(0).meta({
            description: "可用余额",
            title: "可用余额",
        }),
        frozenBalance: z.number().multipleOf(0.01).default(0).meta({
            description: "冻结余额",
            title: "冻结余额",
        }),
        totalBalance: z.number().multipleOf(0.01).default(0).meta({
            description: "总余额 (可用 + 冻结)",
            title: "总余额",
        }),
        currency: z.string().max(3).default("CNY").meta({
            description: "币种代码",
            title: "币种",
        }),
        lastTransactionId: z.string().max(255).optional().nullable().meta({
            description: "最后一笔交易ID",
            title: "最后交易ID",
        }),
        updatedAt: z.date().optional().meta({
            description: "最后更新时间",
            title: "更新时间",
        }),
        createdAt: z.date().meta({
            description: "余额记录创建时间",
            title: "创建时间",
        }),
    })
    .meta({
        title: "用户余额表",
        description: "统一管理用户账户余额",
    });

// 中国城市表
export const ChinaCitySchema = z
    .object({
        id: z.number().int().meta({
            description: "省份/市/区的唯一标识符",
            title: "省份/市/区 ID",
        }),
        pid: z.number().int().meta({
            description: "父级ID，0表示省级",
            title: "父级ID",
        }),
        deep: z.number().int().meta({
            description: "深度，0表示省，1表示市，2表示区县",
            title: "深度",
        }),
        name: z.string().max(255).meta({
            description: "省份/市/区的名称",
            title: "省份/市/区的名称",
        }),
        pinyinPrefix: z.string().max(255).meta({
            description: "拼音首字母",
            title: "拼音首字母",
        }),
        pinyin: z.string().max(255).meta({
            description: "拼音",
            title: "拼音",
        }),
        extId: z.string().max(255).meta({
            description: "外部ID",
            title: "外部ID",
        }),
        extName: z.string().max(255).meta({
            description: "外部名称",
            title: "外部名称",
        }),
    })
    .meta({
        title: "中国城市表",
        description: "存储中国省市区数据的表",
    });

// 订单完成确认记录表
export const OrderCheckinsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "订单完成确认记录唯一标识",
            title: "完成确认记录ID",
        }),
        orderId: z.string().max(255).meta({
            description: "关联的订单ID",
            title: "订单ID",
        }),
        tokenHash: z.string().max(128).meta({
            description: "完成确认令牌哈希值",
            title: "令牌哈希",
        }),
        status: OrderCheckinStatusEnum.default("pending").meta({
            description: "完成确认状态",
            title: "完成确认状态",
        }),
        expiresAt: z.date().meta({
            description: "令牌过期时间",
            title: "过期时间",
        }),
        verifiedAt: z.date().optional().nullable().meta({
            description: "完成确认时间",
            title: "完成确认时间",
        }),
        verifiedBy: z.string().max(255).optional().nullable().meta({
            description: "验证者（服务人员）用户ID，可以为空",
            title: "验证者ID",
        }),
        verifiedGeom: z.array(z.number()).length(2).optional().nullable().meta({
            description: "验证时的地理位置，格式为 [经度, 纬度]",
            title: "验证时地理位置",
        }),
        createdAt: z.date().meta({
            description: "创建时间",
            title: "创建时间",
        }),
        updatedAt: z.date().optional().meta({
            description: "更新时间",
            title: "更新时间",
        }),
    })
    .meta({
        title: "订单完成确认记录表",
        description: "记录订单完成确认信息的表",
    });

// 应用发布表
export const AppReleasesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "发布记录 ID",
            title: "发布记录 ID",
        }),
        app: AppReleaseAppEnum.meta({
            description: "应用标识（mobile-user/mobile-worker）",
            title: "应用标识",
        }),
        platform: AppReleasePlatformEnum.meta({
            description: "平台",
            title: "平台",
        }),
        version: z
            .string()
            .regex(semverRegex, "版本号需符合 semver 规范")
            .meta({
                description: "语义化版本号",
                title: "版本号",
            }),
        buildNumber: z.number().int().nonnegative().optional().nullable().meta({
            description: "构建号，可选",
            title: "构建号",
        }),
        releaseStatus: AppReleaseStatusEnum.default("draft").meta({
            description: "发布状态",
            title: "发布状态",
        }),
        isActive: z.boolean().default(false).meta({
            description: "是否为当前生效版本",
            title: "是否生效",
        }),
        forceUpdate: z.boolean().default(false).meta({
            description: "是否强制更新",
            title: "强制更新",
        }),
        minSupportedVersion: z
            .string()
            .regex(semverRegex, "最小兼容版本需符合 semver 规范")
            .optional()
            .nullable()
            .meta({
                description: "最低兼容版本",
                title: "最低兼容版本",
            }),
        changelog: z.string().optional().nullable().meta({
            description: "更新日志",
            title: "更新日志",
        }),
        downloadUrlOverride: z.string().max(1024).optional().nullable().meta({
            description: "下载地址覆盖（TestFlight/App Store 等）",
            title: "下载地址覆盖",
        }),
        releaseChannel: AppReleaseChannelEnum.default("production").meta({
            description: "发布渠道/环境",
            title: "发布渠道",
        }),
        rolloutPercent: z.number().int().min(0).max(100).default(100).meta({
            description: "灰度比例 0-100",
            title: "灰度比例",
        }),
        fileId: z.string().max(255).optional().nullable().meta({
            description: "关联文件 ID",
            title: "文件 ID",
        }),
        createdBy: z.string().max(255).meta({
            description: "创建人用户 ID",
            title: "创建人",
        }),
        publishedBy: z.string().max(255).optional().nullable().meta({
            description: "发布人用户 ID",
            title: "发布人",
        }),
        publishedAt: z.date().optional().nullable().meta({
            description: "发布时间",
            title: "发布时间",
        }),
        rollbackFromId: z.string().max(255).optional().nullable().meta({
            description: "回滚来源版本 ID",
            title: "回滚来源版本",
        }),
        downloadCount: z.number().int().nonnegative().default(0).meta({
            description: "下载次数",
            title: "下载次数",
        }),
        forceUpdateCount: z.number().int().nonnegative().default(0).meta({
            description: "强更拦截次数",
            title: "强更拦截次数",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "应用发布表",
        description: "记录移动端应用的发布版本信息",
    });

// ==================== 有外键关系的表 Schema ====================

// 认证信息表（用户第三方登录，关联用户）
export const AccountsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "账户的唯一标识符",
            title: "账户ID",
        }),
        accountId: z.string().max(255).meta({
            description: "账户ID",
            title: "账户ID",
        }),
        providerId: z.string().max(255).meta({
            description: "第三方登录提供商ID",
            title: "提供商ID",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
        accessToken: z.string().optional().meta({
            description: "访问令牌",
            title: "访问令牌",
        }),
        refreshToken: z.string().optional().meta({
            description: "刷新令牌",
            title: "刷新令牌",
        }),
        idToken: z.string().optional().meta({
            description: "ID令牌",
            title: "ID令牌",
        }),
        accessTokenExpiresAt: z.date().optional().meta({
            description: "访问令牌过期时间",
            title: "访问令牌过期时间",
        }),
        refreshTokenExpiresAt: z.date().optional().meta({
            description: "刷新令牌过期时间",
            title: "刷新令牌过期时间",
        }),
        scope: z.string().optional().meta({
            description: "访问范围",
            title: "访问范围",
        }),
        password: z.string().optional().meta({
            description: "账户密码",
            title: "账户密码",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z.date().optional().meta({
            description: "更新时间",
            title: "更新时间",
        }),
    })
    .meta({
        title: "第三方认证账户表",
        description: "存储用户认证信息的表",
    });

// 会话表（用户会话信息，关联用户）
export const SessionsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "会话的唯一标识符",
            title: "会话ID",
        }),
        expiresAt: z.date().meta({
            description: "会话过期时间",
            title: "过期时间",
        }),
        token: z.string().max(255).meta({
            description: "会话令牌",
            title: "令牌",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "会话创建时间",
                title: "创建时间",
            }),
        updatedAt: z.date().optional().meta({
            description: "会话更新时间",
            title: "更新时间",
        }),
        ipAddress: z.string().optional().meta({
            description: "用户IP地址",
            title: "IP地址",
        }),
        userAgent: z.string().optional().meta({
            description: "用户设备信息",
            title: "设备信息",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
    })
    .meta({
        title: "会话表",
        description: "存储用户会话信息的表",
    });

// 用户资料表（关联用户，用于实名认证）
export const UserProfilesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "用户资料ID",
            title: "用户资料ID",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
        alipayUserId: z.string().max(64).optional().meta({
            description: "支付宝 userId",
            title: "支付宝用户ID",
        }),
        alipayOpenId: z.string().max(64).optional().meta({
            description: "支付宝 openId",
            title: "支付宝 openId",
        }),
        wechatWorkerOpenId: z.string().max(128).optional().meta({
            description: "服务人员端微信提现 openid",
            title: "服务人员微信提现 openid",
        }),
        wechatWorkerUnionId: z.string().max(128).optional().meta({
            description: "服务人员端微信提现 unionid",
            title: "服务人员微信提现 unionid",
        }),
        wechatWorkerAppId: z.string().max(128).optional().meta({
            description: "服务人员端微信提现 appid",
            title: "服务人员微信提现 appid",
        }),
        wechatWorkerBoundAt: z.date().optional().meta({
            description: "服务人员端微信提现绑定时间",
            title: "服务人员微信提现绑定时间",
        }),
        realName: z.string().max(50).meta({
            description: "真实姓名",
            title: "真实姓名",
        }),
        idCardNumber: z
            .string()
            .max(18)
            .regex(
                /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/,
                "请输入有效的身份证号码",
            ),
        faceRecognitionData: z.string().optional().meta({
            description: "人脸识别数据",
            title: "人脸识别数据",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "用户资料表",
        description: "存储用户实名信息的表",
    });

// MVP阶段注释店铺表Schema，专注纯个人模式
// export const ShopsSchema = z.object({
//     id: z.string().max(255).meta({
//         description: '店铺ID',
//         title: '店铺ID'
//     }),
//     ownerId: z.string().max(255).meta({
//         description: '店主ID',
//         title: '店主ID'
//     }),
//     name: z.string().max(100).meta({
//         description: '店铺名称',
//         title: '店铺名称'
//     }),
//     description: z.string().optional().meta({
//         description: '店铺描述',
//         title: '店铺描述'
//     }),
//     detailedAddress: z.string().max(255).optional().meta({
//         description: '店铺详细地址',
//         title: '店铺详细地址'
//     }),
//     homeNumber: z.string().max(50).optional().meta({
//         description: '门牌号',
//         title: '门牌号'
//     }),
//     geom: z.string().optional().meta({
//         description: '店铺位置',
//         title: '店铺位置'
//     }), // 几何点数据，存储为WKT格式
//     createdAt: z.date().default(() => new Date()).meta({
//         description: '创建时间',
//         title: '创建时间'
//     }),
//     updatedAt: z.date().default(() => new Date()).meta({
//         description: '更新时间',
//         title: '更新时间'
//     }),
//     province: z.string().max(100).optional().meta({
//         description: '省份',
//         title: '省份'
//     }),
//     district: z.string().max(100).optional().meta({
//         description: '市区',
//         title: '市区'
//     }),
//     county: z.string().max(100).optional().meta({
//         description: '区/县',
//         title: '区/县'
//     }),
// }).meta({
//     title: '店铺表',
//     description: '存储店铺信息的表'
// });

// 服务分类表（自关联）
export const ServiceCategoriesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "服务分类ID",
            title: "服务分类ID",
        }),
        parentId: z.string().max(255).nullable().meta({
            description: "父分类ID，根分类为null",
            title: "父分类ID",
        }),
        name: z.string().max(100).meta({
            description: "服务分类名称",
            title: "服务分类名称",
        }),
        description: z.string().nullable().meta({
            description: "服务分类描述",
            title: "服务分类描述",
        }),
        dep: z.number().int().min(1).meta({
            description: "服务分类深度",
            title: "服务分类深度",
        }),
        isActive: z.boolean().meta({
            description: "服务分类是否启用",
            title: "服务分类是否启用",
        }),
        sortOrder: z.number().int().nonnegative().default(0).meta({
            description: "服务分类排序值，越小越靠前",
            title: "服务分类排序值",
        }),
        commissionRate: z.number().int().min(0).max(100).default(30).meta({
            description: "平台对该服务分类收取的抽成比例，单位百分比",
            title: "抽成比例",
        }),
        iconFileId: z
            .string()
            .max(255)
            .nullable()
            .optional()
            .default(null)
            .meta({
                description: "分类图标文件ID",
                title: "分类图标文件ID",
            }),
        iconFileUrl: z.string().nullable().optional().meta({
            description: "分类图标访问地址（派生字段）",
            title: "分类图标访问地址",
        }),
    })
    .meta({
        title: "服务分类表",
        description: "存储服务分类信息的表",
    });

// 服务表（关联服务分类）
export const ServicesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "服务ID",
            title: "服务ID",
        }),
        categoryId: z.string().max(255).meta({
            description: "服务分类ID",
            title: "服务分类ID",
        }),
        serviceTagId: z
            .string()
            .max(255)
            .nullable()
            .optional()
            .default(null)
            .meta({
                description: "服务标签ID",
                title: "服务标签ID",
            }),
        name: z.string().max(100).meta({
            description: "服务名称",
            title: "服务名称",
        }),
        description: z.string().nullable().meta({
            description: "服务描述",
            title: "服务描述",
        }),
        imageFileId: z
            .string()
            .max(255)
            .nullable()
            .optional()
            .default(null)
            .meta({
                description: "服务图片文件ID",
                title: "服务图片文件ID",
            }),
        imageFileUrl: z.string().nullable().optional().meta({
            description: "服务图片访问地址（派生字段）",
            title: "服务图片访问地址",
        }),
        isActive: z.boolean().meta({
            description: "服务是否可用",
            title: "服务可用状态",
        }),
    })
    .meta({
        title: "服务表",
        description: "存储服务信息的表",
    });

export const ServiceTagsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "服务标签ID",
            title: "服务标签ID",
        }),
        name: z.string().max(100).meta({
            description: "服务标签名称",
            title: "服务标签名称",
        }),
        slug: z.string().max(100).meta({
            description: "服务标签 slug",
            title: "服务标签 slug",
        }),
        domain: z.string().max(50).meta({
            description: "服务标签所属业务域",
            title: "服务标签业务域",
        }),
        sortOrder: z.number().int().default(0).meta({
            description: "服务标签排序值",
            title: "服务标签排序值",
        }),
        isActive: z.boolean().default(true).meta({
            description: "服务标签是否启用",
            title: "服务标签是否启用",
        }),
        description: z.string().nullable().default(null).meta({
            description: "服务标签描述",
            title: "服务标签描述",
        }),
    })
    .meta({
        title: "服务标签表",
        description: "存储全局服务标签信息的表",
    });

// 服务人员表（关联用户） - MVP纯个人模式
export const ServicePersonnelSchema = z
    .object({
        userId: z.string().max(255).meta({
            description: "服务人员用户ID",
            title: "服务人员用户ID",
        }),
        name: z.string().max(50).optional().nullable().meta({
            description: "服务人员名称（独立于用户资料）",
            title: "服务人员名称",
        }),
        avatar: z.string().max(255).optional().nullable().meta({
            description: "服务人员头像（文件 hash）",
            title: "服务人员头像",
        }),
        merchantQualificationFileId: z.string().max(255).optional().nullable().meta({
            description: "商家资质文件 ID",
            title: "商家资质文件 ID",
        }),
        vocationalQualificationFileId: z.string().max(255).optional().nullable().meta({
            description: "从业资格证书文件 ID",
            title: "从业资格证书文件 ID",
        }),
        // MVP阶段注释店铺关联字段
        // shopId: z.string().max(255).optional().meta({
        //     description: "服务人员所属店铺ID",
        //     title: "服务人员所属店铺ID",
        // }),
        bio: z.string().optional().nullable().meta({
            description: "服务人员简介",
            title: "服务人员简介",
        }),
        province: z.string().max(100).meta({
            description: "省份",
            title: "省份",
        }),
        district: z.string().max(100).optional().nullable().meta({
            description: "市区",
            title: "市区",
        }),
        county: z.string().max(100).optional().nullable().meta({
            description: "区/县",
            title: "区/县",
        }),
        detailedAddress: z.string().max(255).meta({
            description: "详细地址",
            title: "详细地址",
        }),
        geom: z.array(z.number()).length(2).meta({
            description: "地理位置（PostGIS Point），格式为 [经度, 纬度]",
            title: "地理位置",
        }),
        yearsOfExperience: z
            .number()
            .int()
            .min(0, "工作经验不能为负数")
            .default(0)
            .meta({
                description: "服务人员工作经验（年）",
                title: "服务人员工作经验（年）",
            }),
        workStartTime: z.string().meta({
            description: "可工作开始时间",
            title: "工作开始时间",
        }),
        workEndTime: z.string().meta({
            description: "可工作结束时间",
            title: "工作结束时间",
        }),
        isAvailable: z.boolean().default(true).meta({
            description: "是否当前可接受派单",
            title: "是否可用",
        }),
        workDays: z
            .string()
            .max(7)
            .regex(
                /^[1-7]{1,7}$/,
                "工作日格式不正确，应为1-7的组合，如：1234567",
            )
            .default("1234567")
            .meta({
                description: "工作日，1-7代表周一到周日",
                title: "工作日",
            }),
        currentStatus: z.string().max(20).default("available").meta({
            description: "当前状态：available, busy, offline",
            title: "当前状态",
        }),
        lastActiveAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "最后活跃时间",
                title: "最后活跃时间",
            }),
    })
    .refine(
        (data) => {
            if (data.workStartTime && data.workEndTime) {
                return data.workStartTime < data.workEndTime;
            }
            return true;
        },
        {
            message: "工作结束时间必须晚于开始时间",
            path: ["workEndTime"],
        },
    )
    .meta({
        title: "服务人员表",
        description: "存储服务人员信息的表",
    });

// 服务人员定价表（MVP纯个人模式新增）
export const ServicePersonnelPricingSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "定价记录ID",
            title: "定价记录ID",
        }),
        userId: z.string().max(255).meta({
            description: "服务人员用户ID",
            title: "服务人员用户ID",
        }),
        name: z
            .string()
            .max(100)
            .meta({
                description: "定价的的简单描述",
                title: "定价的的简单描述",
            })
            .default("")
            .nullish(),
        serviceId: z.string().max(255).meta({
            description: "服务项目ID",
            title: "服务项目ID",
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
        isActive: z.boolean().default(true).meta({
            description: "定价是否有效",
            title: "定价有效状态",
        }),
        effectiveFrom: z
            .date()
            .default(() => new Date())
            .meta({
                description: "定价生效开始时间",
                title: "生效开始时间",
            }),
        effectiveTo: z.date().optional().meta({
            description: "定价生效结束时间",
            title: "生效结束时间",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .refine(
        (data) => {
            if (data.effectiveTo) {
                return data.effectiveFrom < data.effectiveTo;
            }
            return true;
        },
        {
            message: "生效开始时间必须早于结束时间",
            path: ["effectiveTo"],
        },
    )
    .meta({
        title: "服务人员定价表",
        description: "存储服务人员个人定价信息的表",
    });

// 服务人员技能关联表
export const ServicePersonnelSkillsSchema = z
    .object({
        userId: z.string().max(255).meta({
            description: "服务人员用户ID",
            title: "服务人员用户ID",
        }),
        serviceId: z.string().max(255).meta({
            description: "服务ID",
            title: "服务ID",
        }),
    })
    .meta({
        title: "服务人员技能关联表",
        description: "存储服务人员与技能关联信息的表",
    });

// 用户地址表（关联用户）
export const UserAddressesSchema = z
    .object({
        id: z.string("id 不能为空").max(255, "id 不能超过255个字符").meta({
            description: "地址ID",
            title: "地址ID",
        }),
        userId: z
            .string("userId 不能为空")
            .max(255, "userId 不能超过255个字符")
            .meta({
                description: "用户ID",
                title: "用户ID",
            }),
        detailedAddress: z
            .string("地址不能为空")
            .max(255, "detailedAddress 不能超过255个字符")
            .meta({
                description: "详细地址",
                title: "详细地址",
            }),
        addressName: z
            .string()
            .max(100, "地点名称不能超过100个字符")
            .optional()
            .nullable()
            .meta({
                description: "地点名称",
                title: "地点名称，如xx小区,xx餐馆",
            }),
        homeNumber: z
            .string()
            .max(50, "门牌号不能超过50个字符")
            .optional()
            .nullable()
            .meta({
                description: "门牌号",
                title: "门牌号",
            }),
        geom: z.array(z.number()).length(2).optional().meta({
            description: "[经度, 纬度]",
            title: "[经度, 纬度]",
        }),
        recipientName: z
            .string("收件人不能为空")
            .max(50, "收件人姓名不能超过50个字符")
            .meta({
                description: "收件人姓名",
                title: "收件人姓名",
            }),
        sex: z.boolean().default(true).meta({
            description: "收货人的性别，true-男，false-女",
            title: "性别",
        }),
        recipientPhone: z
            .string("收件人手机号码不能为空")
            .max(20, "收件人手机号码不能超过20个字符")
            .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码")
            .meta({
                description: "收件人手机号码",
                title: "收件人手机号码",
            }),
        isDefault: z.boolean("是否为默认地址不能为空").default(false).meta({
            description: "是否为默认地址",
            title: "默认地址状态",
        }),
        province: z
            .string("省份不能为空")
            .max(100, "省份不能超过100个字符")
            .meta({
                description: "省份",
                title: "省份",
            }),
        city: z.string().max(100, "城市不能超过100个字符").optional().meta({
            description: "市",
            title: "市",
        }),
        district: z
            .string("district 不能为空")
            .max(100, "区/县不能超过100个字符")
            .optional()
            .meta({
                description: "区/县",
                title: "区/县",
            }),
    })
    .meta({
        title: "用户地址表",
        description: "存储用户地址信息的表",
    });

// 优惠券表（关联创建者）
export const CouponsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "优惠券ID",
            title: "优惠券ID",
        }),
        code: z.string().max(50).meta({
            description: "优惠券代码",
            title: "优惠券代码",
        }),
        name: z.string().max(100).meta({
            description: "优惠券名称",
            title: "优惠券名称",
        }),
        description: z.string().optional().meta({
            description: "优惠券描述",
            title: "优惠券描述",
        }),
        type: CouponTypeEnum.meta({
            description: "优惠券类型",
            title: "优惠券类型",
            examples: [
                "percentage (百分比折扣)",
                "fixed_amount (固定金额折扣)",
            ],
        }),
        discountValue: z
            .number()
            .multipleOf(0.01)
            .min(0.01, "折扣值必须大于0")
            .meta({
                description: "折扣值",
                title: "折扣值",
            }),
        minOrderAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "最小订单金额不能为负数")
            .default(0)
            .meta({
                description: "使用优惠券的最小订单金额",
                title: "最小订单金额",
            }),
        maxDiscountAmount: z.number().multipleOf(0.01).optional().meta({
            description: "最大折扣金额（仅适用于固定金额优惠券）",
            title: "最大折扣金额",
        }),
        usageLimit: z
            .number()
            .int()
            .min(1, "使用限制必须大于0")
            .default(1)
            .meta({
                description: "每个用户使用优惠券的限制次数",
                title: "使用限制",
            }),
        totalUsageLimit: z
            .number()
            .int()
            .min(1, "总使用限制必须大于0")
            .optional()
            .meta({
                description: "优惠券的总使用限制次数",
                title: "总使用限制",
            }),
        currentUsageCount: z
            .number()
            .int()
            .min(0, "当前使用次数不能为负数")
            .default(0)
            .meta({
                description: "优惠券的当前使用次数",
                title: "当前使用次数",
            }),
        isMultiUse: z.boolean().default(false).meta({
            description: "优惠券是否支持多次使用",
            title: "是否多次使用",
        }),
        validFrom: z.date().meta({
            description: "优惠券生效开始时间",
            title: "生效开始时间",
        }),
        validUntil: z.date().meta({
            description: "优惠券生效结束时间",
            title: "生效结束时间",
        }),
        status: CouponStatusEnum.default("active").meta({
            description: "优惠券状态",
            title: "状态",
        }),
        createdBy: z.string().max(255).optional().meta({
            description: "创建者用户ID",
            title: "创建者",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .refine((data) => data.validFrom < data.validUntil, {
        message: "有效期开始时间必须早于结束时间",
        path: ["validUntil"],
    })
    .refine(
        (data) => {
            if (data.type === "percentage") {
                return data.discountValue <= 100;
            }
            return true;
        },
        {
            message: "百分比折扣不能超过100%",
            path: ["discountValue"],
        },
    )
    .meta({
        title: "优惠券表",
        description: "存储优惠券信息的表",
    });

// 优惠券分类限制表
export const CouponCategoryRestrictionsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "优惠券分类限制ID",
            title: "优惠券分类限制ID",
        }),
        couponId: z.string().max(255).meta({
            description: "优惠券ID",
            title: "优惠券ID",
        }),
        categoryId: z.string().max(255).meta({
            description: "分类ID",
            title: "分类ID",
        }),
    })
    .meta({
        title: "优惠券分类限制表",
        description: "存储优惠券分类限制信息的表",
    });

// 优惠券服务限制表
export const CouponServiceRestrictionsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "优惠券服务限制ID",
            title: "优惠券服务限制ID",
        }),
        couponId: z.string().max(255).meta({
            description: "优惠券ID",
            title: "优惠券ID",
        }),
        serviceId: z.string().max(255).meta({
            description: "服务ID",
            title: "服务ID",
        }),
    })
    .meta({
        title: "优惠券服务限制表",
        description: "存储优惠券服务限制信息的表",
    });

// 用户优惠券表
export const UserCouponsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "用户优惠券ID",
            title: "用户优惠券ID",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
        couponId: z.string().max(255).meta({
            description: "优惠券ID",
            title: "优惠券ID",
        }),
        status: UserCouponStatusEnum.default("available").meta({
            description: "用户优惠券状态",
            title: "用户优惠券状态",
        }),
        usedCount: z
            .number()
            .int()
            .min(0, "使用次数不能为负数")
            .default(0)
            .meta({
                description: "用户优惠券使用次数",
                title: "用户优惠券使用次数",
            }),
        obtainedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "用户获得优惠券时间",
                title: "用户获得优惠券时间",
            }),
        firstUsedAt: z.date().optional().meta({
            title: "首次使用时间",
            description: "用户首次使用优惠券的时间",
        }),
        lastUsedAt: z.date().optional().meta({
            title: "最后使用时间",
            description: "用户最后使用优惠券的时间",
        }),
    })
    .meta({
        title: "用户优惠券表",
        description: "存储用户优惠券信息的表",
    });

// 订单表（关联用户、服务、地址）
export const OrdersSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        orderSerial: z.string().max(50).meta({
            description: "订单编号",
            title: "订单编号",
        }),
        customerId: z.string().max(255).meta({
            description: "客户ID",
            title: "客户ID",
        }),
        serviceId: z.string().max(255).meta({
            description: "服务ID",
            title: "服务ID",
        }),
        addressId: z.string().max(255).meta({
            description: "地址ID",
            title: "地址ID",
        }),
        status: OrderStatusEnum.default("pending_payment").meta({
            description: "订单状态",
            title: "订单状态",
            examples: [
                "pending_payment (待支付)",
                "pending_acceptance (待接单)",
                "paid (待服务)",
                "staff_rejected (服务人员拒单)",
                "completed (已完成)",
                "cancelled (已取消)",
                "payment_timeout (支付超时)",
                "refunded (已退款)",
            ],
        }),
        originalAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "原始金额不能为负数")
            .meta({
                title: "原始金额",
                description: "原始金额",
            }),
        discountAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "折扣金额不能为负数")
            .default(0)
            .meta({
                title: "折扣金额",
                description: "折扣金额",
            }),
        totalAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "总金额不能为负数")
            .meta({
                title: "总金额",
                description: "总金额",
            }),
        couponCode: z.string().max(50).optional().meta({
            description: "使用的优惠券代码",
            title: "使用的优惠券代码",
        }),
        remark: z.string().max(500).nullable().optional().meta({
            description: "订单备注",
            title: "订单备注",
        }),
        appointmentTime: z.date().meta({
            description: "服务预约时间",
            title: "服务预约时间",
        }),
        paymentExpiresAt: z.date().meta({
            description: "支付超时时间",
            title: "支付超时时间",
        }),
        serviceStartedAt: z.date().nullable().optional().meta({
            description: "服务开始时间",
            title: "服务开始时间",
        }),
        serviceCompletedAt: z.date().nullable().optional().meta({
            description: "服务完成时间",
            title: "服务完成时间",
        }),
        cancelReason: z.string().max(500).nullable().optional().meta({
            description: "取消原因",
            title: "取消原因",
        }),
        cancelledBy: z.string().max(255).nullable().optional().meta({
            description: "取消人",
            title: "取消人",
        }),
        cancelledAt: z.date().nullable().optional().meta({
            description: "取消时间",
            title: "取消时间",
        }),
        customerHiddenAt: z.date().nullable().optional().meta({
            description: "客户在自己订单列表隐藏订单的时间",
            title: "客户隐藏时间",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "订单创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "订单更新时间",
                title: "更新时间",
            }),
    })
    .refine((data) => data.totalAmount <= data.originalAmount, {
        message: "总金额不能超过原始金额",
        path: ["totalAmount"],
    })
    .refine((data) => data.appointmentTime > new Date(), {
        message: "预约时间必须是未来时间",
        path: ["appointmentTime"],
    })
    .meta({
        title: "订单表",
        description: "存储订单信息的表",
    });

// 订单分配表（关联订单、服务人员）- MVP简化版本
export const OrderAssignmentsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "订单分配ID",
            title: "订单分配ID",
        }),
        orderId: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        servicePersonnelId: z.string().max(255).meta({
            description: "服务人员ID",
            title: "服务人员ID",
        }),
        // MVP阶段注释店铺分配字段
        // shopId: z.string().max(255).optional().meta({
        //     description: "店铺ID",
        //     title: "店铺ID",
        // }),
        assignmentType: AssignmentTypeEnum.meta({
            description: "订单分配类型",
            title: "订单分配类型",
            examples: [
                "system_auto (系统自动分配)",
                "customer_designated (客户指定)",
                "grab (抢单)",
            ],
        }),
        assignedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "订单分配时间",
                title: "分配时间",
            }),
        acceptedAt: z.date().nullable().optional().meta({
            description: "服务人员接单时间",
            title: "接单时间",
        }),
        decisionStatus: AssignmentDecisionStatusEnum.default("pending").meta({
            description: "接单决策状态",
            title: "接单状态",
        }),
        rejectReason: z.string().max(500).nullable().optional().meta({
            description: "拒绝原因",
            title: "拒绝原因",
        }),
        rejectedAt: z.date().nullable().optional().meta({
            description: "拒绝时间",
            title: "拒绝时间",
        }),
        staffHiddenAt: z.date().nullable().optional().meta({
            description: "服务人员在自己订单列表隐藏订单的时间",
            title: "服务人员隐藏时间",
        }),
    })
    .meta({
        title: "订单分配表",
        description: "存储订单分配信息的表",
    });

// 支付表（关联订单）
export const PaymentsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "支付ID",
            title: "支付ID",
        }),
        orderId: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        amount: z.number().multipleOf(0.01).min(0, "支付金额不能为负数").meta({
            description: "支付金额",
            title: "支付金额",
        }),
        paymentMethod: PaymentMethodEnum.meta({
            description: "支付方式",
            title: "支付方式",
            examples: [
                "alipay (支付宝)",
                "wechat_pay (微信支付)",
                "bank_transfer (银行转账)",
            ],
        }),
        transactionId: z.string().max(255).optional().meta({
            description: "交易ID",
            title: "交易ID",
        }),
        status: PaymentStatusEnum.default("pending").meta({
            description: "支付状态",
            title: "支付状态",
            examples: [
                "pending (待支付)",
                "succeeded (支付成功)",
                "failed (支付失败)",
                "refunded (已退款)",
            ],
        }),
        paidAt: z.date().optional().meta({
            description: "支付完成时间",
            title: "支付完成时间",
        }),
    })
    .meta({
        title: "支付表",
        description: "存储支付信息的表",
    });

// 屏蔽关系表（用户间关系）
export const BlocksSchema = z
    .object({
        blockerId: z.string().max(255).meta({
            description: "屏蔽者用户ID",
            title: "屏蔽者用户ID",
        }),
        blockedId: z.string().max(255).meta({
            description: "被屏蔽者用户ID",
            title: "被屏蔽者用户ID",
        }),
    })
    .refine((data) => data.blockerId !== data.blockedId, {
        message: "不能屏蔽自己",
        path: ["blockedId"],
    })
    .meta({
        title: "屏蔽关系表",
        description: "存储用户间屏蔽关系的表",
    });

// 关注关系表（用户间关系）
export const FollowsSchema = z
    .object({
        followerId: z.string().max(255).meta({
            description: "关注者用户ID",
            title: "关注者用户ID",
        }),
        followingId: z.string().max(255).meta({
            description: "被关注者用户ID",
            title: "被关注者用户ID",
        }),
    })
    .refine((data) => data.followerId !== data.followingId, {
        message: "不能关注自己",
        path: ["followingId"],
    })
    .meta({
        title: "关注关系表",
        description: "存储用户服务关系的表",
    });

// 评价表（关联订单和用户）
export const ReviewsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "评价ID",
            title: "评价ID",
        }),
        orderId: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        reviewerId: z.string().max(255).meta({
            description: "评价者用户ID",
            title: "评价者用户ID",
        }),
        targetId: z.string().max(255).meta({
            description: "被评价对象ID",
            title: "被评价对象ID",
        }),
        targetType: ReviewTargetTypeEnum.meta({
            description: "被评价对象类型",
            title: "被评价对象类型",
        }),
        serviceId: z.string().max(255).meta({
            description: "服务ID",
            title: "服务ID",
        }),
        rating: z
            .number()
            .int()
            .min(1, "评分不能低于1分")
            .max(5, "评分不能超过5分")
            .meta({
                description: "总体评分 (1-5星)",
                title: "总体评分",
            }),
        serviceQuality: z
            .number()
            .int()
            .min(1, "服务质量评分不能低于1分")
            .max(5, "服务质量评分不能超过5分")
            .optional()
            .meta({
                description: "服务质量评分 (1-5星)",
                title: "服务质量评分",
            }),
        attitude: z
            .number()
            .int()
            .min(1, "服务态度评分不能低于1分")
            .max(5, "服务态度评分不能超过5分")
            .optional()
            .meta({
                description: "服务态度评分 (1-5星)",
                title: "服务态度评分",
            }),
        punctuality: z
            .number()
            .int()
            .min(1, "时间准时性评分不能低于1分")
            .max(5, "时间准时性评分不能超过5分")
            .optional()
            .meta({
                description: "时间准时性评分 (1-5星)",
                title: "时间准时性评分",
            }),
        comment: z.string().optional().meta({
            description: "评价内容",
            title: "评价内容",
        }),
        isAnonymous: z.boolean().default(false).meta({
            description: "是否匿名评价",
            title: "是否匿名评价",
        }),
        helpfulCount: z.number().int().min(0).default(0).meta({
            description: "有用评价数",
            title: "有用评价数",
        }),
        unhelpfulCount: z.number().int().min(0).default(0).meta({
            description: "无用评价数",
            title: "无用评价数",
        }),
        imageIds: z
            .array(
                z.string().max(255, "文件ID长度不能超过255个字符").meta({
                    description: "评价图片文件ID",
                    title: "评价图片文件ID",
                }),
            )
            .max(6, "最多支持上传6张评价图片")
            .default([])
            .meta({
                description: "评价图片文件ID列表",
                title: "评价图片文件ID列表",
            }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "评价创建时间",
                title: "评价创建时间",
            }),
    })
    .meta({
        title: "评价表",
        description: "存储用户对订单的评价信息",
    });

// 评价统计表
export const ReviewStatsDataBaseSchema = z
    .object({
        targetId: z.string().max(255).meta({
            description: "被评价对象ID",
            title: "被评价对象ID",
        }),
        targetType: ReviewTargetTypeEnum.meta({
            description: "被评价对象类型",
            title: "被评价对象类型",
        }),
        serviceId: z.string().max(255).nullable().meta({
            description: "服务ID，NULL表示全部服务的统计",
            title: "服务ID",
        }),
        totalCount: z.number().int().min(0).default(0).meta({
            description: "总评价数",
            title: "总评价数",
        }),
        goodCount: z.number().int().min(0).default(0).meta({
            description: "好评数（4-5星）",
            title: "好评数",
        }),
        neutralCount: z.number().int().min(0).default(0).meta({
            description: "中评数（3星）",
            title: "中评数",
        }),
        badCount: z.number().int().min(0).default(0).meta({
            description: "差评数（1-2星）",
            title: "差评数",
        }),
        averageRating: z.number().int().min(0).default(0).meta({
            description: "平均评分*100（如450表示4.50星）",
            title: "平均评分",
        }),
        averageServiceQuality: z
            .number()
            .int()
            .min(0)
            .nullable()
            .default(0)
            .meta({
                description: "平均服务质量评分*100",
                title: "平均服务质量评分",
            }),
        averageAttitude: z.number().int().min(0).nullable().default(0).meta({
            description: "平均态度评分*100",
            title: "平均态度评分",
        }),
        averagePunctuality: z.number().int().min(0).nullable().default(0).meta({
            description: "平均准时性评分*100",
            title: "平均准时性评分",
        }),
        lastReviewAt: z.date().nullable().optional().meta({
            description: "最后评价时间",
            title: "最后评价时间",
        }),
        updatedAt: z.date().optional().meta({
            description: "更新时间",
            title: "更新时间",
        }),
    })
    .meta({
        title: "评价统计表",
        description: "存储被评价对象的评分统计信息",
    });

// 收入表（关联订单和用户）
export const EarningsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "收入记录ID",
            title: "收入记录ID",
        }),
        orderId: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
        amount: z.number().multipleOf(0.01).min(0, "收入金额不能为负数").meta({
            description: "收入金额",
            title: "收入金额",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "收入记录创建时间",
                title: "收入记录创建时间",
            }),
    })
    .meta({
        title: "收入表",
        description: "存储用户收入记录的表",
    });

// 提现表（关联用户）
export const WithdrawalsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "提现记录ID",
            title: "提现记录ID",
        }),
        userId: z.string().max(255).meta({
            description: "用户ID",
            title: "用户ID",
        }),
        currency: z.string().min(1).max(3).default("CNY").meta({
            description: "提现币种",
            title: "提现币种",
        }),
        method: PaymentMethodEnum.default("alipay").meta({
            description: "提现方式（支付宝/微信/银行转账）",
            title: "提现方式",
        }),
        payeeAccount: z.string().max(255).meta({
            description: "收款账号（如支付宝登录号）",
            title: "收款账号",
        }),
        payeeAccountType: WithdrawalPayeeAccountTypeEnum.default(
            "ALIPAY_LOGON_ID",
        ).meta({
            description: "收款账号类型（如 ALIPAY_LOGON_ID）",
            title: "收款账号类型",
        }),
        payeeName: z.string().max(255).nullable().optional().meta({
            description: "收款人姓名",
            title: "收款人姓名",
        }),
        amount: z
            .number()
            .multipleOf(0.01)
            .min(0.01, "提现金额必须大于0")
            .meta({
                description: "提现金额",
                title: "提现金额",
            }),
        remark: z.string().max(500).optional().nullable().meta({
            description: "用户提交提现时的备注",
            title: "提现备注",
        }),
        status: WithdrawalStatusEnum.default("pending").meta({
            description: "提现状态",
            title: "提现状态",
            examples: [
                "pending (待处理)",
                "approved (已批准)",
                "processing (渠道处理中)",
                "failed (渠道打款失败)",
                "cancelled (渠道取消)",
                "rejected (已拒绝)",
                "completed (已完成)",
            ],
        }),
        reviewNote: z.string().max(1000).nullable().optional().meta({
            description: "管理员审核备注",
            title: "审核备注",
        }),
        reviewedByAdminId: z.string().max(255).nullable().optional().meta({
            description: "审核管理员ID",
            title: "审核管理员ID",
        }),
        reviewedAt: z.date().optional().meta({
            description: "审核时间",
            title: "审核时间",
        }),
        payoutReferenceId: z.string().max(255).nullable().optional().meta({
            description: "第三方打款参考号",
            title: "打款参考号",
        }),
        providerState: z.string().max(64).nullable().optional().meta({
            description: "渠道原始状态",
            title: "渠道原始状态",
        }),
        providerAppId: z.string().max(128).nullable().optional().meta({
            description: "渠道 appId",
            title: "渠道 appId",
        }),
        providerBillNo: z.string().max(255).nullable().optional().meta({
            description: "渠道侧单号",
            title: "渠道侧单号",
        }),
        providerPackageInfo: z.string().max(1000).nullable().optional().meta({
            description: "渠道确认收款或补充信息",
            title: "渠道补充信息",
        }),
        providerMeta: z
            .record(z.string(), z.unknown())
            .nullable()
            .optional()
            .meta({
                description: "渠道扩展元数据",
                title: "渠道扩展元数据",
            }),
        failureReason: z.string().max(500).nullable().optional().meta({
            description: "打款失败原因",
            title: "打款失败原因",
        }),
        requestedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "提现申请时间",
                title: "提现申请时间",
            }),
        processedAt: z.date().optional().meta({
            description: "提现处理时间",
            title: "提现处理时间",
        }),
    })
    .meta({
        title: "提现表",
        description: "存储用户提现记录的表",
    });

// 通知事件主表
export const NotificationsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "通知ID",
            title: "通知ID",
        }),
        event: z.string().min(1).max(120).meta({
            description: "事件标识，建议使用业务命名空间",
            title: "事件",
        }),
        payload: JsonRecordSchema.meta({
            description: "业务负载，序列化后的 JSON",
            title: "通知载荷",
        }),
        metadata: JsonRecordSchema.default({}).meta({
            description: "调度过程中的附加信息",
            title: "元数据",
        }),
        priority: NotificationPriorityEnum.default("normal").meta({
            description: "投递优先级",
            title: "优先级",
        }),
        status: NotificationStatusEnum.default("pending").meta({
            description: "当前投递状态",
            title: "状态",
        }),
        deliveryMode: NotificationDeliveryModeEnum.default("best-effort").meta({
            description: "投递模式，strict 需要 ACK",
            title: "投递模式",
        }),
        traceLevel: NotificationTraceLevelEnum.default("minimal").meta({
            description: "追踪粒度",
            title: "追踪级别",
        }),
        traceContext: JsonRecordSchema.default({}).meta({
            description: "调试或监控需要的上下文信息",
            title: "追踪上下文",
        }),
        availableAt: z.date().nullable().optional().meta({
            description: "允许出队时间",
            title: "可用时间",
        }),
        expiresAt: z.date().nullable().optional().meta({
            description: "过期时间",
            title: "过期时间",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "最近更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "通知事件表",
        description: "存储通知事件基础信息",
    });

// 通知目标表
export const NotificationTargetsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "通知目标记录ID",
            title: "通知目标ID",
        }),
        notificationId: z.string().max(255).meta({
            description: "关联的通知事件ID",
            title: "通知ID",
        }),
        targetType: NotificationTargetTypeEnum.meta({
            description: "目标类型（用户、店铺、角色等）",
            title: "目标类型",
        }),
        targetId: z.string().max(255).meta({
            description: "目标标识，例如用户ID或角色名",
            title: "目标ID",
        }),
        userId: z.string().max(255).nullable().optional().meta({
            description: "当目标为用户时的用户ID",
            title: "用户ID",
        }),
        metadata: JsonRecordSchema.default({}).meta({
            description: "用于路由或内容的扩展信息",
            title: "目标元数据",
        }),
        channelPlan: z
            .array(NotificationChannelPlanItemSchema)
            .default([])
            .meta({
                description: "执行时缓存的渠道计划",
                title: "渠道计划",
            }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "通知目标表",
        description: "记录通知需要触达的用户或实体",
    });

// 通知投递日志
export const NotificationDeliveriesSchema = z
    .object({
        deliveryId: z.string().max(255).meta({
            description: "投递记录ID（可包含去重信息）",
            title: "投递ID",
        }),
        notificationId: z.string().max(255).meta({
            description: "关联的通知事件ID",
            title: "通知ID",
        }),
        targetId: z.string().max(255).meta({
            description: "关联的通知目标ID",
            title: "通知目标ID",
        }),
        channel: NotificationChannelEnum.meta({
            description: "实际使用的渠道",
            title: "渠道",
        }),
        status: NotificationDeliveryStatusEnum.default("pending").meta({
            description: "当前投递状态",
            title: "状态",
        }),
        attempt: z.number().int().min(1).default(1).meta({
            description: "第几次尝试",
            title: "尝试次数",
        }),
        lastError: z.string().max(2000).nullable().optional().meta({
            description: "最近一次失败原因",
            title: "错误信息",
        }),
        context: JsonRecordSchema.default({}).meta({
            description: "渠道调用上下文或响应",
            title: "上下文",
        }),
        deliveredAt: z.date().nullable().optional().meta({
            description: "标记为送达的时间",
            title: "送达时间",
        }),
        ackAt: z.date().nullable().optional().meta({
            description: "严格模式下客户端确认时间",
            title: "ACK 时间",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "通知投递日志",
        description: "记录每一次渠道投递的状态与上下文",
    });

// 通知 Outbox
export const NotificationOutboxSchema = z
    .object({
        notificationId: z.string().max(255).meta({
            description: "关联的通知事件ID",
            title: "通知ID",
        }),
        retryCount: z.number().int().min(0).default(0).meta({
            description: "重试次数",
            title: "重试次数",
        }),
        lockedAt: z.date().nullable().optional().meta({
            description: "锁定时间，防止重复消费",
            title: "锁定时间",
        }),
        lockOwner: z.string().max(128).nullable().optional().meta({
            description: "占用该任务的 worker 标识",
            title: "锁所有者",
        }),
        sent: z.boolean().default(false).meta({
            description: "是否已经写入队列",
            title: "是否已发送",
        }),
        lastError: z.string().max(2000).nullable().optional().meta({
            description: "最近一次推进失败原因",
            title: "错误",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "通知 Outbox",
        description: "数据出队的可靠性缓冲表",
    });

// 通知偏好表
export const NotificationPreferencesSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "偏好记录ID",
            title: "偏好ID",
        }),
        targetType: NotificationTargetTypeEnum.meta({
            description: "偏好适用的目标类型",
            title: "目标类型",
        }),
        targetId: z.string().max(255).meta({
            description: "偏好适用的目标ID",
            title: "目标ID",
        }),
        userId: z.string().max(255).nullable().optional().meta({
            description: "关联用户ID，可为空表示非用户主体",
            title: "用户ID",
        }),
        channelPlan: z
            .array(NotificationChannelPlanItemSchema)
            .default([])
            .meta({
                description: "用户配置的渠道计划",
                title: "渠道计划",
            }),
        metadata: JsonRecordSchema.default({}).meta({
            description: "附加配置，例如免打扰时间",
            title: "元数据",
        }),
        version: z.number().int().min(1).default(1).meta({
            description: "配置版本号，可用于缓存校验",
            title: "版本",
        }),
        createdAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "创建时间",
                title: "创建时间",
            }),
        updatedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "更新时间",
                title: "更新时间",
            }),
    })
    .meta({
        title: "通知偏好表",
        description: "存储用户或实体的通知渠道配置",
    });

// 优惠券使用记录表
export const CouponUsageRecordsSchema = z
    .object({
        id: z.string().max(255).meta({
            description: "优惠券使用记录ID",
            title: "优惠券使用记录ID",
        }),
        userCouponId: z.string().max(255).meta({
            description: "用户优惠券ID",
            title: "用户优惠券ID",
        }),
        orderId: z.string().max(255).meta({
            description: "订单ID",
            title: "订单ID",
        }),
        discountAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "折扣金额不能为负数")
            .meta({
                description: "折扣金额",
                title: "折扣金额",
            }),
        originalAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "原始金额不能为负数")
            .meta({
                description: "原始金额",
                title: "原始金额",
            }),
        finalAmount: z
            .number()
            .multipleOf(0.01)
            .min(0, "最终金额不能为负数")
            .meta({
                description: "最终金额",
                title: "最终金额",
            }),
        usedAt: z
            .date()
            .default(() => new Date())
            .meta({
                description: "使用时间",
                title: "使用时间",
            }),
    })
    .refine((data) => data.finalAmount <= data.originalAmount, {
        message: "最终金额不能超过原始金额",
        path: ["finalAmount"],
    })
    .meta({
        title: "优惠券使用记录表",
        description: "存储用户优惠券使用记录的表",
    });

// ==================== 导出所有类型 ====================

export type Users = z.infer<typeof UsersSchema>;
export type Accounts = z.infer<typeof AccountsSchema>;
export type Sessions = z.infer<typeof SessionsSchema>;
export type Verifications = z.infer<typeof VerificationsSchema>;
export type UserProfiles = z.infer<typeof UserProfilesSchema>;
// export type Shops = z.infer<typeof ShopsSchema>;
export type ServiceCategories = z.infer<typeof ServiceCategoriesSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type ServicePersonnel = z.infer<typeof ServicePersonnelSchema>;
export type ServicePersonnelPricing = z.infer<
    typeof ServicePersonnelPricingSchema
>;
export type ServicePersonnelSkills = z.infer<
    typeof ServicePersonnelSkillsSchema
>;
export type UserAddresses = z.infer<typeof UserAddressesSchema>;
export type Orders = z.infer<typeof OrdersSchema>;
export type OrderAssignments = z.infer<typeof OrderAssignmentsSchema>;
export type Payments = z.infer<typeof PaymentsSchema>;
export type Blocks = z.infer<typeof BlocksSchema>;
export type Follows = z.infer<typeof FollowsSchema>;
export type Reviews = z.infer<typeof ReviewsSchema>;
export type ReviewDataBaseStats = z.infer<typeof ReviewStatsDataBaseSchema>;
export type Earnings = z.infer<typeof EarningsSchema>;
export type Withdrawals = z.infer<typeof WithdrawalsSchema>;
export type Notifications = z.infer<typeof NotificationsSchema>;
export type NotificationTargets = z.infer<typeof NotificationTargetsSchema>;
export type NotificationDeliveries = z.infer<
    typeof NotificationDeliveriesSchema
>;
export type NotificationOutbox = z.infer<typeof NotificationOutboxSchema>;
export type NotificationPreferences = z.infer<
    typeof NotificationPreferencesSchema
>;
export type Coupons = z.infer<typeof CouponsSchema>;
export type CouponCategoryRestrictions = z.infer<
    typeof CouponCategoryRestrictionsSchema
>;
export type CouponServiceRestrictions = z.infer<
    typeof CouponServiceRestrictionsSchema
>;
export type UserCoupons = z.infer<typeof UserCouponsSchema>;
export type CouponUsageRecords = z.infer<typeof CouponUsageRecordsSchema>;
export type ChinaCity = z.infer<typeof ChinaCitySchema>;
export type FinancialTransactions = z.infer<typeof FinancialTransactionsSchema>;
export type UserBalances = z.infer<typeof UserBalancesSchema>;
export type OrderCheckins = z.infer<typeof OrderCheckinsSchema>;
export type AppReleases = z.infer<typeof AppReleasesSchema>;
