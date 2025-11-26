ALTER TABLE "service_categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "icon_file_id" varchar(255);--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_icon_file_id_files_id_fk" FOREIGN KEY ("icon_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_categories_order" ON "service_categories" USING btree ("dep","sort_order","id");