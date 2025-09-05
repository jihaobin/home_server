CREATE TYPE "public"."transaction_type" AS ENUM('service_earning', 'platform_fee', 'withdrawal', 'refund_paid', 'bonus', 'penalty', 'adjustment');--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(255),
	"payment_id" varchar(255),
	"earning_id" varchar(255),
	"withdrawal_id" varchar(255),
	"user_id" varchar(255) NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CNY' NOT NULL,
	"balance_before" numeric(18, 2),
	"balance_after" numeric(18, 2),
	"description" varchar(500),
	"reference_id" varchar(255),
	"metadata" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "financial_transactions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "user_balances" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"available_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"frozen_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'CNY' NOT NULL,
	"last_transaction_id" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_balances_id_unique" UNIQUE("id"),
	CONSTRAINT "user_balances_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "coupons" RENAME COLUMN "current_usage_count" TO "currency";--> statement-breakpoint
-- 修复订单状态枚举类型更新
-- 第一步：移除默认值和任何约束
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
-- 创建临时列来存储状态数据
ALTER TABLE "orders" ADD COLUMN "status_temp" text;--> statement-breakpoint
-- 复制现有状态数据到临时列
UPDATE "orders" SET "status_temp" = "status"::text;--> statement-breakpoint
-- 删除原状态列
ALTER TABLE "orders" DROP COLUMN "status";--> statement-breakpoint
-- 删除旧的枚举类型
DROP TYPE "public"."order_status";--> statement-breakpoint
-- 创建新的枚举类型
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'pending_assignment', 'service_in_progress', 'service_paused', 'pending_acceptance', 'pending_review', 'completed', 'user_cancelled', 'service_cancelled', 'system_cancelled', 'refund_requested', 'refund_processing', 'refund_approved', 'refund_rejected', 'refunded', 'partially_completed', 'expired', 'force_closed');--> statement-breakpoint
-- 重新添加状态列，使用新的枚举类型
ALTER TABLE "orders" ADD COLUMN "status" "public"."order_status" NOT NULL DEFAULT 'pending_payment';--> statement-breakpoint
-- 从临时列恢复数据
UPDATE "orders" SET "status" = "status_temp"::"public"."order_status";--> statement-breakpoint
-- 删除临时列
ALTER TABLE "orders" DROP COLUMN "status_temp";--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "category_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "base_price" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "order_assignments" ALTER COLUMN "service_personnel_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "order_assignments" ALTER COLUMN "shop_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "service_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "address_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "original_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "target_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "earnings" ALTER COLUMN "order_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "earnings" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "earnings" ALTER COLUMN "amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "withdrawals" ALTER COLUMN "amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupon_category_restrictions" ALTER COLUMN "coupon_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_category_restrictions" ALTER COLUMN "category_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_service_restrictions" ALTER COLUMN "coupon_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_service_restrictions" ALTER COLUMN "service_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ALTER COLUMN "user_coupon_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ALTER COLUMN "order_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ALTER COLUMN "discount_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ALTER COLUMN "original_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ALTER COLUMN "final_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "discount_value" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "min_order_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "min_order_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "max_discount_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "user_coupons" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "user_coupons" ALTER COLUMN "coupon_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "earnings" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ADD COLUMN "currency" varchar(3) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_user_time" ON "financial_transactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_type_time" ON "financial_transactions" USING btree ("transaction_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_order" ON "financial_transactions" USING btree ("order_id") WHERE order_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_reference" ON "financial_transactions" USING btree ("reference_id") WHERE reference_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_amount_time" ON "financial_transactions" USING btree ("amount","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_balances_user_currency" ON "user_balances" USING btree ("user_id","currency");--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "fk_sc_parent" FOREIGN KEY ("parent_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;