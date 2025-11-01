ALTER TABLE "service_personnel_skills" ADD COLUMN "serviced_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel_skills" DROP COLUMN "times_performed";