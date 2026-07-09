# 支付宝纯服务端人脸核身接入方案

生成日期：2026-05-06

## 1. 调研结论

目标接口：`datadigital.fincloud.generalsaas.face.source.certify`

官方文档入口：

- https://opendocs.alipay.com/open-v3/21280890_datadigital.fincloud.generalsaas.face.source.certify
- 同接口短链在第三方 SDK 文档中标注为：https://opendocs.alipay.com/open/04pxq6

接口定位：

- 纯服务端核身，不走支付宝 H5/SDK 跳转流程。
- 服务端提交用户姓名、身份证号，可选提交人脸图像，支付宝同步返回核验结果。
- 该接口支持身份证核验和人脸核验，适合作为服务人员实名认证的统一核验入口。

可确认的接口信息：

- V3 请求路径：`POST /v3/datadigital/fincloud/generalsaas/face/source/certify`
- OpenAPI 方法名：`datadigital.fincloud.generalsaas.face.source.certify`
- 响应字段至少包含：
  - `certify_no`：核验流水号
  - `passed`：是否通过，通常按字符串布尔值处理
  - `score`：人脸比对分，未传人脸图片时可能为空
  - `quality`：图像质量，未传人脸图片时可能为空
  - `mismatch_reason`：未通过原因

注意：当前环境无法直接抓取支付宝原页面正文，以上接口路径和字段来自支付宝官方文档 URL、Postman/SDK 索引及 go-pay V3 SDK 对同接口的公开定义。落地前需要在支付宝开放平台后台再次确认本应用是否已签约/开通该产品，以及请求参数的最终字段名、图片格式和大小限制。

## 2. 本仓库现状

现有实名模块：

- `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts`
  - `GET /userAuthRealName/realNameAuth`
  - 仅允许 `service_personnel`
  - 入参：`name/idcard`
- `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.service.ts`
  - `authRealName()` 会先校验身份证号是否被其他用户占用，再调用第三方实名接口。
- `apps/backend/src/modules/user-auth-real-name/api.ts`
  - 当前使用阿里云 API Gateway 实名接口，仅做姓名 + 身份证一致性校验。
  - 迁移后该调用不再参与服务人员实名认证流程，可删除或仅保留为临时回滚入口。
- `apps/backend/src/common/database/schema/user-profiles.ts`
  - 已有 `realName/idCardNumber/alipayUserId/alipayOpenId`。

现有支付宝 SDK：

- `apps/backend/src/lib/alipaySdk.ts`
  - `createAliPaySdk()`：通用支付宝应用。
  - `createWorkerAliPaySdk()`：服务人员端支付宝应用。
- `apps/backend/src/modules/pay/pay.service.ts`
  - 已用 `createWorkerAliPaySdk()` 处理服务人员支付宝授权。
- `apps/backend/src/modules/pay/providers/alipay-payout.provider.ts`
  - 已用 `createWorkerAliPaySdk()` 做服务人员支付宝提现打款。

结论：支付宝实名认证/人脸核身建议复用 `createWorkerAliPaySdk()`，因为认证主体是服务人员端用户，且服务人员支付宝授权/提现已统一走 worker 应用。

## 3. 推荐业务流程

### 3.1 最小可落地流程

1. 服务人员在 App 填写/确认姓名和身份证号。
2. 新版本 App 采集人脸照片，并显式确认授权用于实名核验。
3. 前端上传人脸照片到后端，人脸图片为可选参数：
   - 推荐先走现有文件上传链路，后端拿到图片文件 ID 后读取二进制；
   - 若旧版本 App 不支持人脸采集，可以只传 `name/idcard`；
   - 不新增接口，不回退阿里云。
4. 后端校验：
   - 当前登录用户必须是 `service_personnel`；
   - 身份证号未被其他用户占用；
   - 如果传入人脸图片，则校验图片类型、大小、尺寸、单人脸基础规则；
   - 不记录完整身份证号到日志；
   - 不记录人脸图片 base64 到日志。
5. 后端统一调用支付宝 `face.source.certify`：
   - 未传人脸图片：走支付宝身份证核验能力；
   - 已传人脸图片：走支付宝身份证 + 人脸核验能力。
6. 支付宝返回：
   - `passed=true`：允许写入/更新 `user_profiles.realName/idCardNumber`，并按是否传入人脸图片标记认证等级；
   - `passed=false`：返回失败原因，实名资料不应自动落库为已通过。

### 3.2 与现有实名接口的关系

支付宝该接口可以同时完成身份证信息核验和人脸核验，因此本期统一迁移到支付宝认证接口，不再调用现有阿里云实名接口，也不新增后端路由。

调整方式：

