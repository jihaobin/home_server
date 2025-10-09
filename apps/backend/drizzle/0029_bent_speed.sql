ALTER TYPE "public"."transaction_type" ADD VALUE 'payment_received';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;