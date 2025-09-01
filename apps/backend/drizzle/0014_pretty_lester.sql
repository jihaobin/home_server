-- 修正 user_profiles 表结构迁移
-- 步骤1: 删除现有的主键约束 (PostgreSQL 默认为 tablename_pkey)
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_pkey";--> statement-breakpoint

-- 步骤2: 添加新的 id 列
ALTER TABLE "user_profiles" ADD COLUMN "id" varchar(255);--> statement-breakpoint

-- 步骤3: 为现有记录生成 id 值 (如果表中有数据)
-- 这里使用 PostgreSQL 的 gen_random_uuid() 函数生成唯一ID
UPDATE "user_profiles" SET "id" = gen_random_uuid()::varchar WHERE "id" IS NULL;--> statement-breakpoint

-- 步骤4: 设置 id 列为 NOT NULL
ALTER TABLE "user_profiles" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint

-- 步骤5: 现在可以安全地修改 user_id 的 NOT NULL 约束
ALTER TABLE "user_profiles" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint

-- 步骤6: 创建新的复合主键
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_user_id_pk" PRIMARY KEY("id","user_id");--> statement-breakpoint

-- 步骤7: 添加创建时间列
ALTER TABLE "user_profiles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint

-- 步骤8: 创建索引
CREATE INDEX "idx_user_profiles_user_id" ON "user_profiles" USING btree ("user_id","id_card_number");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_face_info" ON "user_profiles" USING btree ("face_recognition_data","user_id");--> statement-breakpoint

-- 步骤9: 添加唯一约束
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_unique" UNIQUE("id");