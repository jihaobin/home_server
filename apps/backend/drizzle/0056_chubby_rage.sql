ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role"[]
USING (
    CASE
        WHEN "role" IS NULL THEN ARRAY['customer']::"public"."user_role"[]
        ELSE ARRAY["role"]::"public"."user_role"[]
    END
);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT ARRAY['customer']::user_role[];
UPDATE "users"
SET "role" = ARRAY['customer']::"public"."user_role"[]
WHERE "role" IS NULL OR array_length("role", 1) IS NULL;
