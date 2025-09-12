DROP INDEX "idx_service_personnel_work_time";--> statement-breakpoint
DROP INDEX "idx_service_personnel_location";--> statement-breakpoint
DROP INDEX "idx_service_personnel_available";--> statement-breakpoint
ALTER TABLE "service_personnel" ALTER COLUMN "province" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "geom" geometry(point);--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "work_days" varchar(7) DEFAULT '1234567' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "current_status" varchar(20) DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_work_schedule" ON "service_personnel" USING btree ("work_start_time","work_end_time","work_days","current_status","is_available") WHERE is_available = true AND current_status = 'available';--> statement-breakpoint
CREATE INDEX "idx_service_personnel_location_radius" ON "service_personnel" USING btree ("province","district","county","is_available") WHERE is_available = true;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_geom" ON "service_personnel" USING gist ("geom") WHERE geom IS NOT NULL AND is_available = true;--> statement-breakpoint
CREATE INDEX "idx_service_personnel_active" ON "service_personnel" USING btree ("last_active_at" DESC NULLS LAST,"current_status") WHERE current_status != 'offline';--> statement-breakpoint
CREATE INDEX "idx_service_personnel_available" ON "service_personnel" USING btree ("is_available","current_status","user_id") WHERE is_available = true AND current_status = 'available';