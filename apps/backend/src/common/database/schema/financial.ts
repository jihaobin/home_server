import { relations, sql } from "drizzle-orm";
import {
	pgTable,
	varchar,
	decimal,
	timestamp,
	index,
	pgEnum,
} from "drizzle-orm/pg-core";

import { createId } from ".";
import { users } from "./auth-user";
import { orders } from "./orders";
import { withdrawalStatusEnum } from "./enums";

/**
 * 交易类型枚举
 */
export const transactionTypeEnum = pgEnum("transaction_type", [
	"service_earning", // 服务收入
	"platform_fee", // 平台手续费
	"withdrawal", // 提现
	"refund_paid", // 退款支出
	"bonus", // 奖金
	"penalty", // 罚金
	"adjustment", // 手动调整
]);

/**
 * 资金流水表 (financial_transactions)
 * 记录所有资金流动，实现财务对账机制
 */
export const financialTransactions = pgTable(
	"financial_transactions",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$default(() => createId())
			.unique(), // 交易流水唯一一标识
		orderId: varchar("order_id", { length: 255 }).references(() => orders.id, {
			onDelete: "cascade",
		}), // 关联订单 (可为空)
		paymentId: varchar("payment_id", { length: 255 }), // 关联支付记录 (可为空)
		earningId: varchar("earning_id", { length: 255 }), // 关联收入记录 (可为空)
		withdrawalId: varchar("withdrawal_id", { length: 255 }), // 关联提现记录 (可为空)
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // 关联的用户 ID
		transactionType: transactionTypeEnum("transaction_type").notNull(), // 交易类型
		amount: decimal("amount", { precision: 18, scale: 2 }).notNull(), // 交易金额 (正数为收入，负数为支出)
		currency: varchar("currency", { length: 3 }).default("CNY").notNull(), // 币种代码
		balanceBefore: decimal("balance_before", { precision: 18, scale: 2 }), // 交易前余额
		balanceAfter: decimal("balance_after", { precision: 18, scale: 2 }), // 交易后余额
		description: varchar("description", { length: 500 }), // 交易描述
		referenceId: varchar("reference_id", { length: 255 }), // 外部引用 ID (如第三方支付号)
		metadata: varchar("metadata", { length: 1000 }), // 额外元数据 (JSON 格式)
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		// 用户交易时间索引 - 用于查询用户的交易历史
		index("idx_financial_transactions_user_time").on(
			table.userId,
			table.createdAt.desc(),
		),
		// 交易描述PGroonga全文搜索索引 - 仅为有描述的交易记录建立索引
		index("idx_financial_transactions_desc_search")
			.using("pgroonga", table.description)
			.where(sql`description IS NOT NULL AND description != ''`),
		// 交易类型时间索引 - 用于统计分析
		index("idx_financial_transactions_type_time").on(
			table.transactionType,
			table.createdAt.desc(),
		),
		// 订单相关交易索引 - 用于查询订单的所有资金流水
		index("idx_financial_transactions_order")
			.on(table.orderId)
			.where(sql`order_id IS NOT NULL`),
		// 外部引用 ID 索引 - 用于查询第三方交易
		index("idx_financial_transactions_reference")
			.on(table.referenceId)
			.where(sql`reference_id IS NOT NULL`),
		// 金额范围索引 - 用于财务分析
		index("idx_financial_transactions_amount_time").on(
			table.amount,
			table.createdAt.desc(),
		),
	],
);

/**
 * 用户余额表 (user_balances)
 * 统一管理用户账户余额
 */
export const userBalances = pgTable(
	"user_balances",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$default(() => createId())
			.unique(), // 余额记录唯一标识
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }), // 关联的用户 ID
		availableBalance: decimal("available_balance", {
			precision: 18,
			scale: 2,
		})
			.default("0")
			.notNull(), // 可用余额
		frozenBalance: decimal("frozen_balance", { precision: 18, scale: 2 })
			.default("0")
			.notNull(), // 冻结余额
		totalBalance: decimal("total_balance", { precision: 18, scale: 2 })
			.default("0")
			.notNull(), // 总余额 (可用 + 冻结)
		currency: varchar("currency", { length: 3 }).default("CNY").notNull(), // 币种代码
		lastTransactionId: varchar("last_transaction_id", { length: 255 }), // 最后一笔交易 ID
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdateFn(() => new Date()), // 最后更新时间
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		// 用户余额快速查询索引
		index("idx_user_balances_user_currency").on(table.userId, table.currency),
	],
);