1. 保留现有 `GET /userAuthRealName/realNameAuth` 入口，兼容当前前端调用链路。
2. 扩展该接口的入参，除 `name/idcard` 外增加可选人脸图片标识，例如 `faceImageFileId`。
3. `UserAuthRealNameService.authRealName()` 不再调用 `realNameAuthPost()`，改为直接调用支付宝 `face.source.certify`。
4. 支付宝 `passed=true` 才视为认证通过；是否具备人脸认证能力由本次请求是否携带人脸图片决定。

保留逻辑：

- 身份证号被其他用户占用的校验继续保留；
- 当前用户必须是 `service_personnel` 的权限限制继续保留；
- 返回给前端的身份证号仍必须脱敏。

## 4. 后端接口设计

### 4.1 修改现有接口

直接修改现有接口：

`GET /userAuthRealName/realNameAuth`

鉴权：

- `AuthGuard`
- `Roles(['service_personnel'])`

请求参数建议：

```json
{
  "name": "张三",
  "idcard": "110101199001011234",
  "faceImageFileId": "file_xxx（可选）"
}
```

说明：当前接口是 `GET` + query 参数。如果继续保持 `GET`，`faceImageFileId` 也通过 query 传入且必须可选；旧版本 App 不传该参数时，后端仍统一调用支付宝接口完成身份证核验。若前端需要直接上传文件，则应单独评估是否把该现有入口改成 `POST`，但不新增 `/face/certify` 路由。

返回体建议：

```json
{
  "passed": true,
  "certifyNo": "202605061234567890",
  "score": "85.32",
  "quality": "T",
  "mismatchReason": null
}
```

失败返回：

- `400`：姓名/身份证/图片不合规、核验未通过；
- `409`：身份证号已被其他用户占用；
- `504`：支付宝接口超时或不可判定；
- `502`：支付宝响应结构异常或业务接口不可用。

### 4.2 后端服务分层

建议新增文件：

- `apps/backend/src/modules/user-auth-real-name/alipay-face-certify.client.ts`
  - 封装支付宝接口调用和响应归一化。
- `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.service.ts`
  - 编排身份证占用校验、图片读取、支付宝调用、结果落库。
- `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts`
  - 保留现有 `realNameAuth` 方法，扩展入参并返回支付宝核验结果。

不建议把支付宝调用直接写进 Controller。

## 5. 支付宝调用方式

### 5.1 SDK 选择

优先复用：

```ts
import { createWorkerAliPaySdk } from 'src/lib/alipaySdk';
```

原因：

- 服务人员端支付宝授权和提现已使用 worker 应用；
- 认证结果与服务人员主体绑定；
- 避免不同 AppId 导致权限、风控、OpenId 体系不一致。

### 5.2 调用形态

仓库当前使用的 `alipay-sdk` 已支持两类调用：

- 旧 OpenAPI：`sdk.exec(method, bizContent)`
- V3 OpenAPI：`sdk.curl(method, path, options)`

本接口属于 V3 路径，推荐用 `curl`：

```ts
const result = await workerAlipaySdk.curl(
    'POST',
    '/v3/datadigital/fincloud/generalsaas/face/source/certify',
    {
        body: {
            cert_name: name,
            cert_no: idcard,
            face_image: faceImageBase64,
            outer_biz_no: requestId,
        },
    },
);
```

字段名需要以支付宝开放平台页面为准。上面仅表示建议传参结构：姓名、身份证号、可选人脸图片、业务幂等号。正式开发前必须在开放平台页面确认 `cert_name/cert_no/face_image/outer_biz_no` 的准确命名、必填规则、图片编码规则和大小限制。

### 5.3 响应归一化

建议统一归一化为内部结构：

```ts
type AlipayFaceSourceCertifyResult = {
    certifyNo: string | null;
    passed: boolean;
    score: string | null;
    quality: string | null;
    mismatchReason: string | null;
    raw: unknown;
};
```

判断规则：

- HTTP/V3 成功只表示接口调用成功，不等于实名认证通过；
- 必须读取业务字段 `passed`；
- `passed === 'true' || passed === true` 才视为通过；
- `passed=false` 时返回 `mismatch_reason` 给前端，但不要泄露过多底层风控细节。
- `faceImageFileId` 为空时，通过结果只能标记为“身份证核验通过”；`faceImageFileId` 有值时，通过结果才标记为“身份证 + 人脸核验通过”。

## 6. 数据落库方案

### 6.1 不改库的最小方案

如果本期只要求“完成认证后允许继续流程”，可先不新增字段：

- 认证通过后沿用现有 `createUserRealNameAuth/updateUserRealNameAuth` 写入 `user_profiles.realName/idCardNumber`；
- 接口返回 `certifyNo/passed` 给前端；
- 后续需要审计时再补字段。

