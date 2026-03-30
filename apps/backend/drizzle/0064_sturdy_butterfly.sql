CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_wechat_worker_openid_appid_unique"
ON "user_profiles" USING btree ("wechat_worker_app_id", "wechat_worker_open_id")
WHERE "wechat_worker_app_id" IS NOT NULL AND "wechat_worker_open_id" IS NOT NULL;
