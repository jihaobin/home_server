CREATE
    EXTENSION IF NOT EXISTS "pg_trgm"; -- 用于模糊搜索
CREATE
    EXTENSION IF NOT EXISTS "btree_gin"; -- 用于复合索引优化

CREATE EXTENSION IF NOT EXISTS "postgis";

-- =================================================================
-- 自定义枚举类型 (ENUMs)
-- 设计说明: 使用枚举类型可以规范特定字段的取值范围，提高数据一致性和可读性，同时在数据库层面进行数据校验。
-- =================================================================

CREATE TYPE "public"."coupon_status" AS ENUM('active', 'inactive', 'expired', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('fixed_amount', 'percentage', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."user_coupon_status" AS ENUM('available', 'used', 'expired');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('system_auto', 'shop_dispatch', 'customer_designated', 'grab');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('system', 'order_update', 'promotion');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'pending_assignment', 'service_in_progress', 'pending_acceptance', 'pending_review', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'service_personnel', 'shop_admin', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint


CREATE TABLE "accounts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "accounts_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "accounts" IS '存储用户通过第三方 OAuth 提供商（如微信、Google）登录的信息。';

--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"user_id" varchar(255) NOT NULL,
	CONSTRAINT "sessions_id_unique" UNIQUE("id"),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

COMMENT ON TABLE "sessions" IS '管理用户的登录会话状态。';

--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) DEFAULT '' NOT NULL,
	"email_verified" boolean NOT NULL,
	"name" varchar(50) DEFAULT '' NOT NULL,
	"phone_number" varchar(20),
	"role" "user_role" DEFAULT 'customer',
	"is_active" boolean DEFAULT true NOT NULL,
	"image" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "users_id_unique" UNIQUE("id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);

COMMENT ON TABLE "users" IS '存储平台所有用户的核心认证信息和基本资料。';
COMMENT ON COLUMN "users"."id" IS '用户唯一标识 (主键)，建议使用 nanoid 或 UUID。';
COMMENT ON COLUMN "users"."email" IS '用户的电子邮箱，用于登录和接收通知。';
COMMENT ON COLUMN "users"."role" IS '定义用户在平台中的角色，如客户、服务人员等。';

--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "verifications_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "verifications" IS '存储一次性使用的验证令牌，例如用于邮箱验证、密码重置等场景。';

--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"real_name" varchar(50),
	"id_card_number" varchar(18),
	"face_recognition_data" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_profiles_id_card_number_unique" UNIQUE("id_card_number")
);

COMMENT ON TABLE "user_profiles" IS '存储用户的扩展信息，特别是实名认证等敏感信息，与核心用户表分离。';
COMMENT ON COLUMN "user_profiles"."user_id" IS '外键，关联到 users.id，形成一对一关系。';

--> statement-breakpoint
CREATE TABLE "service_personnel" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"shop_id" varchar(255),
	"bio" text,
	"years_of_experience" integer DEFAULT 0,
	"work_start_time" time,
	"work_end_time" time,
	"is_available" boolean DEFAULT true,
	CONSTRAINT "service_personnel_user_id_unique" UNIQUE("user_id")
);

COMMENT ON TABLE "service_personnel" IS '存储服务人员的专业信息，是对 users 表的扩展。';
COMMENT ON COLUMN "service_personnel"."user_id" IS '外键，关联到 users.id，形成一对一关系。';
COMMENT ON COLUMN "service_personnel"."shop_id" IS '外键，关联到 shops.id，表示服务人员所属的店铺，可以为 NULL。';

--> statement-breakpoint
CREATE TABLE "shops" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"address" varchar(255),
	"geom" geometry(point),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "shops_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "shops" IS '存储店铺的基本信息。';
COMMENT ON COLUMN "shops"."owner_id" IS '外键，关联到 users.id，表示店铺的所有者。';

--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"parent_id" varchar(15),
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "service_categories_id_unique" UNIQUE("id")
);


COMMENT ON TABLE "service_categories" IS '定义服务的分类体系，支持无限级分类。';
COMMENT ON COLUMN "service_categories"."parent_id" IS '外键，自关联到 service_categories.id，用于构建层级关系。';

--> statement-breakpoint
CREATE TABLE "service_personnel_skills" (
	"user_id" varchar(255) NOT NULL,
	"service_id" varchar(255) NOT NULL,
	CONSTRAINT "service_personnel_skills_pkey" PRIMARY KEY("user_id","service_id")
);

COMMENT ON TABLE "service_personnel_skills" IS '多对多关联表，记录服务人员掌握的服务技能。';

--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"category_id" varchar(15) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"estimated_duration_minutes" integer,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "services_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "services" IS '存储平台提供的具体服务项目信息。';
COMMENT ON COLUMN "services"."category_id" IS '外键，关联到 service_categories.id。';

