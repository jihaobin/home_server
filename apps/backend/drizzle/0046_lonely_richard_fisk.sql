ALTER TABLE "orders" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "orders"
SET "payment_expires_at" = COALESCE("created_at", NOW()) + INTERVAL '15 minutes'
WHERE "payment_expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_expires_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_orders_status_payment_expires" ON "orders" USING btree ("status","payment_expires_at");
