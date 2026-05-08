ALTER TABLE "public"."service_personnel"
ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar(20),
ADD COLUMN IF NOT EXISTS "emergency_contact_name" varchar(50);
