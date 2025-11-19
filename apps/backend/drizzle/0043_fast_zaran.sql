DROP TABLE "device_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "order_assignments" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_completed_at" timestamp with time zone;--> statement-breakpoint
DROP TYPE "public"."device_platform";