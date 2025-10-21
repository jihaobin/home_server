ALTER TABLE "service_personnel" ADD COLUMN "detailed_address" varchar(255);--> statement-breakpoint
ALTER TABLE "service_personnel_pricing" ADD COLUMN "name" varchar(100) DEFAULT '';