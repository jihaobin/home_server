# Merchant Settlement Submission Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有用户端商户加盟表单补齐真实后端持久化，并新增后台管理端列表审批、备注/联系标记和全量 CSV 导出能力。

**Architecture:** 业务读写拆成两条链路：用户端提交继续归属 `massage` 模块，管理员查看与处理归属 `admin` 模块。数据库新增独立 `merchant_join_requests` 表，跨端协议在 `@repo/types` 中统一建模，管理端继续沿用 SSR 预取 + React Query + Route Group 页面结构，移动端只在现有页面上替换提交逻辑，不重做 UI。

**Tech Stack:** NestJS 11、Drizzle ORM、PostgreSQL、Zod v4、Next.js App Router、TanStack Query、TanStack React Form、Expo Router、React Hook Form

---

## File Map

- Create: `apps/backend/src/common/database/schema/merchant-join-requests.ts`
  责任：定义新表、索引、默认值。
- Modify: `apps/backend/src/common/database/schema/index.ts`
  责任：导出新 schema。
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.controller.ts`
  责任：管理员列表、更新、导出接口。
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.service.ts`
  责任：管理员业务规则、CSV 生成、状态更新时间规则。
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.repository.ts`
  责任：分页查询、更新、导出数据读取。
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.service.spec.ts`
  责任：管理员业务单测。
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
  责任：注册新 controller / service / repository。
- Modify: `apps/backend/src/modules/massage/massage.controller.ts`
  责任：新增用户端提交接口。
- Modify: `apps/backend/src/modules/massage/massage.service.ts`
  责任：新增申请提交业务。
- Modify: `apps/backend/src/modules/massage/massage.repository.ts`
  责任：写入加盟申请记录。
- Modify: `apps/backend/src/modules/massage/massage.service.spec.ts`
  责任：补提交逻辑单测。
- Modify: `packages/types/src/massage.ts`
  责任：用户端提交 schema / response。
- Modify: `packages/types/src/admin.ts`
  责任：管理端列表、更新、导出相关 schema。
- Modify: `packages/types/src/index.ts`
  责任：导出新类型。
- Create: `packages/hooks/src/api/ssr/admin-merchant-join-requests.ts`
  责任：列表 query、更新 mutation、导出 helper。
- Modify: `packages/hooks/src/api/ssr/index.ts`
  责任：导出新 hooks。
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
  责任：新增页面 SSR 预取函数。
- Modify: `apps/admin-web/src/components/layout/nav-config.ts`
  责任：新增侧边栏入口。
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/page.tsx`
  责任：页面入口与 dehydrated state 注水。
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_utils/query.ts`
  责任：URL 查询解析与归一化。
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-section.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-content.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-error.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table-skeleton.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-filter-bar.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-request-detail-drawer.tsx`
  责任：管理端列表页、筛选、表格、详情编辑抽屉。
- Modify: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`
  责任：把本地提交替换为真实 API 提交，接住 `ImageUploader` 上传后的文件 ID。

## Task 1: 建立数据库表与后端写入能力

**Files:**
- Create: `apps/backend/src/common/database/schema/merchant-join-requests.ts`
- Modify: `apps/backend/src/common/database/schema/index.ts`
- Modify: `apps/backend/src/modules/massage/massage.repository.ts`
- Modify: `apps/backend/src/modules/massage/massage.service.ts`
- Modify: `apps/backend/src/modules/massage/massage.controller.ts`
- Modify: `apps/backend/src/modules/massage/massage.service.spec.ts`

- [ ] **Step 1: 先补共享写入协议，确定字段名不会在后端实现途中漂移**

需要先在类型层固定以下请求字段：

```ts
type CreateMerchantJoinRequest = {
    merchantName: string
    gender: "male" | "female"
    phone: string
    age: number
    intentCity: string
    photoFileId?: string | null
}
```

响应最小返回：

```ts
type CreateMerchantJoinRequestResponse = {
    id: string
    createdAt: string
}
```

Expected:

- 后续 controller / service / mobile 提交都复用同一组字段名

- [ ] **Step 2: 新增 `merchant_join_requests` 表 schema**

表结构目标：

