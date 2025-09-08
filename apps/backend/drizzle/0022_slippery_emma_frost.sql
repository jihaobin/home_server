ALTER TABLE "service_categories" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "estimated_duration_minutes" SET NOT NULL;