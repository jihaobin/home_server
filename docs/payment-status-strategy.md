# 支付宝支付状态管理策略

## 概述

本文档详细说明了在移动端应用中如何正确处理支付宝支付的各种状态，确保客户端能够准确地获知订单的支付结果。

## 支付宝SDK返回状态码

支付宝SDK在支付完成后会返回一个esultStatus字段，表示支付的状态：

| 状态码 | 含义 | 确定性 | 处理策略 |
|--------|------|--------|----------|
| 9000 | 订单支付成功 | ✅ 确定 | 直接跳转成功页面 |
| 8000 | 正在处理中，支付结果未知（有可能已经支付成功） | ❌ 不确定 | **需要轮询验证** |
| 4000 | 订单支付失败 | ✅ 确定 | 提示失败，可重试 |
| 5000 | 重复请求 | ✅ 确定 | 提示失败，可重试 |
| 6001 | 用户中途取消 | ✅ 确定 | 提示用户可稍后继续支付 |
| 6002 | 网络连接出错 | ✅ 确定 | 提示网络错误，可重试 |
| 6004 | 支付结果未知（有可能已经支付成功） | ❌ 不确定 | **需要轮询验证** |
| 其它 | 其它支付错误 | ❌ 不确定 | 记录错误信息 |

## 核心问题

**不确定性状态**：`8000` 和 `6004` 是不确定状态，客户端无法直接判断支付是否真的成功。

**原因分析**：
- 支付宝服务器可能还在处理支付请求
- 网络问题导致支付结果未能及时返回
- 用户支付成功但客户端未收到确认

## 解决方案：双重保障策略

### 策略架构

`
客户端SDK状态判断 + 服务端轮询验证
           ↓
   [确定性状态] → 直接处理
           ↓
  [不确定性状态] → 轮询查询服务端
           ↓
      服务端主动查询支付宝
           ↓
   返回真实支付状态
`

### 具体实现

#### 1. 确定性状态（直接处理）

`	ypescript
case "9000": // 支付成功
  toast.success("支付成功");
  router.push("/payment-result?success=true");
  break;

case "4000":
case "5000": // 支付失败
  toast.error("支付失败，请重试");
  router.push("/payment-result?success=false");
  break;

case "6001": // 用户取消
  toast.info("您已取消支付，可稍后继续支付");
  break;

case "6002": // 网络错误
  toast.error("网络连接出错，请检查网络后重试");
  break;
`

#### 2. 不确定性状态（轮询验证）

`	ypescript
case "8000":
case "6004": // 支付结果未知
  toast.loading("正在确认支付结果...");
  
  // 启动轮询机制
  const result = await pollPaymentStatus();
  
  if (result.success) {
    toast.success("支付成功");
    router.push("/payment-result?success=true");
  } else {
    // 根据具体错误信息处理
  }
  break;
`

#### 3. 轮询机制设计

**参数配置**：
- 最大轮询次数：5次
- 轮询间隔：第1次立即查询，后续每次间隔2秒
- 总超时时间：约10秒

**轮询逻辑**：

`	ypescript
const pollPaymentStatus = async (maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    // 第一次立即查询，后续间隔2秒
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 调用后端查询接口
    const result = await queryPaymentStatus();
    
    // 如果状态已确定，立即返回
    if (result.paymentStatus === "succeeded") {
      return { success: true, message: "支付成功" };
    }
    if (result.paymentStatus === "failed") {
      return { success: false, message: "支付失败" };
    }
    
    // 如果还是 pending，继续轮询
    console.log(`第 \ 次查询，支付状态仍为 pending`);
  }
  
  // 超时后仍未确定
  return {
    success: false,
    message: "支付结果确认中，请稍后在订单列表中查看"
  };
};
`

## 后端接口设计

### 1. 发起支付接口

**路径**：`POST /pay/orders/:orderId`

**请求体**：
`	ypescript
{
  payType: "alipay" | "wechat_pay" | "bank_transfer",
  displayAmount: number
}
`

**响应**：
`	ypescript
{
  orderString: string, // 支付宝SDK所需的支付参数
  orderId: string,
  orderSerial: string
}
`

### 2. 查询支付状态接口

**路径**：`GET /pay/orders/:orderId/payment-status`

**响应**：
`	ypescript
{
  orderId: string,
  orderSerial: string,
  paymentStatus: "pending" | "succeeded" | "failed" | "refunded",
  tradeStatus: "WAIT_BUYER_PAY" | "TRADE_CLOSED" | "TRADE_SUCCESS" | "TRADE_FINISHED",
  amount?: string,
  transactionId?: string,
  message: string
}
`

**后端实现要点**：
- 主动调用支付宝的交易查询接口（alipay.trade.query）
- 根据支付宝返回的真实状态更新数据库
- 返回最新的支付状态给客户端

## 完整支付流程

`
1. 用户点击"确认支付"
        ↓
2. 创建订单（pending_payment状态）
        ↓
3. 调用后端发起支付接口，获取支付参数
        ↓
4. 调起支付宝SDK
        ↓
5. 用户在支付宝中完成支付
        ↓
6. 支付宝SDK返回resultStatus
        ↓
7. 判断resultStatus类型
   ├─ 确定性状态 → 直接处理
   └─ 不确定性状态 → 启动轮询
        ↓
8. 轮询查询后端接口（最多5次）
        ↓
9. 后端查询支付宝真实状态
        ↓
10. 根据真实状态跳转结果页
`

