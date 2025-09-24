CREATE TYPE "public"."order_checkin_status" AS ENUM('pending', 'verified', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "order_checkins" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"status" "order_checkin_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" varchar(255),
	"verified_geom" geometry(point),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "order_checkins_id_unique" UNIQUE("id"),
	CONSTRAINT "order_checkins_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "order_checkins" ADD CONSTRAINT "order_checkins_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_checkins" ADD CONSTRAINT "order_checkins_verified_by_service_personnel_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."service_personnel"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_checkins_order_status" ON "order_checkins" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "idx_order_checkins_expires" ON "order_checkins" USING btree ("expires_at");