缺点：

- 无法长期追踪支付宝核验流水号；
- 无法区分“仅实名通过”和“实名 + 人脸通过”；
- 后台难以审计人脸认证来源。

### 6.2 推荐正式方案

建议在 `user_profiles` 增加最少审计字段：

- `face_certified_at`
- `face_certify_provider`，值固定为 `alipay`
- `face_certify_no`
- `face_certify_score`
- `face_certify_quality`

不建议保存：

- 人脸图片 base64；
- 原始支付宝完整响应；
- 明文身份证号以外的额外敏感识别材料。

如果用户当前明确要求“不动数据库”，则先采用 6.1，并把认证状态依附在既有实名状态上。

## 7. 图片与隐私要求

必须做：

- 前端采集前展示授权说明；
- 后端限制图片格式和大小；
- 日志中屏蔽姓名、身份证号、人脸图片、支付宝完整响应；
- 对 `certify_no` 可记录，但不要把它作为公开展示信息；
- 文件存储中人脸照片应设置短生命周期或认证后删除；
- 若走现有文件服务，需确认 RustFS/R2 等对象权限不是公开读。

建议：

- 图片只用于本次核验；
- 核验成功/失败后异步删除原始人脸图片；
- 后台只保留核验流水号、通过时间、质量分。

## 8. 错误处理策略

支付宝调用失败时：

- 网络超时：返回 `504`，提示“人脸认证服务响应超时，请稍后重试”；
- 业务失败但可重试：返回 `400`，提示用户重新拍摄或核对实名信息；
- 签约/权限错误：返回 `502`，记录内部告警，前端展示“认证服务暂不可用”；
- 响应结构不符合预期：返回 `502`，日志记录 trace/certify_no，但不记录敏感请求体。

幂等：

- 每次认证生成 `outer_biz_no`，建议格式：`face_${userId}_${timestamp}_${random}`；
- 如果前端重试同一次上传，可用同一个 `requestId`，避免重复计费和重复认证记录；
- 如果用户重新拍照，应生成新的 `requestId`。

## 9. 前端配合

服务人员端需要：

- 在实名流程增加“人脸认证”步骤；
- 采集或上传人脸照片；
- 上传前提示用途和授权；
- 失败时展示可理解原因：
  - 身份信息不一致；
  - 人脸照片质量不足；
  - 请重新拍摄；
  - 服务暂不可用。

不要在前端展示：

- 原始 `score`；
- 支付宝底层错误码；
- 完整身份证号；
- 原始 `certify_no`。

## 10. 实施计划

1. 在支付宝开放平台确认 worker AppId 已开通 `datadigital.fincloud.generalsaas.face.source.certify`。
2. 在开放平台页面确认请求字段、图片格式、大小限制、计费规则。
3. 新增 `alipay-face-certify.client.ts`，复用 `createWorkerAliPaySdk()`。
4. 修改现有 `GET /userAuthRealName/realNameAuth` 入参，增加人脸图片标识。
5. 服务层保留身份证占用校验，移除阿里云 `realNameAuthPost()` 前置调用。
6. 优先接入文件读取（`faceImageFileId` 可选）；如必须直接上传文件，则只调整现有入口方法，不新增路由。
7. 核验通过后更新实名资料和认证状态。
8. 增加单元测试：
   - 身份证被占用；
   - 支付宝 `passed=true`；
   - 支付宝 `passed=false`；
   - 支付宝超时/异常；
   - 响应字段缺失。
9. 验证：
   - `pnpm type-check`
   - `pnpm --filter backend test`

## 11. 待确认问题

- 支付宝该产品是否允许当前主体签约，是否需要企业资质/行业准入。
- 当前 worker AppId 是否应作为核身应用，还是需要独立风控/实名 AppId。
- 请求图片字段准确名称、编码方式、大小限制。
- 是否需要保存人脸认证通过状态到数据库。
- 人脸图片认证后是否立即删除。
- 当前 App 采集人脸照片是否需要接入活体动作，而不是普通自拍照。

## 12. 参考资料

- 支付宝官方文档：`datadigital.fincloud.generalsaas.face.source.certify`
  - https://opendocs.alipay.com/open-v3/21280890_datadigital.fincloud.generalsaas.face.source.certify
- 支付宝 OpenAPI 短链：
  - https://opendocs.alipay.com/open/04pxq6
- go-pay V3 SDK 对应接口定义：
  - https://pkg.go.dev/github.com/go-pay/gopay/alipay/v3
- 本仓库支付宝 SDK：
  - `apps/backend/src/lib/alipaySdk.ts`
- 本仓库实名模块：
  - `apps/backend/src/modules/user-auth-real-name/`
