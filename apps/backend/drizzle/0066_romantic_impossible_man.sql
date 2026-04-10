CREATE TYPE "public"."category_commission_strategy_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "category_commission_strategies" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"category_id" varchar(255) NOT NULL,
	"strategy_name" varchar(100) NOT NULL,
	"status" "category_commission_strategy_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" varchar(255),
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"published_by" varchar(255),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_commission_strategies_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "category_commission_strategy_rules" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"strategy_version_id" varchar(255) NOT NULL,
	"threshold" numeric(18, 2) DEFAULT 0 NOT NULL,
	"commission_rate" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_commission_strategy_rules_id_unique" UNIQUE("id"),
	CONSTRAINT "category_commission_strategy_rule_threshold_check" CHECK ("category_commission_strategy_rules"."threshold" >= 0),
	CONSTRAINT "category_commission_strategy_rule_rate_check" CHECK ("category_commission_strategy_rules"."commission_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "category_commission_strategy_versions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"strategy_id" varchar(255) NOT NULL,
	"version_no" integer NOT NULL,
	"status" "category_commission_strategy_status" DEFAULT 'draft' NOT NULL,
	"version_note" varchar(500),
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"beginner_protection_is_enabled" boolean DEFAULT false NOT NULL,
	"beginner_protection_days" integer DEFAULT 1 NOT NULL,
	"beginner_protection_monthly_income_threshold" numeric(18, 2) DEFAULT 0 NOT NULL,
	"beginner_protection_fixed_commission_rate" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"published_by" varchar(255),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_commission_strategy_versions_id_unique" UNIQUE("id"),
	CONSTRAINT "category_commission_strategy_version_no_check" CHECK ("category_commission_strategy_versions"."version_no" > 0),
	CONSTRAINT "category_commission_strategy_version_protection_days_check" CHECK ("category_commission_strategy_versions"."beginner_protection_days" >= 1),
	CONSTRAINT "category_commission_strategy_version_protection_threshold_check" CHECK ("category_commission_strategy_versions"."beginner_protection_monthly_income_threshold" >= 0),
	CONSTRAINT "category_commission_strategy_version_protection_rate_check" CHECK ("category_commission_strategy_versions"."beginner_protection_fixed_commission_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "category_commission_strategies" ADD CONSTRAINT "category_commission_strategies_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategies" ADD CONSTRAINT "category_commission_strategies_current_version_id_category_commission_strategy_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."category_commission_strategy_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategies" ADD CONSTRAINT "category_commission_strategies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategies" ADD CONSTRAINT "category_commission_strategies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategies" ADD CONSTRAINT "category_commission_strategies_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategy_rules" ADD CONSTRAINT "category_commission_strategy_rules_strategy_version_id_category_commission_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."category_commission_strategy_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategy_versions" ADD CONSTRAINT "category_commission_strategy_versions_strategy_id_category_commission_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."category_commission_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategy_versions" ADD CONSTRAINT "category_commission_strategy_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_commission_strategy_versions" ADD CONSTRAINT "category_commission_strategy_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_commission_strategy_category_unique" ON "category_commission_strategies" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "category_commission_strategy_status_idx" ON "category_commission_strategies" USING btree ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "category_commission_strategy_rule_version_idx" ON "category_commission_strategy_rules" USING btree ("strategy_version_id","sort_order","threshold");--> statement-breakpoint
CREATE UNIQUE INDEX "category_commission_strategy_version_unique" ON "category_commission_strategy_versions" USING btree ("strategy_id","version_no");--> statement-breakpoint
CREATE INDEX "category_commission_strategy_version_status_idx" ON "category_commission_strategy_versions" USING btree ("strategy_id","status","version_no" DESC NULLS LAST);