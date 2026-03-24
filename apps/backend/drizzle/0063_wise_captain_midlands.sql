-- Custom SQL migration file, put your code below! --ADD VALUE
-- payee_account_type
COMMIT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'WECHAT_OPENID'
        AND enumtypid = 'public.payee_account_type'::regtype
    ) THEN
        ALTER TYPE "public"."payee_account_type" ADD VALUE 'WECHAT_OPENID';
    END IF;
END$$;


-- withdrawal_status: processing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'processing'
        AND enumtypid = 'public.withdrawal_status'::regtype
    ) THEN
        ALTER TYPE "public"."withdrawal_status"
        ADD VALUE 'processing' BEFORE 'rejected';
    END IF;
END$$;


-- withdrawal_status: failed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'failed'
        AND enumtypid = 'public.withdrawal_status'::regtype
    ) THEN
        ALTER TYPE "public"."withdrawal_status"
        ADD VALUE 'failed' BEFORE 'rejected';
    END IF;
END$$;


-- withdrawal_status: cancelled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'cancelled'
        AND enumtypid = 'public.withdrawal_status'::regtype
    ) THEN
        ALTER TYPE "public"."withdrawal_status"
        ADD VALUE 'cancelled' BEFORE 'rejected';
    END IF;
END$$;


-- 订单状态流转触发器函数：与当前后端 OrderRepository.validStatusTransitions 保持一致
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS
$$
BEGIN
    IF OLD.status IS NOT NULL AND NEW.status <> OLD.status THEN
        IF NOT (
            (OLD.status = 'pending_payment' AND NEW.status IN ('pending_acceptance', 'paid', 'cancelled', 'payment_timeout')) OR
            (OLD.status = 'pending_acceptance' AND NEW.status IN ('paid', 'cancelled', 'staff_rejected')) OR
            (OLD.status = 'staff_rejected' AND NEW.status IN ('pending_acceptance', 'cancelled')) OR
            (OLD.status = 'paid' AND NEW.status IN ('in_progress', 'cancelled', 'staff_rejected')) OR
            (OLD.status = 'in_progress' AND NEW.status = 'completed') OR
            (OLD.status = 'completed' AND NEW.status = 'refunded')
        ) THEN
            RAISE EXCEPTION '非法的订单状态转换: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_status_validation ON "public"."orders";

CREATE TRIGGER trg_order_status_validation
    BEFORE UPDATE
    ON "public"."orders"
    FOR EACH ROW
EXECUTE FUNCTION validate_order_status_transition();
COMMIT;


BEGIN;
CREATE TABLE "notification_voice_deliveries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"notification_id" varchar(255) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"out_id" varchar(255) NOT NULL,
	"call_id" varchar(255),
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"provider_status_code" varchar(64),
	"provider_status_message" text,
	"delivered_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_voice_deliveries_id_unique" UNIQUE("id")
);
--> statement-breakpoint
DROP INDEX "idx_withdrawals_status_time";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "wechat_worker_open_id" varchar(128);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "wechat_worker_union_id" varchar(128);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "wechat_worker_app_id" varchar(128);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "wechat_worker_bound_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "provider_state" varchar(64);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "provider_app_id" varchar(128);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "provider_bill_no" varchar(255);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "provider_package_info" varchar(1000);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "provider_meta" jsonb;--> statement-breakpoint
ALTER TABLE "notification_voice_deliveries" ADD CONSTRAINT "notification_voice_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_voice_deliveries" ADD CONSTRAINT "notification_voice_deliveries_target_id_notification_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."notification_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_voice_deliveries_out_id_unique" ON "notification_voice_deliveries" USING btree ("out_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_voice_deliveries_call_id_unique" ON "notification_voice_deliveries" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_notification_voice_deliveries_notification" ON "notification_voice_deliveries" USING btree ("notification_id","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notification_voice_deliveries_status" ON "notification_voice_deliveries" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status_time" ON "withdrawals" USING btree ("status","requested_at" DESC NULLS LAST) WHERE status IN ('pending', 'approved', 'processing');

COMMIT;