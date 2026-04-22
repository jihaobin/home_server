# 商户加盟申请提交与后台审批设计

> 目标：在现有用户端按摩页商户加盟表单 UI 基础上，补齐真实后端持久化、后台管理端审批列表、备注与联系标记、以及全量 CSV 导出能力。

## 1. 背景

现状已经具备以下能力：

- 用户端页面 [merchant-settlement-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/massage/merchant-settlement-screen.tsx) 已完成表单 UI 和本地校验
- 页面提交后当前仅 `console.log` + toast，未写入后端
- 仓库中已有一份只覆盖 UI 落地的设计文档 [2026-04-20-mobile-user-merchant-settlement-design.md](/mnt/f/home_server/docs/superpowers/specs/2026-04-20-mobile-user-merchant-settlement-design.md)

本次需求不是重做 UI，而是在既有页面基础上补齐完整业务链路：

1. 用户提交加盟申请后写入数据库
2. 后台管理员可以查看全部申请
3. 后台管理员可以给每条申请填写备注，并标记是否已经联系过
4. 管理端支持导出全部加盟申请为 CSV

已确认的业务边界：

- 申请单不需要关联当前登录用户 `user_id`
- 审批流程极简，不做通过/拒绝流转
- “处理状态”的真实业务语义是“管理员是否已联系申请人”
- 导出格式第一版固定为 `CSV`
- 图片不导出二进制，后台和 CSV 中只保留文件标识或可访问地址

## 2. 设计目标

- 保持用户端提交体验简单直接，不新增复杂步骤
- 后端数据结构最小闭环，只保存当前表单真实需要的数据和运营处理状态
- 管理端沿用现有 SSR + React Query + 表格筛选页模式
- 不引入复杂审批状态机，避免过度设计
- CSV 导出字段与列表字段保持一致，便于运营直接使用

## 3. 范围

### 3.1 本期包含

- 新增商户加盟申请数据库表
- 新增用户端提交接口
- 移动端表单接入真实提交
- 新增管理端申请列表页
- 新增管理端申请备注与“已联系”标记操作
- 新增管理端全量 CSV 导出接口与页面入口

### 3.2 本期不包含

- 通过 / 拒绝 / 删除申请
- 多级审批、审批记录流转、操作日志
- 自动短信/电话/IM 联系能力
- 导出筛选子集、异步导出任务中心
- 图片二进制打包导出
- 与用户账号、商户正式入驻实体的自动关联

## 4. 方案比较

### 方案 A：在 `massage` 模块下新增公开提交接口，在 `admin` 模块下新增独立管理接口

做法：

- 用户端提交继续归属 `massage` 业务域
- 管理端读取、更新、导出归属 `admin` 业务域
- 共享类型定义在 `@repo/types`

优点：

- 读写职责清晰
- 与现有仓库分层一致
- 移动端和管理端的鉴权边界自然分离

缺点：

- 需要在两个模块各补一组接口

结论：

- 本期采用

### 方案 B：全部塞进 `admin` 模块，由移动端直接调用 admin 风格接口

优点：

- 看起来接口更集中

缺点：

- 违反业务语义
- 用户端提交接口与管理员鉴权风格混杂
- 不符合现有模块结构

结论：

- 不采用

### 方案 C：不建新表，直接把申请写入现有用户资料或文件表扩展字段

优点：

- 初看改动少

缺点：

- 申请数据和用户基础资料语义不同
- 后续列表筛选、备注、联系状态、导出都会变得混乱
- 不利于后台单独管理

结论：

- 不采用

## 5. 数据模型设计

### 5.1 新表

建议新增表：`merchant_join_requests`

建议字段：

- `id`: 主键，沿用仓库 `createId()`
- `merchant_name`: 申请人姓名
- `gender`: 性别，值域 `male | female`
- `phone`: 手机号
- `age`: 年龄，整数
- `intent_city`: 意向合作城市
- `photo_file_id`: 上传图片文件标识，允许为空
- `is_contacted`: 是否已联系，布尔值，默认 `false`
- `admin_remark`: 管理员备注，允许为空
- `contacted_at`: 标记为已联系时记录时间，允许为空
- `created_at`: 申请创建时间
- `updated_at`: 更新时间

说明：

- 用户已明确不需要保存提交人的 `user_id`
- `is_contacted` 与 `admin_remark` 对应本次新增的两个管理字段
- 增加 `contacted_at` 虽然不是需求显式要求，但它是“是否联系过”最小可审计补充，成本低，运营价值高
- `photo_file_id` 保存图片文件标识；返回给前端展示时再由文件服务解析为 URL

### 5.2 索引建议

- `created_at desc`：支持后台默认按最新申请排序
- `is_contacted, created_at desc`：支持按联系状态筛选
- `phone`：便于精确检索和去重排查

### 5.3 状态模型

本期不引入复杂状态枚举，仅保留：

- `is_contacted = false`：未联系
- `is_contacted = true`：已联系



管理员备注是独立字段，不参与状态判断。

