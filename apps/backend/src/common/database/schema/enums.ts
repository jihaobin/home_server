import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 订单状态枚举 - MVP简化版本
 * 对应 SQL: CREATE TYPE order_status AS ENUM (...)
 * 专注核心业务流程，避免过度复杂化
 */
export const orderStatusEnum = pgEnum('order_status', [
    'pending_payment', // 待支付
    'paid', // 已支付（等待服务人员上门进行服务）
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
    // 'shop_dispatch', // 店铺指派
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
