CREATE TABLE "notification_voice_deliveries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"notification_id" varchar(255) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"out_id" varchar(255) NOT NULL,
	"call_id" varchar(255),
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"provider_status_code" varchar(64),
	"provider_status_message" text,
	"delivered_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_voice_deliveries_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "notification_voice_deliveries" ADD CONSTRAINT "notification_voice_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_voice_deliveries" ADD CONSTRAINT "notification_voice_deliveries_target_id_notification_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."notification_targets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_voice_deliveries_out_id_unique" ON "notification_voice_deliveries" USING btree ("out_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_voice_deliveries_call_id_unique" ON "notification_voice_deliveries" USING btree ("call_id");
--> statement-breakpoint
CREATE INDEX "idx_notification_voice_deliveries_notification" ON "notification_voice_deliveries" USING btree ("notification_id","target_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "idx_notification_voice_deliveries_status" ON "notification_voice_deliveries" USING btree ("status","created_at" DESC NULLS LAST);
