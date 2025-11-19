ALTER TABLE "reviews" ALTER COLUMN "rating" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "service_quality" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "service_quality" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "attitude" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "attitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "punctuality" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "punctuality" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "comment" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "is_anonymous" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "helpful_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "unhelpful_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "created_at" SET NOT NULL;