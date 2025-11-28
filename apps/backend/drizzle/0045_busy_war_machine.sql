CREATE TYPE "public"."payee_account_type" AS ENUM('ALIPAY_USER_ID', 'ALIPAY_LOGON_ID', 'ALIPAY_OPEN_ID');--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "method" "payment_method" DEFAULT 'alipay' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "payee_account" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "payee_account_type" "payee_account_type" DEFAULT 'ALIPAY_LOGON_ID' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "payee_name" varchar(255);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "remark" varchar(500);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "review_note" varchar(1000);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "reviewed_by_admin_id" varchar(255);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "payout_reference_id" varchar(255);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "failure_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_reviewed_by_admin_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;