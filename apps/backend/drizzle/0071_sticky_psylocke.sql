BEGIN;

-- 1. 删除旧 trigger 和索引
DROP TRIGGER IF EXISTS trg_order_status_validation ON "public"."orders";
DROP INDEX IF EXISTS "public"."idx_orders_status_appointment";

-- 2. 数据修正（保留业务逻辑）
UPDATE "public"."orders"
SET status = 'paid',
    updated_at = NOW()
WHERE status = 'in_progress';

-- 3. 先把 enum 转成 text（避免直接修改 enum 报错）
ALTER TABLE "public"."orders"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE text;

-- 4. 删除旧 enum
DROP TYPE IF EXISTS "public"."order_status";

-- 5. 创建新 enum（统一来源）
CREATE TYPE "public"."order_status" AS ENUM (
    'pending_payment',
    'payment_timeout',
    'paid',
    'pending_acceptance',
    'staff_rejected',
    'completed',
    'cancelled',
    'refunded'
);

-- 6. 转回 enum 类型
ALTER TABLE "public"."orders"
ALTER COLUMN "status" TYPE "public"."order_status"
USING "status"::text::"public"."order_status",
ALTER COLUMN "status" SET DEFAULT 'pending_payment';

-- 7. 重建 trigger function
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS
$$
BEGIN
    IF OLD.status IS NOT NULL AND NEW.status <> OLD.status THEN
        IF NOT (
            (OLD.status = 'pending_payment' AND NEW.status IN ('pending_acceptance', 'paid', 'cancelled', 'payment_timeout')) OR
            (OLD.status = 'pending_acceptance' AND NEW.status IN ('paid', 'cancelled')) OR
            (OLD.status = 'paid' AND NEW.status IN ('completed', 'cancelled')) OR
            (OLD.status = 'completed' AND NEW.status = 'refunded')
        ) THEN
            RAISE EXCEPTION '非法的订单状态转换: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 重建 trigger
CREATE TRIGGER trg_order_status_validation
BEFORE UPDATE ON "public"."orders"
FOR EACH ROW
EXECUTE FUNCTION validate_order_status_transition();

-- 9. 重建索引
CREATE INDEX "idx_orders_status_appointment"
ON "public"."orders" ("status", "appointment_time")
WHERE status IN ('pending_acceptance', 'paid');

COMMIT;