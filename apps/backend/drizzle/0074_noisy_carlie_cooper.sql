DROP INDEX "uniq_service_offering_drafts_pending_personnel";--> statement-breakpoint
DROP INDEX "idx_service_offering_drafts_personnel_status";--> statement-breakpoint
ALTER TABLE "service_personnel_offering_drafts" ADD COLUMN "service_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel_offering_drafts" ADD CONSTRAINT "service_personnel_offering_drafts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_service_offering_drafts_pending_personnel_service" ON "service_personnel_offering_drafts" USING btree ("personnel_user_id","service_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "idx_service_offering_drafts_personnel_status" ON "service_personnel_offering_drafts" USING btree ("personnel_user_id","service_id","status","updated_at" DESC NULLS LAST);