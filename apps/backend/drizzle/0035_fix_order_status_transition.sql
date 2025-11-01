-- =================================================================
-- 修改订单状态流转验证函数以匹配代码逻辑
-- =================================================================

-- 删除旧触发器
DROP TRIGGER IF EXISTS trg_order_status_validation ON orders;

-- 重新创建订单状态流转验证函数
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS
$$
BEGIN
    -- 定义允许的状态转换（与代码中的 validStatusTransitions 一致）
    IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
        -- 检查状态转换是否合法
        IF NOT (
            -- pending_payment 可以转换到 paid 或 cancelled
            (OLD.status = 'pending_payment' AND NEW.status IN ('paid', 'cancelled')) OR
            -- paid 可以转换到 in_progress 或 cancelled
            (OLD.status = 'paid' AND NEW.status IN ('in_progress', 'cancelled')) OR
            -- in_progress 只能转换到 completed（服务中状态不能再取消，只能完成）
            (OLD.status = 'in_progress' AND NEW.status = 'completed') OR
            -- completed 可以转换到 refunded（假设完成的订单可以退款）
            (OLD.status = 'completed' AND NEW.status = 'refunded')
            -- cancelled 和 refunded 状态不能再改变状态（没有对应的转换规则）
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