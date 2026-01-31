UPDATE "review_stats" SET "service_id" = '__all__' WHERE "service_id" IS NULL;--> statement-breakpoint
ALTER TABLE "review_stats" ALTER COLUMN "service_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_addresses_default_per_user" ON "user_addresses" USING btree ("user_id") WHERE "user_addresses"."is_default" = true;