/**
 * 收入记录表 (earnings)
 * 记录服务人员或店铺因完成订单而产生的收入
 */
export const earnings = pgTable(
	"earnings",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$default(() => createId())
			.unique(), // 收入记录唯一标识
		orderId: varchar("order_id", { length: 255 })
			.notNull()
			.references(() => orders.id, { onDelete: "restrict" }), // 关联的订单 ID
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // 收入归属者（服务人员或店主）的用户 ID
		amount: decimal("amount", { precision: 18, scale: 2 }).notNull(), // 收入金额
		currency: varchar("currency", { length: 3 }).default("CNY").notNull(), // 币种代码
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		// 用户收入时间索引 - 用于查询用户的收入历史
		index("idx_earnings_user_time").on(table.userId, table.createdAt.desc()),
		// 订单用户索引 - 用于查询特定订单的收入分配
		index("idx_earnings_order_user").on(table.orderId, table.userId),
		// 收入金额时间索引 - 用于统计有效收入
		index("idx_earnings_amount_time")
			.on(table.createdAt.desc(), table.amount)
			.where(sql`amount > 0`),
	],
);

/**
 * 提现记录表 (withdrawals)
 * 记录用户的提现请求和处理状态
 * 对应 SQL: CREATE TABLE withdrawals (...)
 */
export const withdrawals = pgTable(
	"withdrawals",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$default(() => createId())
			.unique(), // 提现请求唯一标识
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // 发起提现的用户 ID
		amount: decimal("amount", { precision: 18, scale: 2 }).notNull(), // 提现金额
		currency: varchar("currency", { length: 3 }).default("CNY").notNull(), // 币种代码
		status: withdrawalStatusEnum("status").notNull().default("pending"), // 提现状态
		requestedAt: timestamp("requested_at", {
			withTimezone: true,
		}).defaultNow(), // 请求时间
		processedAt: timestamp("processed_at", { withTimezone: true }), // 处理时间
	},
	(table) => [
		// 用户提现状态索引 - 用于查询用户的提现记录
		index("idx_withdrawals_user_status").on(
			table.userId,
			table.status,
			table.requestedAt.desc(),
		),
		// 提现状态时间索引 - 用于管理员查询待处理的提现
		index("idx_withdrawals_status_time")
			.on(table.status, table.requestedAt.desc())
			.where(sql`status IN ('pending', 'approved')`),
	],
);

// 资金流水记录关系定义
export const financialTransactionsRelations = relations(
	financialTransactions,
	({ one }) => ({
		order: one(orders, {
			fields: [financialTransactions.orderId],
			references: [orders.id],
		}),
		user: one(users, {
			fields: [financialTransactions.userId],
			references: [users.id],
		}),
		earning: one(earnings, {
			fields: [financialTransactions.earningId],
			references: [earnings.id],
		}),
		withdrawal: one(withdrawals, {
			fields: [financialTransactions.withdrawalId],
			references: [withdrawals.id],
		}),
	}),
);

// 用户余额关系定义
export const userBalancesRelations = relations(userBalances, ({ one }) => ({
	user: one(users, {
		fields: [userBalances.userId],
		references: [users.id],
	}),
}));

// 收入记录关系定义
export const earningsRelations = relations(earnings, ({ one }) => ({
	order: one(orders, {
		fields: [earnings.orderId],
		references: [orders.id],
	}),
	user: one(users, {
		fields: [earnings.userId],
		references: [users.id],
	}),
}));

// 提现记录关系定义
export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
	user: one(users, {
		fields: [withdrawals.userId],
		references: [users.id],
	}),
}));
