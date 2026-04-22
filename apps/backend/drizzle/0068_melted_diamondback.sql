CREATE TABLE "merchant_join_requests" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"merchant_name" varchar(50) NOT NULL,
	"gender" varchar(16) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"age" integer NOT NULL,
	"intent_city" varchar(255) NOT NULL,
	"photo_file_id" varchar(255),
	"is_contacted" boolean DEFAULT false NOT NULL,
	"admin_remark" text,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_join_requests_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE INDEX "idx_merchant_join_requests_created_at" ON "merchant_join_requests" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_merchant_join_requests_contacted_created_at" ON "merchant_join_requests" USING btree ("is_contacted","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_merchant_join_requests_phone" ON "merchant_join_requests" USING btree ("phone");