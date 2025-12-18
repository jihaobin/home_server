ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_channel";--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'tencent_cloud_push', 'sms');--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" SET DATA TYPE "public"."notification_channel" USING "channel"::"public"."notification_channel";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "devices" jsonb DEFAULT '[]'::jsonb NOT NULL;