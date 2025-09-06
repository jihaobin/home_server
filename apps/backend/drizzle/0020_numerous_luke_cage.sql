DROP INDEX "idx_service_categories_name";--> statement-breakpoint
DROP INDEX "idx_services_name_search";--> statement-breakpoint
CREATE INDEX "idx_user_profiles_realname_search" ON "user_profiles" USING pgroonga ("real_name") WHERE real_name IS NOT NULL AND real_name != '';--> statement-breakpoint
CREATE INDEX "idx_service_personnel_bio_available" ON "service_personnel" USING pgroonga ("bio") WHERE is_available = true AND bio IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_shops_name_search" ON "shops" USING pgroonga ("name");--> statement-breakpoint
CREATE INDEX "idx_shops_desc_search" ON "shops" USING pgroonga ("description") WHERE description IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_shops_search_combined" ON "shops" USING pgroonga ((ARRAY["name", "description", "address"])) WHERE description IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_service_categories_name_active" ON "service_categories" USING pgroonga ("name") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_service_categories_desc_active" ON "service_categories" USING pgroonga ("description") WHERE is_active = true AND description IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_services_name_active" ON "services" USING pgroonga ("name") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_services_desc_active" ON "services" USING pgroonga ("description") WHERE is_active = true AND description IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_services_search_active" ON "services" USING pgroonga ((ARRAY[name, description])) WHERE is_active = true AND description IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_orders_serial_search" ON "orders" USING pgroonga ("order_serial");--> statement-breakpoint
CREATE INDEX "idx_orders_coupon_search" ON "orders" USING pgroonga ("coupon_code") WHERE coupon_code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_reviews_comment_search" ON "reviews" USING pgroonga ("comment") WHERE comment IS NOT NULL AND comment != '';--> statement-breakpoint
CREATE INDEX "idx_financial_transactions_desc_search" ON "financial_transactions" USING pgroonga ("description") WHERE description IS NOT NULL AND description != '';