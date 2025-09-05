ALTER TABLE "service_categories" ADD COLUMN "dep" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "is_active" boolean DEFAULT true;