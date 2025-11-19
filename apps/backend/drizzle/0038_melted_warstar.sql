CREATE TABLE "review_stats" (
	"target_id" varchar(255) NOT NULL,
	"target_type" "review_target_type" NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"good_count" integer DEFAULT 0 NOT NULL,
	"neutral_count" integer DEFAULT 0 NOT NULL,
	"bad_count" integer DEFAULT 0 NOT NULL,
	"average_rating" integer DEFAULT 0 NOT NULL,
	"average_service_quality" integer DEFAULT 0,
	"average_attitude" integer DEFAULT 0,
	"average_punctuality" integer DEFAULT 0,
	"last_review_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "review_stats_pkey" PRIMARY KEY("target_id","target_type")
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "service_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "image_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_review_stats_rating" ON "review_stats" USING btree ("target_type","average_rating" DESC NULLS LAST,"total_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_review_stats_good" ON "review_stats" USING btree ("target_type","good_count" DESC NULLS LAST,"total_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_review_stats_recent" ON "review_stats" USING btree ("target_type","last_review_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reviews_rating_filter" ON "reviews" USING btree ("target_id","target_type","rating");--> statement-breakpoint
CREATE INDEX "idx_reviews_target_service" ON "reviews" USING btree ("target_id","target_type","service_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reviews_good_rating" ON "reviews" USING btree ("target_id","target_type","created_at" DESC NULLS LAST) WHERE "reviews"."rating" >= 4;--> statement-breakpoint
CREATE INDEX "idx_reviews_bad_rating" ON "reviews" USING btree ("target_id","target_type","created_at" DESC NULLS LAST) WHERE "reviews"."rating" <= 2;