```ts
export const merchantJoinRequests = pgTable(
    "merchant_join_requests",
    {
        id: varchar("id", { length: 255 }).primaryKey().$default(() => createId()).unique(),
        merchantName: varchar("merchant_name", { length: 50 }).notNull(),
        gender: varchar("gender", { length: 16 }).notNull(),
        phone: varchar("phone", { length: 20 }).notNull(),
        age: integer("age").notNull(),
        intentCity: varchar("intent_city", { length: 255 }).notNull(),
        photoFileId: varchar("photo_file_id", { length: 255 }),
        isContacted: boolean("is_contacted").notNull().default(false),
        adminRemark: text("admin_remark"),
        contactedAt: timestamp("contacted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
    },
    (table) => [
        index("idx_merchant_join_requests_created_at").on(table.createdAt.desc()),
        index("idx_merchant_join_requests_contacted_created_at").on(table.isContacted, table.createdAt.desc()),
        index("idx_merchant_join_requests_phone").on(table.phone),
    ],
)
```

Expected:

- 字段完整覆盖 spec
- `isContacted` 默认 `false`
- `contactedAt` 允许为空

- [ ] **Step 3: 在 `massage.repository.ts` 中新增写库方法**

目标签名：

```ts
async createMerchantJoinRequest(input: {
    merchantName: string
    gender: "male" | "female"
    phone: string
    age: number
    intentCity: string
    photoFileId?: string | null
}) {
    // insert + return created row
}
```

要求：

- 入库前不在 repository 做业务校验
- 只负责 insert 和返回主键/时间

- [ ] **Step 4: 在 `massage.service.ts` 中新增提交业务，统一 trim / normalize**

目标行为：

```ts
const payload = {
    merchantName: input.merchantName.trim(),
    gender: input.gender,
    phone: input.phone.replace(/\s+/g, ""),
    age: input.age,
    intentCity: input.intentCity.trim(),
    photoFileId: input.photoFileId?.trim() || null,
}
```

要求：

- service 层做最终规范化
- 返回 `id` 与 `createdAt`

- [ ] **Step 5: 在 `massage.controller.ts` 中新增 `POST /massage/merchant-join-requests`**

控制器目标：

```ts
@Post("merchant-join-requests")
@UseGuards(AuthGuard)
@AuthOptional()
@UsePipes(new ZodValidationPipe(CreateMerchantJoinRequestSchema))
async createMerchantJoinRequest(
    @Body() body: CreateMerchantJoinRequest,
) {
    return await this.massageService.createMerchantJoinRequest(body)
}
```

要求：

- 沿用 `massage` 模块现有 `AuthGuard + AuthOptional` 模式
- 接口不依赖 `req.user`

- [ ] **Step 6: 先写 `massage.service.spec.ts` 失败用例，再补最小实现**

至少新增两类测试：

```ts
it("createMerchantJoinRequest 会规范化字段并写入 repository", async () => {
    // trim name / city, strip phone spaces, empty photo -> null
})

it("createMerchantJoinRequest 保留有效 photoFileId", async () => {
    // photoFileId 有值时不丢失
})
```

Expected:

- 测试先因为方法不存在或 mock 未补而失败
- 完成实现后通过

- [ ] **Step 7: 运行后端定向测试**

Run: `pnpm --filter backend test -- --runInBand src/modules/massage/massage.service.spec.ts`

Expected:

- `MassageService` 相关测试全部通过

## Task 2: 建立管理员列表、更新与导出接口

**Files:**
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.repository.ts`
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.service.ts`
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.controller.ts`
- Create: `apps/backend/src/modules/admin/admin-merchant-join-requests.service.spec.ts`
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
- Modify: `packages/types/src/admin.ts`

- [ ] **Step 1: 在 `packages/types/src/admin.ts` 中先固定管理员协议**

至少定义：

```ts
type AdminMerchantJoinRequestListQuery = {
    page: number
    limit: number
    keyword?: string
    contactStatus?: "all" | "contacted" | "uncontacted"
}

type AdminMerchantJoinRequest = {
    id: string
    merchantName: string
    gender: "male" | "female"
    phone: string
    age: number
    intentCity: string
    photoFileId: string | null
    photoFileUrl: string | null
    isContacted: boolean
    adminRemark: string | null
    contactedAt: string | null
    createdAt: string
    updatedAt: string
}

