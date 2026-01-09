CREATE TYPE "public"."app_release_app" AS ENUM('mobile-user', 'mobile-worker');--> statement-breakpoint
CREATE TYPE "public"."app_release_channel" AS ENUM('production', 'staging');--> statement-breakpoint
CREATE TYPE "public"."app_release_platform" AS ENUM('android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."app_release_status" AS ENUM('draft', 'published', 'rollbacked');--> statement-breakpoint
CREATE TABLE "app_releases" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"app" "app_release_app" NOT NULL,
	"platform" "app_release_platform" NOT NULL,
	"version" varchar(64) NOT NULL,
	"build_number" integer,
	"release_status" "app_release_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"force_update" boolean DEFAULT false NOT NULL,
	"min_supported_version" varchar(64),
	"changelog" text,
	"download_url_override" varchar(1024),
	"release_channel" "app_release_channel" DEFAULT 'production' NOT NULL,
	"rollout_percent" integer DEFAULT 100 NOT NULL,
	"file_id" varchar(255),
	"created_by" varchar(255) NOT NULL,
	"published_by" varchar(255),
	"published_at" timestamp with time zone,
	"rollback_from_id" varchar(255),
	"download_count" integer DEFAULT 0 NOT NULL,
	"force_update_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_releases_id_unique" UNIQUE("id"),
	CONSTRAINT "app_release_rollout_percent_range" CHECK ("app_releases"."rollout_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_rollback_from_fk" FOREIGN KEY ("rollback_from_id") REFERENCES "public"."app_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_release_version_unique" ON "app_releases" USING btree ("app","platform","version");--> statement-breakpoint
CREATE INDEX "app_release_active_idx" ON "app_releases" USING btree ("app","platform","is_active","release_status");--> statement-breakpoint
CREATE INDEX "app_release_published_idx" ON "app_releases" USING btree ("app","platform","published_at") WHERE published_at IS NOT NULL;