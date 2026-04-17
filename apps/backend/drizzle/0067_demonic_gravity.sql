CREATE TABLE "service_tags" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"domain" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	CONSTRAINT "service_tags_id_unique" UNIQUE("id")
);
--> statement-breakpoint
DROP INDEX "idx_home_banners_active_sort";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "service_tag_id" varchar(255);--> statement-breakpoint
ALTER TABLE "home_banners" ADD COLUMN "scene" varchar(20) DEFAULT 'home' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_service_tags_domain_order" ON "service_tags" USING btree ("domain","sort_order","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_tags_domain_slug" ON "service_tags" USING btree ("domain","slug");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_service_tag_id_service_tags_id_fk" FOREIGN KEY ("service_tag_id") REFERENCES "public"."service_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_services_service_tag" ON "services" USING btree ("service_tag_id","id");--> statement-breakpoint
CREATE INDEX "idx_home_banners_active_sort" ON "home_banners" USING btree ("is_active","scene","sort_order");