ALTER TABLE "user_addresses" RENAME COLUMN "county" TO "city";--> statement-breakpoint
DROP INDEX "idx_user_addresses_county";--> statement-breakpoint
DROP INDEX "idx_user_addresses_geo_hierarchy";--> statement-breakpoint
CREATE INDEX "idx_user_addresses_city" ON "user_addresses" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_user_addresses_geo_hierarchy" ON "user_addresses" USING btree ("province","district","city");