type AdminUpdateMerchantJoinRequest = {
    isContacted: boolean
    adminRemark?: string | null
}
```

- [ ] **Step 2: 实现 repository 的分页查询与更新方法**

目标方法：

```ts
findAll(query)
findById(id)
update(id, input)
findAllForExport()
```

要求：

- `keyword` 支持姓名 / 手机号 / 意向城市模糊筛选
- 默认 `createdAt desc`
- 导出读取不分页

- [ ] **Step 3: 在 service 中实现状态规则与文件 URL 解析**

依赖：

- `FilesService` 用于把 `photoFileId` 解析为 `photoFileUrl`

核心规则：

```ts
if (!existing.isContacted && input.isContacted) {
    contactedAt = new Date()
} else if (existing.isContacted && !input.isContacted) {
    contactedAt = null
} else {
    contactedAt = existing.contactedAt
}
```

要求：

- 备注允许为空字符串，入库时转 `null` 或 `trim` 后结果
- 列表返回统一带 `photoFileUrl`

- [ ] **Step 4: 在 controller 中新增三个 admin 接口**

接口目标：

```ts
@Get("merchant-join-requests")
list(...)

@Patch("merchant-join-requests/:id")
update(...)

@Get("merchant-join-requests/export.csv")
exportCsv(...)
```

导出接口要求：

- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition` 带文件名
- 内容以 `\uFEFF` 开头

- [ ] **Step 5: 写管理员 service 单测，先覆盖规则再实现**

至少包含：

```ts
it("首次标记已联系时写入 contactedAt", async () => {})
it("从已联系改回未联系时清空 contactedAt", async () => {})
it("导出时包含 BOM 和中文表头", async () => {})
it("列表项会解析 photoFileUrl", async () => {})
```

- [ ] **Step 6: 在 `admin.module.ts` 注册新依赖**

要求：

- `FilesModule` 已存在，直接复用
- controller / service / repository 都要注册

- [ ] **Step 7: 运行管理员定向测试**

Run: `pnpm --filter backend test -- --runInBand src/modules/admin/admin-merchant-join-requests.service.spec.ts`

Expected:

- 新增 service 规则测试通过

## Task 3: 补共享 hooks 与管理端 SSR 预取入口

**Files:**
- Create: `packages/hooks/src/api/ssr/admin-merchant-join-requests.ts`
- Modify: `packages/hooks/src/api/ssr/index.ts`
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 新增 admin merchant join requests query/mutation 封装**

参考 `admin-withdrawals.ts`，至少包含：

```ts
export const adminMerchantJoinRequestsQueryOptions(...)
export function useAdminMerchantJoinRequests(...)
export function invalidateAdminMerchantJoinRequestsQuery(...)
export function useUpdateAdminMerchantJoinRequest(...)
export function getAdminMerchantJoinRequestsExportUrl()
```

要求：

- query key 独立，如 `["admin-merchant-join-requests"]`
- `meta.errorMessage` 明确

- [ ] **Step 2: 在 `prefetchers.ts` 增加页面预取函数**

目标签名：

```ts
export async function preloadMerchantJoinRequestsPageState(
    query: AdminMerchantJoinRequestListQuery = {},
) { ... }
```

要求：

- 与 `preloadWithdrawalsPageState` 同结构
- 处理未登录时的 `/auth/login` 重定向

- [ ] **Step 3: 导出新 hooks 与类型**

要求：

- `packages/types/src/index.ts` 导出新 schema / type
- `packages/hooks/src/api/ssr/index.ts` 导出新 query/mutation/helper

- [ ] **Step 4: 运行 hooks/admin-web 相关类型检查**

Run: `pnpm type-check`

Expected:

- 至少 `packages/types`、`packages/hooks`、`admin-web`、`mobile-user` 不再因缺少导出报错

## Task 4: 把移动端页面从本地提交切换到真实提交

