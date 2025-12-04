-- 1. ENUM 扩展（兼容 PG14）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = 'order_status'::regtype
          AND enumlabel = 'pending_acceptance'
    ) THEN
        ALTER TYPE "public"."order_status"
            ADD VALUE 'pending_acceptance' AFTER 'paid';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = 'order_status'::regtype
          AND enumlabel = 'staff_rejected'
    ) THEN
        ALTER TYPE "public"."order_status"
            ADD VALUE 'staff_rejected' AFTER 'pending_acceptance';
    END IF;
END
$$;

-- 2. 创建自定义 ENUM 类型（PG15+ syntax）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'assignment_decision_status'
    ) THEN
        CREATE TYPE "public"."assignment_decision_status"
            AS ENUM ('pending', 'accepted', 'rejected');
    END IF;
END
$$;

-- 3. 添加字段（PG12+）
ALTER TABLE "public"."order_assignments"
    ADD COLUMN IF NOT EXISTS "decision_status" "assignment_decision_status" NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "reject_reason" varchar(500),
    ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz;

-- 4. 迁移数据
UPDATE "public"."order_assignments"
SET decision_status = 'accepted'
WHERE accepted_at IS NOT NULL;

-- 5. 触发器函数
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS
$$
BEGIN
    IF OLD.status IS NOT NULL AND NEW.status <> OLD.status THEN
        IF NOT (
            (OLD.status = 'pending_payment' AND NEW.status IN ('pending_acceptance', 'paid', 'cancelled', 'payment_timeout')) OR
            (OLD.status = 'paid' AND NEW.status IN ('in_progress', 'cancelled', 'staff_rejected')) OR
            (OLD.status = 'pending_acceptance' AND NEW.status IN ('paid', 'cancelled', 'staff_rejected')) OR
            (OLD.status = 'staff_rejected' AND NEW.status IN ('pending_acceptance', 'cancelled')) OR
            (OLD.status = 'in_progress' AND NEW.status = 'completed') OR
            (OLD.status = 'completed' AND NEW.status = 'refunded'))
        THEN
            RAISE EXCEPTION '非法的订单状态转换: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
