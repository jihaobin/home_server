-- 1. 清理旧的通知表结构（若存在）
DROP TABLE IF EXISTS "notification_preferences";
DROP TABLE IF EXISTS "notification_outbox";
DROP TABLE IF EXISTS "notification_deliveries";
DROP TABLE IF EXISTS "notification_targets";
DROP TABLE IF EXISTS "notifications";

DROP TYPE IF EXISTS "notification_type";

-- 2. 创建通知相关的 ENUM 类型
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_priority'
    ) THEN
        CREATE TYPE "public"."notification_priority" AS ENUM ('high', 'normal', 'low');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_status'
    ) THEN
        CREATE TYPE "public"."notification_status" AS ENUM (
            'pending',
            'queued',
            'dispatching',
            'succeeded',
            'failed',
            'cancelled'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_delivery_mode'
    ) THEN
        CREATE TYPE "public"."notification_delivery_mode" AS ENUM (
            'strict',
            'best-effort'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_trace_level'
    ) THEN
        CREATE TYPE "public"."notification_trace_level" AS ENUM (
            'none',
            'minimal',
            'full'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_channel'
    ) THEN
        CREATE TYPE "public"."notification_channel" AS ENUM (
            'in_app',
            'system_push',
            'wechat',
            'sms'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_target_type'
    ) THEN
        CREATE TYPE "public"."notification_target_type" AS ENUM (
            'user',
            'service_personnel',
            'shop',
            'role',
            'custom'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_delivery_status'
    ) THEN
        CREATE TYPE "public"."notification_delivery_status" AS ENUM (
            'pending',
            'scheduled',
            'sent',
            'delivered',
            'failed',
            'acknowledged'
        );
    END IF;
END
$$;

-- 3. 创建 notifications 主表
CREATE TABLE "notifications" (
    "id" varchar(255) PRIMARY KEY,
    "event" varchar(120) NOT NULL,
    "payload" jsonb NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "priority" "notification_priority" NOT NULL DEFAULT 'normal',
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "delivery_mode" "notification_delivery_mode" NOT NULL DEFAULT 'best-effort',
    "trace_level" "notification_trace_level" NOT NULL DEFAULT 'minimal',
    "trace_context" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "available_at" timestamptz,
    "expires_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_notifications_status_priority"
    ON "notifications" ("status", "priority", "created_at" DESC);

CREATE INDEX "idx_notifications_event_time"
    ON "notifications" ("event", "created_at" DESC);

CREATE INDEX "idx_notifications_available_at"
    ON "notifications" ("available_at")
    WHERE "available_at" IS NOT NULL;

-- 4. 创建 notification_targets 表
CREATE TABLE "notification_targets" (
    "id" varchar(255) PRIMARY KEY,
    "notification_id" varchar(255) NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "target_type" "notification_target_type" NOT NULL,
    "target_id" varchar(255) NOT NULL,
    "user_id" varchar(255) REFERENCES "users"("id") ON DELETE CASCADE,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "channel_plan" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "notification_target_unique"
    ON "notification_targets" ("notification_id", "target_type", "target_id");

CREATE INDEX "idx_notification_targets_user"
    ON "notification_targets" ("user_id", "created_at" DESC);

-- 5. 创建 notification_deliveries 表
CREATE TABLE "notification_deliveries" (
    "delivery_id" varchar(255) PRIMARY KEY,
    "notification_id" varchar(255) NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "target_id" varchar(255) NOT NULL REFERENCES "notification_targets"("id") ON DELETE CASCADE,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'pending',
    "attempt" integer NOT NULL DEFAULT 1,
    "last_error" text,
    "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "delivered_at" timestamptz,
    "ack_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_notification_deliveries_notification"
    ON "notification_deliveries" ("notification_id", "target_id", "channel");

CREATE INDEX "idx_notification_deliveries_status"
    ON "notification_deliveries" ("status", "channel", "created_at" DESC);

-- 6. 创建 notification_outbox 表
CREATE TABLE "notification_outbox" (
    "notification_id" varchar(255) PRIMARY KEY REFERENCES "notifications"("id") ON DELETE CASCADE,
    "retry_count" integer NOT NULL DEFAULT 0,
    "locked_at" timestamptz,
    "lock_owner" varchar(128),
    "sent" boolean NOT NULL DEFAULT FALSE,
    "last_error" text,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_notification_outbox_ready"
    ON "notification_outbox" ("sent", "locked_at", "created_at");

-- 7. 创建 notification_preferences 表
CREATE TABLE "notification_preferences" (
    "id" varchar(255) PRIMARY KEY,
    "target_type" "notification_target_type" NOT NULL,
    "target_id" varchar(255) NOT NULL,
    "user_id" varchar(255) REFERENCES "users"("id") ON DELETE CASCADE,
    "channel_plan" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "version" integer NOT NULL DEFAULT 1,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "notification_preferences_target_unique"
    ON "notification_preferences" ("target_type", "target_id");
