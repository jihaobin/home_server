CREATE TABLE "home_banners" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"image_file_id" varchar(255) NOT NULL,
	"link_type" varchar(20) DEFAULT 'none' NOT NULL,
	"link_target" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "home_banners_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "home_guarantees" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"icon_file_id" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "home_guarantees_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "home_promos" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"pricing_id" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"override_title" varchar(255),
	"override_image_file_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "home_promos_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_guarantees" ADD CONSTRAINT "home_guarantees_icon_file_id_files_id_fk" FOREIGN KEY ("icon_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_promos" ADD CONSTRAINT "home_promos_pricing_id_service_personnel_pricing_id_fk" FOREIGN KEY ("pricing_id") REFERENCES "public"."service_personnel_pricing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_promos" ADD CONSTRAINT "home_promos_override_image_file_id_files_id_fk" FOREIGN KEY ("override_image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_home_banners_active_sort" ON "home_banners" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_home_guarantees_active_sort" ON "home_guarantees" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_home_promos_active_sort" ON "home_promos" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_home_promos_pricing" ON "home_promos" USING btree ("pricing_id");