## 6. 接口设计

## 6.1 用户端提交接口

建议新增：

- `POST /massage/merchant-join-requests`

请求体字段：

- `merchantName`
- `gender`
- `phone`
- `age`
- `intentCity`
- `photoFileId`

校验规则：

- 姓名：2-20 字符
- 性别：`male | female`
- 手机号：大陆手机号格式
- 年龄：18-65 的整数
- 意向合作城市：非空，建议最大 100 或 255 字符
- `photoFileId`：可空；若有值，则按现有文件系统可识别的文件 ID 处理

响应：

- 返回创建成功的申请 ID
- 可附带 `createdAt`

提交成功提示维持当前文案：

- `提交成功，稍后会有工作人员联系您`

### 6.2 管理端列表接口

建议新增：

- `GET /admin/merchant-join-requests`

查询参数：

- `page`
- `limit`
- `keyword`：按姓名 / 手机号 / 意向城市模糊搜索
- `contactStatus`：`all | contacted | uncontacted`

返回字段：

- `id`
- `merchantName`
- `gender`
- `phone`
- `age`
- `intentCity`
- `photoFileUrl`
- `photoFileId`
- `isContacted`
- `adminRemark`
- `contactedAt`
- `createdAt`
- `updatedAt`

默认排序：

- 按 `createdAt desc`

### 6.3 管理端更新接口

建议新增：

- `PATCH /admin/merchant-join-requests/:id`

允许更新：

- `isContacted`
- `adminRemark`

更新规则：

- 首次从 `false -> true` 时写入 `contactedAt = now`
- 若维持 `true -> true`，不重复覆盖 `contactedAt`
- 若允许回退到 `false`，则 `contactedAt` 置空

设计取舍：

- 为了简单和可修正性，后台允许把“已联系”改回“未联系”
- 如果后续业务希望防误操作，再追加确认弹窗即可，不需要现在做成不可逆

### 6.4 管理端 CSV 导出接口

建议新增：

- `GET /admin/merchant-join-requests/export.csv`

行为：

- 导出当前库中全部加盟申请
- 第一版不做异步任务，不做分批下载
- 默认按 `createdAt desc` 导出

CSV 列建议：

- 申请时间
- 姓名
- 性别
- 手机号
- 年龄
- 意向合作城市
- 照片文件 ID
- 照片访问地址
- 是否已联系
- 联系时间
- 管理员备注

导出约束：

- 使用 UTF-8 with BOM，降低中文在 Excel 中打开乱码的概率
- 值中若含逗号、双引号、换行，需做标准 CSV 转义

## 7. 后端模块设计

### 7.1 `massage` 模块

新增职责：

- 接收用户端加盟申请提交
- 调用 repository 持久化

建议新增或修改文件：

- `apps/backend/src/modules/massage/massage.controller.ts`
- `apps/backend/src/modules/massage/massage.service.ts`
- `apps/backend/src/modules/massage/massage.repository.ts`

### 7.2 `admin` 模块

新增职责：

- 申请列表查询
- 申请备注与联系状态更新
- CSV 导出

建议新增文件：

- `apps/backend/src/modules/admin/admin-merchant-join-requests.controller.ts`
- `apps/backend/src/modules/admin/admin-merchant-join-requests.service.ts`
- `apps/backend/src/modules/admin/admin-merchant-join-requests.repository.ts`

并在：

- `apps/backend/src/modules/admin/admin.module.ts`

中注册。

### 7.3 数据库 schema

建议新增：

- `apps/backend/src/common/database/schema/merchant-join-requests.ts`

并在：

- `apps/backend/src/common/database/schema/index.ts`

导出。

## 8. 共享类型设计

建议在 `@repo/types` 中新增以下 schema：

### 8.1 用户端

- `CreateMerchantJoinRequestSchema`
- `CreateMerchantJoinRequestResponseSchema`

### 8.2 管理端

- `AdminMerchantJoinRequestSchema`
- `AdminMerchantJoinRequestListQuerySchema`
- `AdminMerchantJoinRequestListResponseSchema`
- `AdminUpdateMerchantJoinRequestSchema`

建议放置位置：

- 用户端通用加盟申请 schema 放在 `packages/types/src/massage.ts`
- 管理端列表/更新 schema 放在 `packages/types/src/admin.ts`

原因：

- 提交入口属于按摩业务域
- 审批列表属于 admin 域

## 9. 移动端设计

### 9.1 提交逻辑

当前页面 [merchant-settlement-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/massage/merchant-settlement-screen.tsx) 里的 `onSubmit` 仅打印日志。

本期应改为：

- 提交前对字段做 trim / normalize
- 调用真实 API
- 提交中禁用按钮，避免重复提交
- 成功后 toast 提示
- 成功后重置表单
- 失败时展示统一错误提示

### 9.2 图片字段

现有 `ImageUploader` 返回值当前被写入 `photoToken`

本期语义统一为：

