ALTER TABLE "order_assignments" ADD COLUMN "staff_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_hidden_at" timestamp with time zone;