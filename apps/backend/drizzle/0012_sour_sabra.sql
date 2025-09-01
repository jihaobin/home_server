ALTER TABLE "user_addresses" ALTER COLUMN "home_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_addresses" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_addresses" ALTER COLUMN "district" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_addresses" ALTER COLUMN "geom" SET NOT NULL;