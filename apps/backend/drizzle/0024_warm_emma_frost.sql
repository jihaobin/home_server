CREATE TYPE "public"."review_target_type" AS ENUM('personnel', 'shop');--> statement-breakpoint
CREATE TABLE "service_personnel_pricing" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"service_id" varchar(255) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CNY' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "service_personnel_pricing_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "shops" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "shops" CASCADE;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'service_personnel_shop_id_shops_id_fk') THEN
        ALTER TABLE "service_personnel" DROP CONSTRAINT "service_personnel_shop_id_shops_id_fk";
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'order_assignments_shop_id_shops_id_fk') THEN
        ALTER TABLE "order_assignments" DROP CONSTRAINT "order_assignments_shop_id_shops_id_fk";
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "order_assignments" ALTER COLUMN "assignment_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."assignment_type";--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('system_auto', 'customer_designated', 'grab');--> statement-breakpoint
ALTER TABLE "order_assignments" ALTER COLUMN "assignment_type" SET DATA TYPE "public"."assignment_type" USING "assignment_type"::"public"."assignment_type";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_service_personnel_shop_available";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_order_assignments_shop_time";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_service_personnel_available";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "target_type" SET DATA TYPE "public"."review_target_type" USING "target_type"::"public"."review_target_type";--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "service_quality" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "attitude" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "punctuality" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "helpful_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "unhelpful_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "service_personnel_pricing" ADD CONSTRAINT "service_personnel_pricing_user_id_service_personnel_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_personnel_pricing" ADD CONSTRAINT "service_personnel_pricing_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_personnel_pricing_user_service" ON "service_personnel_pricing" USING btree ("user_id","service_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_personnel_pricing_service_price" ON "service_personnel_pricing" USING btree ("service_id","price","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_personnel_pricing_effective" ON "service_personnel_pricing" USING btree ("effective_from","effective_to","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_location" ON "service_personnel" USING btree ("province","district","county","is_available") WHERE is_available = true;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_available" ON "service_personnel" USING btree ("is_available","user_id") WHERE is_available = true;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_personnel' AND column_name = 'shop_id') THEN
        ALTER TABLE "service_personnel" DROP COLUMN "shop_id";
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_assignments' AND column_name = 'shop_id') THEN
        ALTER TABLE "order_assignments" DROP COLUMN "shop_id";
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "service_quality_check" CHECK ("reviews"."service_quality" IS NULL OR ("reviews"."service_quality" >= 1 AND "reviews"."service_quality" <= 5));--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "attitude_check" CHECK ("reviews"."attitude" IS NULL OR ("reviews"."attitude" >= 1 AND "reviews"."attitude" <= 5));--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "punctuality_check" CHECK ("reviews"."punctuality" IS NULL OR ("reviews"."punctuality" >= 1 AND "reviews"."punctuality" <= 5));