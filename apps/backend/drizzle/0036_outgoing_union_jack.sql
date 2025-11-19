CREATE TABLE "files" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"bucket_name" varchar(100) NOT NULL,
	"object_path" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"thumbnail_path" varchar(500),
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"is_public" boolean DEFAULT false,
	"access_count" integer DEFAULT 0,
	"reference_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "files_id_unique" UNIQUE("id"),
	CONSTRAINT "files_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
DROP INDEX "idx_services_category_active";--> statement-breakpoint
DROP INDEX "idx_services_price_range";--> statement-breakpoint
DROP INDEX "idx_services_duration";--> statement-breakpoint
ALTER TABLE "service_personnel_pricing" ADD COLUMN "estimated_duration_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "specification_id" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "file_hash_idx" ON "files" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "uploader_idx" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "file_type_idx" ON "files" USING btree ("file_type");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_specification_id_service_personnel_pricing_id_fk" FOREIGN KEY ("specification_id") REFERENCES "public"."service_personnel_pricing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_services_duration" ON "service_personnel_pricing" USING btree ("estimated_duration_minutes","is_active") WHERE is_active = true AND estimated_duration_minutes IS NOT NULL;--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "base_price";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "estimated_duration_minutes";