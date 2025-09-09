ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'in_progress', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "service_personnel" ALTER COLUMN "years_of_experience" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ALTER COLUMN "work_start_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ALTER COLUMN "work_end_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ALTER COLUMN "is_available" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "province" varchar(100);--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "district" varchar(100);--> statement-breakpoint
ALTER TABLE "service_personnel" ADD COLUMN "county" varchar(100);

-- 更新订单状态流转约束为MVP简化版本
-- 先删除现有触发器
DROP TRIGGER IF EXISTS trg_order_status_validation ON orders;

-- 更新约束函数逻辑
CREATE OR REPLACE FUNCTION validate_order_status_transition()
    RETURNS TRIGGER AS
$$
BEGIN
    -- 定义允许的状态转换 - 简化的MVP版本
    IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
        -- 检查状态转换是否合法
        IF NOT (
            -- 正常流程：pending_payment -> paid -> in_progress -> completed
            (OLD.status = 'pending_payment' AND NEW.status IN ('paid', 'cancelled')) OR
            (OLD.status = 'paid' AND NEW.status IN ('in_progress', 'cancelled')) OR
            (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled')) OR

            -- 退款流程：任何状态都可以申请退款（除了已退款）
            (OLD.status IN ('cancelled', 'completed') AND NEW.status = 'refunded')
        ) THEN
            RAISE EXCEPTION '非法的订单状态转换: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;

    -- 更新修改时间
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- 重新创建触发器
CREATE TRIGGER trg_order_status_validation
    BEFORE UPDATE
    ON orders
    FOR EACH ROW
EXECUTE FUNCTION validate_order_status_transition();