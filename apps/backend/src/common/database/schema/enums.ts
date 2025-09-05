import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 订单状态枚举
 * 对应 SQL: CREATE TYPE order_status AS ENUM (...)
 * 包含完整的业务流程和异常处理状态
 */
export const orderStatusEnum = pgEnum('order_status', [
    // 正常流程
    'pending_payment', // 待支付
    'pending_assignment', // 待分配/待接单
    'service_in_progress', // 服务中
    'service_paused', // 服务暂停
    'pending_acceptance', // 待验收
    'pending_review', // 待评价
    'completed', // 已完成

    // 异常流程 - 取消场景
    'user_cancelled', // 用户取消
    'service_cancelled', // 服务方取消
    'system_cancelled', // 系统取消

    // 异常流程 - 退款相关
    'refund_requested', // 申请退款
    'refund_processing', // 退款处理中
    'refund_approved', // 退款批准
    'refund_rejected', // 退款拒绝
    'refunded', // 已退款

    // 异常流程 - 其他
    'partially_completed', // 部分完成
    'expired', // 订单过期
    'force_closed', // 强制关闭
]);

/**
 * 支付状态枚举
 * 对应 SQL: CREATE TYPE payment_status AS ENUM (...)
 */
export const paymentStatusEnum = pgEnum('payment_status', [
    'pending', // 待处理
    'succeeded', // 成功
    'failed', // 失败
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
 * 提现状态枚举
 */
export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
    'pending', // 待审核
    'approved', // 审核通过
    'rejected', // 审核拒绝
    'completed', // 已完成
]);

/**
 * 通知类型枚举
 */
export const notificationTypeEnum = pgEnum('notification_type', [
    'system', // 系统消息
    'order_update', // 订单更新
    'promotion', // 优惠促销
]);

/**
 * 订单分配方式枚举
 */
export const assignmentTypeEnum = pgEnum('assignment_type', [
    'system_auto', // 系统自动派单
    'shop_dispatch', // 店铺指派
    'customer_designated', // 用户指定
    'grab', // 服务人员抢单
]);

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
