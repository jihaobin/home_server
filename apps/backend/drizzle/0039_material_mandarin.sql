ALTER TABLE "review_stats" ADD COLUMN "service_id" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_review_stats_target_service" ON "review_stats" USING btree ("target_id","target_type","service_id");--> statement-breakpoint
ALTER TABLE "review_stats" DROP CONSTRAINT "review_stats_pkey";
--> statement-breakpoint
ALTER TABLE "review_stats" ADD CONSTRAINT "review_stats_pkey" PRIMARY KEY("target_id","target_type","service_id");