CREATE TYPE "service_offering_draft_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "service_offering_publication_status" AS ENUM ('active', 'taken_down');

CREATE TABLE "service_personnel_offering_drafts" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "personnel_user_id" varchar(255) NOT NULL,
    "submitted_snapshot" jsonb NOT NULL,
    "status" "service_offering_draft_status" DEFAULT 'pending' NOT NULL,
    "rejection_reason" text,
    "reviewed_by" varchar(255),
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "service_personnel_offering_drafts_id_unique" UNIQUE("id")
);

CREATE TABLE "service_personnel_offering_statuses" (
    "personnel_user_id" varchar(255) NOT NULL,
    "service_id" varchar(255) NOT NULL,
    "publication_status" "service_offering_publication_status" DEFAULT 'active' NOT NULL,
    "review_status" "service_offering_draft_status" DEFAULT 'approved' NOT NULL,
    "take_down_reason" text,
    "taken_down_by" varchar(255),
    "taken_down_at" timestamp with time zone,
    "last_approved_draft_id" varchar(255),
    "last_approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "service_personnel_offering_statuses_pkey" PRIMARY KEY("personnel_user_id","service_id")
);

ALTER TABLE "service_personnel_offering_drafts"
    ADD CONSTRAINT "service_personnel_offering_drafts_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_drafts"
    ADD CONSTRAINT "service_personnel_offering_drafts_reviewed_by_user_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_taken_down_by_user_id_fk"
    FOREIGN KEY ("taken_down_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_last_approved_draft_id_fk"
    FOREIGN KEY ("last_approved_draft_id") REFERENCES "public"."service_personnel_offering_drafts"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "idx_service_offering_drafts_personnel_status"
    ON "service_personnel_offering_drafts" USING btree ("personnel_user_id","status","updated_at");

CREATE UNIQUE INDEX "uniq_service_offering_drafts_pending_personnel"
    ON "service_personnel_offering_drafts" USING btree ("personnel_user_id")
    WHERE status = 'pending';

CREATE INDEX "idx_service_offering_status_active"
    ON "service_personnel_offering_statuses" USING btree ("service_id","publication_status");

CREATE INDEX "idx_service_offering_status_personnel"
    ON "service_personnel_offering_statuses" USING btree ("personnel_user_id","publication_status");

INSERT INTO "service_personnel_offering_statuses" (
    "personnel_user_id",
    "service_id",
    "publication_status",
    "review_status",
    "last_approved_at",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    "user_id",
    "service_id",
    'active'::service_offering_publication_status,
    'approved'::service_offering_draft_status,
    now(),
    now(),
    now()
FROM "service_personnel_skills";
