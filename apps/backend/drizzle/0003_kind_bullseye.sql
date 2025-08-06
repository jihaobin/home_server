CREATE TYPE "public"."payment_method" AS ENUM('wechat_pay', 'alipay', 'bank_transfer');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_method" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "home_number" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN "home_number" varchar(50) NOT NULL;