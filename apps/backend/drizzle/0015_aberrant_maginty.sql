CREATE INDEX "users_email_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id");