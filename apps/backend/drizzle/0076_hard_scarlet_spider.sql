CREATE TYPE "public"."service_offering_appeal_status" AS ENUM ('pending', 'approved', 'rejected', 'canceled');
--> statement-breakpoint
CREATE TABLE "service_personnel_offering_appeals" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "personnel_user_id" varchar(255) NOT NULL,
    "service_id" varchar(255) NOT NULL,
    "taken_down_at_snapshot" timestamp with time zone NOT NULL,
    "take_down_reason_snapshot" text,
    "appeal_reason" text NOT NULL,
    "status" "service_offering_appeal_status" DEFAULT 'pending' NOT NULL,
    "review_result_reason" text,
    "reviewed_by" varchar(255),
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id")
    ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_reviewed_by_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_service_offering_appeals_personnel_service"
    ON "service_personnel_offering_appeals"
    USING btree ("personnel_user_id", "service_id", "taken_down_at_snapshot", "created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_service_offering_appeals_pending_round"
    ON "service_personnel_offering_appeals"
    USING btree ("personnel_user_id", "service_id", "taken_down_at_snapshot")
    WHERE status = 'pending';
