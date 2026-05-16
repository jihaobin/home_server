CREATE TYPE "public"."service_offering_audit_log_type" AS ENUM('submitted', 'approved', 'rejected', 'takendown', 'restored', 'withdrawn');--> statement-breakpoint
CREATE TABLE "service_offering_audit_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"personnel_user_id" varchar(255) NOT NULL,
	"service_id" varchar(255) NOT NULL,
	"draft_id" varchar(255),
	"type" "service_offering_audit_log_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" varchar(255),
	"note" text
);
--> statement-breakpoint
ALTER TABLE "service_personnel_offering_drafts" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "service_personnel_offering_drafts"
SET "submitted_at" = COALESCE("reviewed_at", "updated_at", "created_at")
WHERE "submitted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "service_offering_audit_logs" ADD CONSTRAINT "service_offering_audit_logs_personnel_user_id_service_personnel_user_id_fk" FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offering_audit_logs" ADD CONSTRAINT "service_offering_audit_logs_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offering_audit_logs" ADD CONSTRAINT "service_offering_audit_logs_draft_id_service_personnel_offering_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."service_personnel_offering_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offering_audit_logs" ADD CONSTRAINT "service_offering_audit_logs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_offering_audit_logs_personnel_service" ON "service_offering_audit_logs" USING btree ("personnel_user_id","service_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_service_offering_audit_logs_draft" ON "service_offering_audit_logs" USING btree ("draft_id");--> statement-breakpoint
INSERT INTO "service_offering_audit_logs" (
	"id",
	"personnel_user_id",
	"service_id",
	"draft_id",
	"type",
	"occurred_at",
	"operator_id",
	"note"
)
SELECT
	gen_random_uuid()::text,
	d."personnel_user_id",
	d."service_id",
	d."id",
	'submitted'::"service_offering_audit_log_type",
	COALESCE(d."submitted_at", d."created_at", now()),
	NULL,
	'历史数据迁移'
FROM "service_personnel_offering_drafts" d;--> statement-breakpoint
INSERT INTO "service_offering_audit_logs" (
	"id",
	"personnel_user_id",
	"service_id",
	"draft_id",
	"type",
	"occurred_at",
	"operator_id",
	"note"
)
SELECT
	gen_random_uuid()::text,
	s."personnel_user_id",
	s."service_id",
	s."last_approved_draft_id",
	CASE
		WHEN s."publication_status" = 'taken_down' THEN 'takendown'::"service_offering_audit_log_type"
		ELSE 'approved'::"service_offering_audit_log_type"
	END,
	COALESCE(s."taken_down_at", s."last_approved_at", now()),
	s."taken_down_by",
	'历史数据迁移'
FROM "service_personnel_offering_statuses" s
WHERE s."last_approved_at" IS NOT NULL
	OR s."taken_down_at" IS NOT NULL;
