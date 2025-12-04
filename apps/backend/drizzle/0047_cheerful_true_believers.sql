ALTER TYPE "public"."order_status" ADD VALUE 'payment_timeout' BEFORE 'paid';

-- 为订单枚举新增支付超时状态并更新状态流转校验
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = 'order_status'::regtype
          AND enumlabel = 'payment_timeout'
    ) THEN
        ALTER TYPE "public"."order_status"
            ADD VALUE IF NOT EXISTS 'payment_timeout' AFTER 'pending_payment';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS
$$
BEGIN
    IF OLD.status IS NOT NULL AND NEW.status <> OLD.status THEN
        IF NOT (
            -- pending_payment 可以转换到 paid、cancelled 或 payment_timeout
            (OLD.status = 'pending_payment' AND NEW.status IN ('paid', 'cancelled', 'payment_timeout')) OR
            -- paid 可以转换到 in_progress 或 cancelled
            (OLD.status = 'paid' AND NEW.status IN ('in_progress', 'cancelled')) OR
            -- in_progress 只能转换到 completed
            (OLD.status = 'in_progress' AND NEW.status = 'completed') OR
            -- completed 可以转换到 refunded
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