- 前端仍可沿用页面内部字段名，但在请求出参层应明确映射为 `photoFileId`
- 若上传组件返回的已是文件 ID，则直接提交
- 若上传组件返回的是临时 URI，则必须先对齐现有上传链路，再提交文件 ID

这一点需要实现前确认 `ImageUploader` 当前真实返回格式；spec 约束的是对外接口最终必须保存文件标识，而不是本地 URI。

### 9.3 用户体验

- 成功提示沿用当前文案
- 失败提示保持明确，例如“提交失败，请稍后重试”
- 不新增额外确认弹窗

## 10. 管理端页面设计

### 10.1 页面入口

建议在运营管理导航中新增：

- `商户加盟申请`

建议路由：

- `/merchant-join-requests`

建议导航文案：

- 标签：`商户加盟申请`
- 描述：`加盟线索查看、备注与联系跟进`

### 10.2 页面结构

沿用现有管理端 SSR 页面模式：

- page.tsx 负责解析 query + 预取 dehydrated state
- `_components/*` 承担筛选栏、表格、抽屉/弹窗
- `_utils/query.ts` 负责 URL 查询参数归一化

页面建议包含：

- 顶部标题区
- 筛选栏
- 导出按钮
- 列表表格
- 详情抽屉或编辑弹窗

### 10.3 列表字段

列表建议展示：

- 提交时间
- 姓名
- 性别
- 手机号
- 年龄
- 意向合作城市
- 照片
- 联系状态
- 管理员备注摘要
- 操作

### 10.4 操作设计

每条记录支持：

- 查看大图 / 查看照片
- 编辑备注
- 切换“已联系 / 未联系”

推荐交互：

- 备注与联系状态合并在一个详情抽屉或编辑弹窗中完成
- 表格行内只保留“查看/处理”按钮，避免页面过于拥挤

### 10.5 导出设计

- 页面右上角提供 `导出 CSV` 按钮
- 点击后直接下载，不增加二次确认
- 第一版导出全量数据，不跟随当前筛选条件变化

若后续业务要导出“当前筛选结果”，再单独扩展，不在本期 spec 内。

## 11. SSR 与前端数据层约束

管理端必须遵循现有约束：

- 使用 `ensureSsrApiClient()`
- 使用 `prefetchDehydratedState()`
- 页面通过 `HydrateClient` 注水
- API query / mutation 能力放在 `packages/hooks/src/api/ssr`

建议新增：

- `packages/hooks/src/api/ssr/admin-merchant-join-requests.ts`

包含：

- 列表 query options
- 更新 mutation
- 导出 URL helper 或 download helper
- query invalidation

## 12. 权限与安全

- 用户端提交接口沿用按摩频道风格，可允许登录态可选，不强制绑定用户身份
- 管理端所有读取、更新、导出接口必须走管理员鉴权
- 管理端导出接口返回的手机号、备注属于敏感运营信息，仅管理员可见

## 13. 测试设计

### 13.1 后端

至少覆盖：

- 提交接口参数校验
- 提交成功写库
- 列表查询筛选与分页
- 更新备注成功
- 更新联系状态时 `contactedAt` 行为正确
- CSV 导出字段顺序、中文表头、转义逻辑正确

### 13.2 移动端

至少覆盖：

- 提交成功后提示与重置
- 提交失败时错误提示
- 按钮 loading / 防重复提交

### 13.3 管理端

至少覆盖：

- 页面 query 解析与 SSR 预取
- 列表渲染
- 更新备注 / 联系状态后列表刷新
- 导出按钮命中正确接口

## 14. 风险与实现前注意项

### 14.1 `ImageUploader` 返回值语义未完全确认

这是当前唯一需要在实现前补充确认的技术点：

- 若返回的是文件 ID，接入很直接
- 若返回的是本地 URI，需要复用现有上传链路先换取文件 ID

该问题不影响整体设计，但会影响移动端提交前的最后一步实现。

### 14.2 管理端表单规范

仓库约定管理端新增表单统一使用 `@tanstack/react-form` + Zod。

因此后台“备注/联系状态”编辑区不能新增 `react-hook-form`。

### 14.3 CSV 全量导出规模

本期默认数据量可同步导出。

若后续申请量显著增长，再升级为异步导出任务，不提前过度设计。

## 15. 验收标准

满足以下条件视为完成：

- 用户端商户加盟表单提交后，数据库中能查到完整申请记录
- 记录中包含 `is_contacted` 和 `admin_remark` 两个管理字段
- 管理端存在独立页面可查看申请列表
- 管理员可以编辑备注并标记是否已联系
- 管理员可以下载包含全部申请记录的 CSV
- 移动端、后端、管理端都遵循现有仓库约定，不引入明显违背现有模式的实现

## 16. 最终设计结论

本期采用“单独申请表 + 用户端提交接口 + admin 独立管理页 + 极简联系状态 + 全量 CSV 导出”的方案。

这是当前最小且完整的闭环方案，能够满足运营跟进需求，同时避免过早引入复杂审批流、账号绑定和导出任务系统。
