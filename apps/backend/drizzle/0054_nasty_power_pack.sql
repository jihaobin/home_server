ALTER TABLE "services" ADD COLUMN "image_file_id" varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "currency";