--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"city" varchar(100),
	"geom" geometry(point),
	"recipient_name" varchar(50) NOT NULL,
	"recipient_phone" varchar(20) NOT NULL,
	"is_default" boolean DEFAULT false,
	CONSTRAINT "user_addresses_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "user_addresses" IS '存储用户的配送或服务地址信息。';

--> statement-breakpoint
CREATE TABLE "order_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"service_personnel_id" varchar(15),
	"shop_id" varchar(15),
	"assignment_type" "assignment_type" NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	CONSTRAINT "order_assignments_id_unique" UNIQUE("id"),
	CONSTRAINT "order_assignments_order_id_unique" UNIQUE("order_id")
);

COMMENT ON TABLE "order_assignments" IS '记录订单的分配情况，包括由谁（服务人员或店铺）以及何种方式（系统、指派、抢单）来执行服务。';

--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_serial" varchar(50) NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"service_id" varchar(15) NOT NULL,
	"address_id" varchar(15) NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"original_amount" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) NOT NULL,
	"coupon_code" varchar(50),
	"appointment_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "orders_id_unique" UNIQUE("id"),
	CONSTRAINT "orders_order_serial_unique" UNIQUE("order_serial")
);

COMMENT ON TABLE "orders" IS '核心订单信息表，记录了订单的基本数据。';


--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" varchar(50),
	"transaction_id" varchar(255),
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payments_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "payments" IS '记录与订单相关的支付信息。';

--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" varchar(255) NOT NULL,
	"blocked_id" varchar(255) NOT NULL,
	CONSTRAINT "blocks_pkey" PRIMARY KEY("blocker_id","blocked_id")
);

COMMENT ON TABLE "blocks" IS '记录用户之间的屏蔽关系，例如客户不希望再看到某个服务人员。';

--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" varchar(255) NOT NULL,
	"following_id" varchar(255) NOT NULL,
	CONSTRAINT "follows_pkey" PRIMARY KEY("follower_id","following_id")
);

COMMENT ON TABLE "follows" IS '记录用户之间的关注关系，例如客户关注某个服务人员。';

--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"reviewer_id" varchar(255) NOT NULL,
	"target_id" varchar(15) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "reviews_id_unique" UNIQUE("id"),
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "rating_check" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);

COMMENT ON TABLE "reviews" IS '存储用户对服务人员或店铺的评价。';
COMMENT ON COLUMN "reviews"."target_id" IS '被评价对象的 ID，可以是 service_personnel.user_id 或 shops.id。';
COMMENT ON COLUMN "reviews"."target_type" IS '用于区分 target_id 指向的是服务人员还是店铺。';

--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(15) NOT NULL,
	"user_id" varchar(15) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "earnings_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "earnings" IS '记录服务人员或店铺因完成订单而产生的收入。';

--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	CONSTRAINT "withdrawals_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "withdrawals" IS '记录用户的提现请求和处理状态。';

--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notifications_id_unique" UNIQUE("id")
);

COMMENT ON TABLE "notifications" IS '存储发送给用户的各类通知。';

--> statement-breakpoint
CREATE TABLE "coupon_category_restrictions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"coupon_id" varchar(15) NOT NULL,
	"category_id" varchar(15) NOT NULL,
	CONSTRAINT "coupon_category_restrictions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "coupon_service_restrictions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"coupon_id" varchar(15) NOT NULL,
	"service_id" varchar(15) NOT NULL,
	CONSTRAINT "coupon_service_restrictions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "coupon_usage_records" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_coupon_id" varchar(15) NOT NULL,
	"order_id" varchar(15) NOT NULL,
	"discount_amount" numeric(10, 2) NOT NULL,
	"original_amount" numeric(10, 2) NOT NULL,
	"final_amount" numeric(10, 2) NOT NULL,
	"used_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "coupon_usage_records_id_unique" UNIQUE("id"),
	CONSTRAINT "discount_amount_positive" CHECK ("coupon_usage_records"."discount_amount" >= 0),
	CONSTRAINT "final_amount_non_negative" CHECK ("coupon_usage_records"."final_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" "coupon_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2) DEFAULT '0',
	"max_discount_amount" numeric(10, 2),
	"usage_limit" integer DEFAULT 1,
	"total_usage_limit" integer,
	"current_usage_count" integer DEFAULT 0,
	"is_multi_use" boolean DEFAULT false,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"status" "coupon_status" DEFAULT 'active',
	"created_by" varchar(15),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "coupons_id_unique" UNIQUE("id"),
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_value_positive" CHECK ("coupons"."discount_value" > 0),
	CONSTRAINT "min_order_amount_non_negative" CHECK ("coupons"."min_order_amount" >= 0),
	CONSTRAINT "valid_period_check" CHECK ("coupons"."valid_from" < "coupons"."valid_until")
);
--> statement-breakpoint
CREATE TABLE "user_coupons" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(15) NOT NULL,
	"coupon_id" varchar(15) NOT NULL,
	"status" "user_coupon_status" DEFAULT 'available',
	"used_count" integer DEFAULT 0,
	"obtained_at" timestamp with time zone DEFAULT now(),
	"first_used_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "user_coupons_id_unique" UNIQUE("id")
);