**Files:**
- Modify: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`

- [ ] **Step 1: 先确认 `ImageUploader` 接入方式，避免把本地 URI 当成 file id 保存**

从现有组件可知：

- `onChange` 会先收到本地压缩 URI
- 真正服务器文件标识来自 `onUploadSuccess(fileIdentifier, fileUrl)`

实现要求：

- 页面表单不能继续把本地 URI 直接当 `photoFileId`
- 需要新增单独状态或字段来接收 `fileIdentifier`

- [ ] **Step 2: 接入现有上传 hook，并在上传成功后写入 `photoFileId`**

目标行为：

```ts
onUpload={mutateAsync}
onUploadSuccess={(fileIdentifier) => {
    setValue("photoFileId", fileIdentifier)
}}
onChange={(uri) => {
    // 只用于本地预览，不作为最终提交值
}
```

如果项目里已有标准上传 hook，必须复用；不要重写一套裸 `fetch` 上传。

- [ ] **Step 3: 提交时调用真实接口并处理 loading / reset**

目标行为：

```ts
const mutation = useCreateMerchantJoinRequest()

await mutation.mutateAsync({
    merchantName: ...trimmed,
    gender: ...,
    phone: ...,
    age: Number.parseInt(..., 10),
    intentCity: ...trimmed,
    photoFileId: values.photoFileId || null,
})
reset(defaultValues)
toast.success("提交成功，稍后会有工作人员联系您")
```

要求：

- 按钮 loading 时禁止重复点击
- 失败显示错误提示
- 成功后清空图片 file id 与预览状态

- [ ] **Step 4: 如当前项目没有专门的 mobile hook，则补最小 API client 封装并保持命名清晰**

要求：

- 不要把 admin SSR hooks 直接挪到移动端使用
- 若需新增移动端 hooks，遵循仓库现有 API hook 分层

- [ ] **Step 5: 运行移动端类型检查**

Run: `pnpm --filter mobile-user run type-check`

Expected:

- 页面提交链路无类型错误
- `age` 已从字符串正确转成 number

## Task 5: 新增管理端列表页、详情抽屉与导出按钮

**Files:**
- Modify: `apps/admin-web/src/components/layout/nav-config.ts`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/page.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_utils/query.ts`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-section.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-content.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-error.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table-skeleton.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-filter-bar.tsx`
- Create: `apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-request-detail-drawer.tsx`

- [ ] **Step 1: 建 page + query util 骨架，先打通 SSR 预取**

page 目标：

```tsx
export default async function MerchantJoinRequestsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseMerchantJoinRequestsSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadMerchantJoinRequestsPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <MerchantJoinRequestsPageSection
                initialQuery={normalizeMerchantJoinRequestsQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
```

- [ ] **Step 2: 实现 query 解析与筛选表单默认值**

最小 query state：

```ts
type MerchantJoinRequestsQueryState = {
    page: number
    limit: number
    keyword?: string
    contactStatus?: "all" | "contacted" | "uncontacted"
}
```

- [ ] **Step 3: 实现页面内容区、列表表格与导航入口**

页面至少包含：

- 标题 `商户加盟申请`
- 筛选栏
- `导出 CSV` 按钮
- 列表表格
- `查看/处理` 操作

侧边栏新增：

```ts
{
    label: "商户加盟申请",
    href: "/merchant-join-requests",
    icon: ???,
    description: "加盟线索查看、备注与联系跟进",
}
```

- [ ] **Step 4: 实现详情抽屉，用 `@tanstack/react-form` 编辑备注和联系状态**

抽屉表单最小字段：

```ts
type FormValues = {
    isContacted: boolean
    adminRemark: string
}
```

要求：

- 保存后调用更新 mutation
- 成功后关闭抽屉或更新当前项
- 不新增 `react-hook-form`

- [ ] **Step 5: 实现导出按钮**

推荐实现：

```ts
window.location.href = getAdminMerchantJoinRequestsExportUrl()
```

或使用临时 `a` 标签下载。

要求：

- 第一版导出全量
- 不依赖当前页表格快照拼 CSV
- 直接命中后端导出接口

- [ ] **Step 6: 运行管理端类型检查**

Run: `pnpm type-check`

Expected:

- 新页面与新 hooks 无类型错误
- 管理端未引入新的 `react-hook-form`

## Task 6: 联调验证与回归

**Files:**
- Verify: `apps/backend/src/**/merchant-join-requests*`
- Verify: `packages/types/src/massage.ts`
- Verify: `packages/types/src/admin.ts`
- Verify: `packages/hooks/src/api/ssr/admin-merchant-join-requests.ts`
- Verify: `apps/mobile-user/components/massage/merchant-settlement-screen.tsx`
- Verify: `apps/admin-web/src/app/(management)/merchant-join-requests/**`

- [ ] **Step 1: 运行后端相关测试**

Run: `pnpm --filter backend test -- --runInBand src/modules/massage/massage.service.spec.ts src/modules/admin/admin-merchant-join-requests.service.spec.ts`

Expected:

- 两组 service 单测全部通过

- [ ] **Step 2: 运行全仓类型检查**

Run: `pnpm type-check`

Expected:

- monorepo 通过类型检查

- [ ] **Step 3: 运行管理端与移动端手工回归**

Run:

```bash
pnpm backend:dev
pnpm admin:dev
pnpm mobile-user:dev
```

手工验收清单：

- 用户端提交合法表单后数据库出现新记录
- `photo_file_id` 保存的是文件标识，不是本地 `file://` URI
- 新记录默认 `is_contacted = false`
- 管理端可看到最新申请，默认按提交时间倒序
- 管理员可编辑备注并切换已联系状态
- 首次标记已联系后有 `contactedAt`
- 改回未联系后 `contactedAt` 清空
- 点击 `导出 CSV` 可下载文件
- CSV 含中文表头、BOM、备注与照片地址列

- [ ] **Step 4: 运行 lint / format 校验**

Run:

```bash
pnpm lint
pnpm format:check
```

Expected:

- 新增文件通过 lint 与格式检查

- [ ] **Step 5: 整理最终提交**

Run:

```bash
git add apps/backend/src/common/database/schema/index.ts \
    apps/backend/src/common/database/schema/merchant-join-requests.ts \
    apps/backend/src/modules/admin/admin-merchant-join-requests.controller.ts \
    apps/backend/src/modules/admin/admin-merchant-join-requests.repository.ts \
    apps/backend/src/modules/admin/admin-merchant-join-requests.service.ts \
    apps/backend/src/modules/admin/admin-merchant-join-requests.service.spec.ts \
    apps/backend/src/modules/admin/admin.module.ts \
    apps/backend/src/modules/massage/massage.controller.ts \
    apps/backend/src/modules/massage/massage.repository.ts \
    apps/backend/src/modules/massage/massage.service.ts \
    apps/backend/src/modules/massage/massage.service.spec.ts \
    packages/types/src/admin.ts \
    packages/types/src/index.ts \
    packages/types/src/massage.ts \
    packages/hooks/src/api/ssr/admin-merchant-join-requests.ts \
    packages/hooks/src/api/ssr/index.ts \
    apps/admin-web/src/lib/prefetchers.ts \
    apps/admin-web/src/components/layout/nav-config.ts \
    apps/admin-web/src/app/(management)/merchant-join-requests/page.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_utils/query.ts \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-section.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-content.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-page-error.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-table-skeleton.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-requests-filter-bar.tsx \
    apps/admin-web/src/app/(management)/merchant-join-requests/_components/merchant-join-request-detail-drawer.tsx \
    apps/mobile-user/components/massage/merchant-settlement-screen.tsx \
    docs/superpowers/specs/2026-04-21-merchant-settlement-submission-admin-design.md \
    docs/superpowers/plans/2026-04-21-merchant-settlement-submission-admin-implementation.md
git commit -m "feat: add merchant join request workflow"
```

## Self-Review

- Spec coverage:
  - 新表、两个管理字段、后台审批页、极简联系流程、CSV 导出都已覆盖
  - `ImageUploader` 文件 ID 问题已单独拆进移动端任务
- Placeholder scan:
  - 无 `TODO` / `TBD`
  - 每个阶段都落到了明确文件与验证命令
- Type consistency:
  - 用户端统一使用 `photoFileId`
  - 管理端统一使用 `isContacted` / `adminRemark` / `contactedAt`
