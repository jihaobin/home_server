ALTER TABLE "files" ADD COLUMN "blurhash" varchar(255);--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "thumbnail_path";