## 用户体验优化

### 1. 加载状态提示

`	ypescript
// 创建订单时
toast.loading("正在创建订单...");

// 调起支付时
toast.loading("正在调起支付...");

// 轮询确认时
toast.loading("正在确认支付结果...");
`

### 2. 防止重复操作

`	ypescript
const [isProcessingPayment, setIsProcessingPayment] = useState(false);

const handlePayment = async () => {
  if (isProcessingPayment) {
    return; // 防止重复点击
  }
  
  setIsProcessingPayment(true);
  try {
    // 支付逻辑
  } finally {
    setIsProcessingPayment(false);
  }
};
`

### 3. 超时兜底方案

当轮询5次后仍无法确定支付状态时：

`	ypescript
toast.info("支付结果确认中，请稍后在订单列表中查看");
router.push("/orders"); // 引导用户到订单列表
`

**优势**：
- 用户可以在订单列表中查看订单状态
- 后端异步通知到达后，订单状态会自动更新
- 避免用户长时间等待

## 异常处理

### 1. 网络异常

`	ypescript
try {
  const result = await queryPaymentStatus();
} catch (error) {
  console.error("查询失败:", error);
  // 继续轮询，不中断
}
`

### 2. SDK调用失败

`	ypescript
try {
  const paymentResult = await aliPay(orderString);
  await handlePaymentResult(paymentResult, orderId);
} catch (error) {
  toast.error("支付调起失败，请重试");
  setShowPaymentModal(false);
}
`

### 3. 订单创建失败

`	ypescript
createOrder(data, {
  onError: (error) => {
    toast.error(error.message || "创建订单失败，请重试");
    setShowPaymentModal(false);
  }
});
`

## 后端配合要点

### 1. 支付宝异步通知处理

后端需要实现支付宝的异步通知接口：

`	ypescript
// POST /pay/alipay/notify
async handleAlipayNotify(notify: AlipayNotify) {
  // 1. 验证签名
  const isValid = await this.verifyAlipaySign(notify);
  if (!isValid) return "fail";
  
  // 2. 根据 trade_status 更新订单状态
  if (notify.trade_status === "TRADE_SUCCESS") {
    await this.updateOrderPaymentStatus(notify.out_trade_no, "succeeded");
  }
  
  // 3. 返回成功
  return "success";
}
`

### 2. 主动查询实现

`	ypescript
// 查询支付状态
async queryPaymentStatus(orderId: string) {
  // 1. 先查询数据库中的支付状态
  const order = await this.orderRepository.findOne(orderId);
  
  // 2. 如果是 pending，主动查询支付宝
  if (order.paymentStatus === "pending") {
    const alipayResult = await this.alipayService.query({
      out_trade_no: order.orderSerial
    });
    
    // 3. 更新数据库
    if (alipayResult.trade_status === "TRADE_SUCCESS") {
      order.paymentStatus = "succeeded";
      await this.orderRepository.save(order);
    }
  }
  
  // 4. 返回最新状态
  return {
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    // ...
  };
}
`

## 代码位置

### 客户端

- 支付页面：`apps/mobile-user/app/servicePersonnel/order-confirm.tsx`
- 支付工具函数：`apps/mobile-user/lib/pay.ts`
- 支付API hooks：`apps/mobile-user/hooks/api/pay/index.ts`

### 后端

- 支付控制器：`apps/backend/src/pay/pay.controller.ts`
- 支付服务：`apps/backend/src/pay/pay.service.ts`
- 类型定义：`packages/types/src/pay.ts`

## 测试场景

### 1. 正常支付成功
- 用户支付成功
- SDK返回9000
- 直接跳转成功页面

### 2. 支付结果未知（8000）
- SDK返回8000
- 启动轮询
- 第1次查询：pending
- 第2次查询：succeeded
- 跳转成功页面

### 3. 网络超时（6004）
- SDK返回6004
- 启动轮询
- 5次查询都是pending
- 提示用户到订单列表查看
- 后端异步通知到达
- 用户刷新订单列表看到成功状态

### 4. 用户取消支付
- SDK返回6001
- 提示用户可稍后继续支付
- 订单保持pending_payment状态

### 5. 支付失败
- SDK返回4000
- 跳转失败页面
- 提示用户可重试

## 最佳实践

1. **永远不要仅依赖客户端SDK的返回状态**
   - 8000和6004必须通过服务端验证

2. **合理设置轮询参数**
   - 避免无限轮询消耗资源
   - 给用户明确的超时提示

3. **提供订单查看入口**
   - 让用户随时可以查看订单状态
   - 避免用户困惑

4. **记录详细日志**
   - 记录每次支付的完整流程
   - 便于问题排查

5. **优雅降级**
   - 当所有验证都失败时，引导用户联系客服
   - 提供订单号等关键信息

## 总结

通过"客户端SDK状态 + 服务端轮询验证"的双重保障策略，我们能够：

✅ 准确获知支付结果  
✅ 处理各种异常情况  
✅ 提供良好的用户体验  
✅ 避免订单状态不一致  
✅ 保证系统稳定性

这个方案在保证准确性的同时，也充分考虑了用户体验和系统性能。