-- 外键
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD CONSTRAINT "service_personnel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD CONSTRAINT "service_personnel_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "fk_sc_parent" FOREIGN KEY ("parent_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_personnel_skills" ADD CONSTRAINT "service_personnel_skills_user_id_service_personnel_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_personnel_skills" ADD CONSTRAINT "service_personnel_skills_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_service_personnel_id_service_personnel_user_id_fk" FOREIGN KEY ("service_personnel_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_user_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."user_addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_category_restrictions" ADD CONSTRAINT "coupon_category_restrictions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_category_restrictions" ADD CONSTRAINT "coupon_category_restrictions_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_service_restrictions" ADD CONSTRAINT "coupon_service_restrictions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_service_restrictions" ADD CONSTRAINT "coupon_service_restrictions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ADD CONSTRAINT "coupon_usage_records_user_coupon_id_user_coupons_id_fk" FOREIGN KEY ("user_coupon_id") REFERENCES "public"."user_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage_records" ADD CONSTRAINT "coupon_usage_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 索引
CREATE UNIQUE INDEX "idx_users_email_active" ON "users" USING btree ("email") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_phone_active" ON "users" USING btree ("phone_number") WHERE phone_number IS NOT NULL AND is_active = true;--> statement-breakpoint
CREATE INDEX "idx_users_role_active" ON "users" USING btree ("role","is_active","created_at");--> statement-breakpoint
CREATE INDEX "idx_service_personnel_available" ON "service_personnel" USING btree ("is_available","shop_id","user_id") WHERE is_available = true;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_shop_available" ON "service_personnel" USING btree ("shop_id","is_available") WHERE shop_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_work_time" ON "service_personnel" USING btree ("work_start_time","work_end_time","is_available") WHERE is_available = true;--> statement-breakpoint
CREATE INDEX "idx_shops_location" ON "shops" USING gist ("geom") WHERE geom IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_shops_owner_active" ON "shops" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_service_categories_parent" ON "service_categories" USING btree ("parent_id","id") WHERE parent_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_service_categories_name" ON "service_categories" USING gin (name gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_service_personnel_skills_service" ON "service_personnel_skills" USING btree ("service_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_service_personnel_skills_user" ON "service_personnel_skills" USING btree ("user_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_services_category_active" ON "services" USING btree ("category_id","is_active","base_price") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_services_price_range" ON "services" USING btree ("base_price","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_services_name_search" ON "services" USING gin (name gin_trgm_ops) WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_services_duration" ON "services" USING btree ("estimated_duration_minutes","is_active") WHERE is_active = true AND estimated_duration_minutes IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_addresses_location" ON "user_addresses" USING gist ("geom") WHERE geom IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_addresses_user_default" ON "user_addresses" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE INDEX "idx_order_assignments_personnel_time" ON "order_assignments" USING btree ("service_personnel_id","assigned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_order_assignments_shop_time" ON "order_assignments" USING btree ("shop_id","assigned_at" DESC NULLS LAST) WHERE shop_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_order_assignments_type_time" ON "order_assignments" USING btree ("assignment_type","assigned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_orders_customer_status_time" ON "orders" USING btree ("customer_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_orders_status_appointment" ON "orders" USING btree ("status","appointment_time") WHERE status IN ('pending_assignment', 'service_in_progress');--> statement-breakpoint
CREATE INDEX "idx_orders_service_time" ON "orders" USING btree ("service_id","created_at" DESC NULLS LAST) WITH (fillfactor=70);--> statement-breakpoint
CREATE INDEX "idx_orders_serial_lookup" ON "orders" USING btree ("order_serial");--> statement-breakpoint
CREATE INDEX "idx_payments_order_status" ON "payments" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "idx_payments_status_time" ON "payments" USING btree ("status","paid_at") WHERE paid_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_payments_transaction_id" ON "payments" USING btree ("transaction_id") WHERE transaction_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_blocks_blocker" ON "blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_blocked" ON "blocks" USING btree ("blocked_id","blocker_id");--> statement-breakpoint
CREATE INDEX "idx_follows_follower" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "idx_follows_following" ON "follows" USING btree ("following_id","follower_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_target_rating" ON "reviews" USING btree ("target_id","target_type","rating" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reviews_order_unique" ON "reviews" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_reviewer_time" ON "reviews" USING btree ("reviewer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_earnings_user_time" ON "earnings" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_earnings_order_user" ON "earnings" USING btree ("order_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_earnings_amount_time" ON "earnings" USING btree ("created_at" DESC NULLS LAST,"amount") WHERE amount > 0;--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user_status" ON "withdrawals" USING btree ("user_id","status","requested_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status_time" ON "withdrawals" USING btree ("status","requested_at" DESC NULLS LAST) WHERE status IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","is_read","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_type_time" ON "notifications" USING btree ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_type" ON "notifications" USING btree ("user_id","type","is_read");--> statement-breakpoint
CREATE INDEX "idx_coupon_category_coupon_id" ON "coupon_category_restrictions" USING btree ("coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupon_category_unique" ON "coupon_category_restrictions" USING btree ("coupon_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_service_coupon_id" ON "coupon_service_restrictions" USING btree ("coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupon_service_unique" ON "coupon_service_restrictions" USING btree ("coupon_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_usage_user_coupon" ON "coupon_usage_records" USING btree ("user_coupon_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_usage_order" ON "coupon_usage_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_usage_used_at" ON "coupon_usage_records" USING btree ("used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupons_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_coupons_status_valid" ON "coupons" USING btree ("status","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "idx_user_coupons_user_id" ON "user_coupons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_coupons_coupon_id" ON "user_coupons" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "idx_user_coupons_status" ON "user_coupons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_coupons_user_status" ON "user_coupons" USING btree ("user_id","status");

-- =================================================================
-- 9. 数据一致性增强
-- =================================================================

-- 添加订单状态流转约束
CREATE
    OR REPLACE FUNCTION validate_order_status_transition()
    RETURNS TRIGGER AS
$$
BEGIN
    -- 定义允许的状态转换
    IF
        OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
        -- 检查状态转换是否合法
        IF NOT (
            (OLD.status = 'pending_payment' AND NEW.status IN ('pending_assignment', 'cancelled')) OR
            (OLD.status = 'pending_assignment' AND NEW.status IN ('service_in_progress', 'cancelled')) OR
            (OLD.status = 'service_in_progress' AND NEW.status IN ('pending_acceptance', 'cancelled')) OR
            (OLD.status = 'pending_acceptance' AND NEW.status IN ('pending_review', 'completed')) OR
            (OLD.status = 'pending_review' AND NEW.status = 'completed') OR
            (OLD.status IN ('cancelled', 'completed') AND NEW.status = 'refunded')
            ) THEN
            RAISE EXCEPTION '非法的订单状态转换: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    -- 更新修改时间
    NEW.updated_at
        = NOW();
    RETURN NEW;
END;
$$
    LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_order_status_validation ON orders;
CREATE TRIGGER trg_order_status_validation
    BEFORE UPDATE
    ON orders
    FOR EACH ROW
EXECUTE FUNCTION validate_order_status_transition();

-- 添加金额一致性检查
CREATE
    OR REPLACE FUNCTION validate_payment_amount()
    RETURNS TRIGGER AS
$$
BEGIN
    -- 检查支付金额是否与订单金额一致
    IF
        NEW.status = 'succeeded' THEN
        IF NOT EXISTS (SELECT 1
                       FROM orders
                       WHERE id = NEW.order_id
                         AND total_amount = NEW.amount) THEN
            RAISE EXCEPTION '支付金额与订单金额不一致';
        END IF;
    END IF;
    RETURN NEW;
END;
$$
    LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_amount_validation ON payments;
CREATE TRIGGER trg_payment_amount_validation
    BEFORE UPDATE
    ON payments
    FOR EACH ROW
EXECUTE FUNCTION validate_payment_amount();

-- =================================================================
-- 索引维护脚本
-- =================================================================

-- 创建表大小监控函数
CREATE
    OR REPLACE FUNCTION get_table_sizes()
    RETURNS TABLE
            (
                table_name text,
                row_count  bigint,
                total_size text,
                index_size text,
                table_size text
            )
AS
$$
BEGIN
    RETURN QUERY
        SELECT table_name::text,
               t.n_tup_ins - t.n_tup_del                     as row_count,
               pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
               pg_size_pretty(pg_indexes_size(c.oid))        as index_size,
               pg_size_pretty(pg_relation_size(c.oid))       as table_size
        FROM pg_stat_user_tables t
                 JOIN pg_class c ON t.relname = c.relname
        WHERE t.schemaname = 'public'
        ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$
    LANGUAGE plpgsql;


-- 显示优化摘要
DO
$$
    BEGIN
        RAISE
            NOTICE '=================================================================';
        RAISE
            NOTICE '建议执行以下命令检查数据表状态：';
        RAISE
            NOTICE 'SELECT * FROM get_index_usage_stats();';
        RAISE
            NOTICE 'SELECT * FROM get_table_sizes();';
        RAISE
            NOTICE '=================================================================';
    END
$$;