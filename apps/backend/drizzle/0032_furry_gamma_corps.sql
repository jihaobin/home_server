ALTER TABLE "service_personnel_skills" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "service_personnel_skills" ADD COLUMN "times_performed" integer DEFAULT 0 NOT NULL;