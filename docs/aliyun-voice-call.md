# 阿里云语音通话（Dyvms）后端接入说明

## 接入位置

- 底层服务：`apps/backend/src/common/voice/voice.service.ts`
- 模块导出：`apps/backend/src/common/voice/voice.module.ts`
- 触发接口：`POST /api/notifications/voice/tts`
- 自动通知：`apps/backend/src/modules/notification/notification-voice-call.service.ts`

## 认证方式

默认复用仓库现有的阿里云 STS 临时凭证链路：

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_STS_ROLE_ARN`

如果你的部署环境已经配置好了阿里云默认凭据链，也可以开启：

- `ALIYUN_DYVMS_USE_DEFAULT_CREDENTIAL=true`

此时会改用 `@alicloud/credentials` 自动解析运行环境凭据。

常见来源包括：

- 运行环境直接注入的阿里云凭据变量
- ECS / ACK 等云环境绑定的 RAM Role
- 其他阿里云官方默认凭据链支持的来源

## 语音通话相关环境变量

- `ALIYUN_DYVMS_ENDPOINT`：可选，默认 `dyvmsapi.aliyuncs.com`
- `ALIYUN_DYVMS_CALLED_SHOW_NUMBER`：可选，默认外显号码；也可在接口调用时单独传 `calledShowNumber`

## 请求示例

```json
{
    "calledNumber": "13800138000",
    "ttsCode": "TTS_123456789",
    "calledShowNumber": "02131934558",
    "outId": "order-reminder-10001",
    "ttsParam": {
        "serviceName": "家电清洗",
        "time": "今天 18:00"
    }
}
```

## 返回示例

```json
{
    "success": true,
    "callId": "abc123",
    "requestId": "req-xxx",
    "code": "OK",
    "message": "OK",
    "outId": "order-reminder-10001"
}
```

## 说明

- 当前接口仅允许 `admin/super_admin` 调用。
- 服务内置了基础频控：单号码间隔、单号码日限额、系统日/小时总限额。
- 频控 key 按 UTC 日期/小时切分；生产环境建议启用共享 Redis，避免多实例下各自计数。
- 手机号会自动清理空格、横线，并兼容去掉 `+86` / `86` 前缀。
- 服务日志会对手机号做脱敏，只保留少量前缀和后 4 位。
- 如果后续要接入现有通知编排系统，可在此服务基础上继续扩展 `NotificationChannel`，无需重写阿里云 SDK 封装。

## 新订单自动语音提醒

- 触发时机：用户支付成功后，订单进入 `pending_acceptance`，并向服务人员发布 `order_pending_acceptance_assigned` 通知事件时。
- 触发位置：`NotificationDispatcher` 在每个通知目标完成常规渠道派发后，调用 `NotificationVoiceCallService`。
- 事件范围：仅 `order_pending_acceptance_assigned` 会触发语音；`order_pending_acceptance_warning`、`order_service_eta_warning` 等分时提醒事件不会触发语音。
- 被叫号码：默认取服务人员关联 `users.phone_number`，也兼容通知目标 metadata / payload 中显式传入的手机号。
- 你提供的 `calledNumber` 示例值不会写死到代码里；在自动通知场景中会动态使用当前服务人员手机号。
- 当前固定参数：
    - `ttsCode`: `TTS_328535234`
    - `calledShowNumber`: `02131934558`
- 可选环境变量覆盖：
    - `ALIYUN_DYVMS_TEMPLATE_NEW_ORDER`
    - `ALIYUN_DYVMS_CALLED_SHOW_NUMBER`
- `outId` 由系统自动生成且对同一通知目标保持确定性，格式类似：`voice:<notificationId>:<orderId>:<targetRecordId>`。
