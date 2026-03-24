import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 订单状态枚举 - MVP简化版本
 * 对应 SQL: CREATE TYPE order_status AS ENUM (...)
 * 专注核心业务流程，避免过度复杂化
 */
export const orderStatusEnum = pgEnum('order_status', [
    'pending_payment', // 待支付
    'payment_timeout', // 支付超时
    'paid', // 已支付（等待服务人员上门进行服务）
    'pending_acceptance', // 待接单（等待服务人员确认）
    'staff_rejected', // 服务人员拒绝接单
    'in_progress', // 服务中
    'completed', // 已完成（包含已评价和未评价）
    'cancelled', // 已取消（各种原因的取消统一处理）
    'refunded', // 已退款
]);

/**
 * 支付状态枚举
 * 对应 SQL: CREATE TYPE payment_status AS ENUM (...)
 */
export const paymentStatusEnum = pgEnum('payment_status', [
    'pending', // 待处理
    'succeeded', // 成功
    'failed', // 失败
    'refunded', // 已退款
]);

/**
 * 支付方法枚举
 */

export const paymentMethodEnum = pgEnum('payment_method', [
    'wechat_pay', // 微信支付
    'alipay', // 支付宝
    'bank_transfer', // 银行转账
]);

/**
 * 提现收款账号类型枚举
 */
export const payeeAccountTypeEnum = pgEnum('payee_account_type', [
    'ALIPAY_USER_ID',
    'ALIPAY_LOGON_ID',
    'ALIPAY_OPEN_ID',
    'WECHAT_OPENID',
]);

/**
 * 提现状态枚举
 */
export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
    'pending', // 待审核
    'approved', // 审核通过
    'processing', // 渠道处理中
    'failed', // 渠道打款失败
    'cancelled', // 渠道取消或系统取消
    'rejected', // 审核拒绝
    'completed', // 已完成
]);

/**
 * 通用通知模块相关枚举。
 * 这些值需要与 docs/notification-tech-plan.md 中描述的“优先级/状态/渠道”等概念保持一致，
 * 以便数据库、类型系统与调度逻辑共享同一套 DSL。
 */
export const notificationPriorityEnum = pgEnum('notification_priority', [
    'high', // 最高优先级，适用于支付失败等关键事件
    'normal', // 默认优先级，大多数业务通知
    'low', // 低优先级，可延迟或批量发送
]);

export const notificationStatusEnum = pgEnum('notification_status', [
    'pending', // 刚写入数据库，等待 Outbox 处理
    'queued', // 已写入 Redis Stream 正在等待消费
    'dispatching', // Dispatcher 正在执行渠道计划
    'succeeded', // 全部渠道流程完成（含可选 ACK）
    'failed', // 所有渠道都失败或超出重试
    'cancelled', // 被业务取消（例如订单撤销）
]);

export const notificationDeliveryModeEnum = pgEnum(
    'notification_delivery_mode',
    [
        'strict', // 需要客户端 ACK 才算送达
        'best-effort', // 尽力而为，发送成功即可
    ],
);

export const notificationTraceLevelEnum = pgEnum('notification_trace_level', [
    'none', // 不记录投递轨迹
    'minimal', // 记录关键节点
    'full', // 记录详细的调度/重试信息
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
    'in_app', // WS 内部实时通知（前台）
    'tencent_cloud_push', // 腾讯云消息推送（后台/离线）
    'sms', // 短信兜底渠道
]);

// 目标类型用于快速区分用户/角色等主体，便于多租户或跨业务复用。
export const notificationTargetTypeEnum = pgEnum('notification_target_type', [
    'user', // 直接针对单个用户
    'service_personnel', // 服务人员（可与 userId 同步）
    'shop', // 店铺或商户主体
    'role', // 基于角色广播
    'custom', // 其它业务自定义实体
]);

export const notificationDeliveryStatusEnum = pgEnum(
    'notification_delivery_status',
    [
        'pending', // 等待渠道执行
        'scheduled', // 已加入渠道内部任务
        'sent', // 渠道调用成功但未确认送达
        'delivered', // 渠道确认送达（若支持）
        'failed', // 渠道发送失败
        'acknowledged', // 客户端反馈已收到
    ],
);

/**
 * 订单分配方式枚举
 */
export const assignmentTypeEnum = pgEnum('assignment_type', [
    'system_auto', // 系统自动派单
    // 'shop_dispatch', // 店铺指派
    'customer_designated', // 用户指定
    'grab', // 服务人员抢单
]);

/**
 * 订单分配决策状态
 */
export const assignmentDecisionStatusEnum = pgEnum(
    'assignment_decision_status',
    [
        'pending', // 待决定
        'accepted', // 已接单
        'rejected', // 已拒绝
    ],
);

/**
 * 用户角色枚举
 */
export const roleEnum = pgEnum('user_role', [
    'customer', // 客户
    'service_personnel', // 服务人员
    'shop_admin', // 店铺管理员
    'admin', // 管理员
    'super_admin', // 超级管理员
]);

/**
 * 评价目标类型枚举
 */
export const reviewTargetTypeEnum = pgEnum('review_target_type', [
    'personnel', // 服务人员
    'shop', // 店铺
]);
/**
 * 订单到场核验状态枚举
 */
export const orderCheckinStatusEnum = pgEnum('order_checkin_status', [
    'pending', // 待核验
    'verified', // 已核验
    'revoked', // 主动作废
    'expired', // 已过期
]);

/**
 * 应用发布相关枚举
 */
export const appReleaseAppEnum = pgEnum('app_release_app', [
    'mobile-user', // 用户端
    'mobile-worker', // 服务人员端
]);

export const appReleasePlatformEnum = pgEnum('app_release_platform', [
    'android',
    'ios',
]);

export const appReleaseStatusEnum = pgEnum('app_release_status', [
    'draft', // 草稿
    'published', // 已发布
    'rollbacked', // 已回滚
]);

export const appReleaseChannelEnum = pgEnum('app_release_channel', [
    'production', // 正式环境
    'staging', // 预发布/灰度
]);
