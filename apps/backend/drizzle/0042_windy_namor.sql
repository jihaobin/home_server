CREATE TYPE "public"."device_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expo_push_token" varchar(255) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"device_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "device_tokens_id_unique" UNIQUE("id"),
	CONSTRAINT "device_tokens_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_tokens_user" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_token" ON "device_tokens" USING btree ("expo_push_token");