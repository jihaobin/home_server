# 管理端 Web 工作计划

## 背景与原则

- 需求来源：`admin.md` 描述的 6 大模块（登录、统计、用户、订单、服务分类、收益与提现）尚未在 `apps/admin-web` 中实现，目前仅保留 Next.js 默认模板。
- 技术基座：管理端采用 Next.js App Router，样式与 UI 组件统一引入 `@repo/web-ui`（packages/web-ui），数据请求共用 `@repo/utils/api-client` 与 `@repo/lib` 中的 query/client 能力。
- 服务端耦合：后端 NestJS（apps/backend）已有订单、服务、服务人员等业务模块，但缺少面向管理员的聚合接口，需要在原模块或新增 `admin` 模块中补齐统计、筛选接口，并确保 Drizzle schema 同步。
- 工程规范：沿用 Turborepo 工作流，任何功能合入前需通过 `pnpm lint`、`pnpm type-check`、针对模块的 `pnpm test --filter=backend`/前端测试命令。

### 补充开发规范

- **Hook 化的数据访问**：所有网络请求必须封装为 Hook，并以 `packages/hooks/src/api` 目录作为编码范式（命名、目录结构、返回值和错误处理保持一致），页面以内置 Hook 暴露的状态/方法驱动 UI。
- **Suspense + 骨架屏**：涉及请求或异步逻辑的组件均需置于 React `Suspense` 边界内，且按照 Next.js 最佳实践保持细粒度拆分；加载状态统一使用 `@repo/web-ui/skeleton` 组件，便于交互一致。
- **错误边界**：为各细分 UI 区块提供 React Error Boundary（可自定义 `ErrorBoundary` 组件），当子树报错时展示 `web-ui` 风格的重试/返回按钮，避免整页崩溃。
- **表单规范**：所有表单（含登录/注册）统一迁移到 `@tanstack/react-form` + Zod，参照 [shadcn/tanstack-form 指南](https://ui.shadcn.com/docs/forms/tanstack-form) 与 [TanStack Form 文档](https://tanstack.com/form/latest/docs/overview)，弃用 `react-hook-form`；共用 `@repo/web-ui/form` 输入组件，保持校验信息一致。
- **表格规范**：数据列表由 TanStack Table 构建，按照 [shadcn data-table 教程](https://ui.shadcn.com/docs/components/data-table) 与 [官方文档](https://tanstack.com/table/latest/docs/introduction) 实现列定义、排序、过滤，并以 `@repo/web-ui/table` 等配套组件实现样式。
- **错误/加载细粒度控制**：在 Suspense 与 Error Boundary 之外，必要时补充 `useTransition`、分区级 `fallback`，确保页面可独立刷新与重试。
- **TanStack Query SSR 指南**：请在新增页面/Hook 前阅读《[Next.js SSR + TanStack Query 集成指南](./admin-web-ssr-guide.md)》，复用统一的预取、水合与错误处理模板。

## 里程碑拆解

### 1. 基础设施搭建（预计 1~2 天）✅ 已完成

- 【前端】完成 `apps/admin-web` 的 App Router 结构规划：`(auth)`/`(dashboard)`/`(management)` 分组路由，抽象 `src/components/layout` 存放顶部导航、侧边栏、页面容器等。→ `AdminShell`、`AdminSidebar`、`TopBar`、各 `layout.tsx` 已落地，默认页面重定向至 `/dashboard`。
- 【前端】扩展 `src/components/providers.tsx`：接入 `@tanstack/react-query`、`@repo/web-ui/sonner`、`next-intl`（如需）等 Provider，并封装 API baseURL/env 读取逻辑（支持 `.env` 与 `pnpm env:setup` 合并的变量）。→ 现已集成 React Query + Devtools、Sonner Toaster、Vercel Analytics，并通过 `@repo/lib/query-client` 统一错误处理。
- 【前端】引入 `@vercel/analytics`/日志 Hook（如需）以及全局样式（`@repo/web-ui/globals.css` 已连接，需配置 CSS 变量、暗色模式策略）。→ `RouteAnalyticsTracker` 监听路由变更，`globals.css` 与 `@repo/web-ui` 变量保持同步，body/font/色彩策略统一。
- 【后端】为 admin 前端提供可复用的 RBAC/Session（在 `apps/backend/src/modules/auth` 内新增管理员角色校验中间件），并梳理 API 文档以便 Swagger/Scalar 输出。
  - `AdminSessionMiddleware`（`apps/backend/src/modules/auth/admin-session.middleware.ts`）统一解析 Better-Auth Session、校验 `admin/super_admin` 角色，并把 `req.session`/`req.admin` 注入到后续控制器，方便在 `/admin/**` 路径一次性套用。
  - `rbac.utils.ts` 提供 `normalizeUserRoles` / `hasRequiredRole` / `hasAdminRole` 辅助方法，`AuthGuard` 也复用同一套逻辑，避免角色处理分散。
  - API 文档新增“管理员接口访问说明”，告知 QA/前端如何携带 Cookie、如何触发权限校验。

### 2. 管理员登录与权限控制（预计 2 天）✅ 已完成

- 【后端】实现管理员账号的鉴权流程：
  - 在 better-auth/自定义登录逻辑中新增管理员角色字段，提供 `POST /admin/login`、`POST /admin/logout`、`GET /admin/profile` 接口；
  - 支持简单白名单策略（非管理员禁止登录，直接返回 403），并输出登录失败原因。
- 【前端】创建 `/auth/login` 页面，使用 `@repo/web-ui/form`、`input`、`button` 组件构建登录表单。
- 【前端】封装 `lib/auth.ts`，利用 `next/headers` 读写 cookies，统一 API Client（`@repo/utils/api-client`）附带 `Cookie`；在 `middleware.ts` 中限制除 `/auth/*` 与静态资源外的访问。
- 【前端】落地退出登录、Token 续期（轮询 `profile` 或使用 SSE 推送）与错误文案处理。

### 3. 布局、导航与通用组件（预计 2 天）✅ 已完成

- 【前端】构建双栏布局：`AdminShell` + `AdminSidebar` + `TopBar` 现已结合 `PageHeader` 在 `/dashboard` 与 `(management)` 路由统一输出面包屑与操作栏（参见 `apps/admin-web/src/components/layout` 与各页面的 `PageHeader` 调用）。
- 【前端】抽象 `PageHeader`、`DataFilterBar`、`EntityTable`、`EntityDrawer` 等原子组件，集中在 `apps/admin-web/src/components/common/` 并通过 `index.ts` 导出，便于在模块中复用。
- 【前端】统一表格、分页与筛选交互：`/users` 页面示例（`users/_components/users-page-content.tsx`）展示了 `DataFilterBar` + TanStack Table + `EntityDrawer` 的组合，覆盖 Skeleton、Empty、Error、分页与抽屉详情。
- 【全栈】确定 API 错误与加载状态的展示模式：在 `docs/admin-web-ui-patterns.md` 记录 Skeleton + Empty + Toast 的用法，页面内结合 `react-error-boundary`、`EntityTable` 与 `sonner` toast 演示加载/错误处理。

### 4. 数据统计面板（预计 3 天）✅ 已完成

- 【后端】在 `apps/backend/src/modules/admin` 内新增 `admin-dashboard` 仓储、服务与控制器，提供 `GET /admin/dashboard/overview` 聚合接口，统一统计平台注册用户、服务人员数量、全量/周期净收益以及按日的订单与收益曲线（退款自动抵扣）。响应完全复用 `@repo/types` 中新增的 `AdminDashboardOverviewSchema` 并经过 Jest 契约测试校验。
- 【前端】`/dashboard` 页面改为以 Suspense + ErrorBoundary 包裹的 `DashboardOverviewSection`，利用 `@repo/hooks/api/ssr` 新增的 Query Hook 及 `@repo/web-ui` 的 Card/Chart/Skeleton 组件展示四个指标卡和可切换 7/30/90 天的折线图，新增导出 CSV（管理员权限校验）与一键刷新按钮。
- 【验证】补充 `admin-dashboard.service.spec.ts` 覆盖核心聚合逻辑与 Schema 契约解析，并在 Next App 端保持 SSR Prefetch + Hydration，配合 `preloadDashboardOverviewState` 确保页面可预取数据。

### 5. 用户管理模块（预计 3 天）✅ 已完成

- 【后端】对用户实体补齐分页查询、按用户名/角色/手机号筛选的 API（建议 `GET /admin/users`，复用 `@repo/types` 中的 `PaginationQuerySchema`）。支持冻结/解冻、角色调整的 PATCH 接口。
- 【前端】页面 `/users`：
  - 筛选区使用 `@repo/web-ui/form` + 受控组件；
  - 列表采用 `table` + `badge` 展示角色；
  - 行操作包含“查看详情（Drawer）”“禁用/启用”；
  - 支持导出 CSV/Excel（可复用 utils）。
- 【前端】整合详情抽屉，显示基础信息、订单统计等（通过并发请求聚合）。
- ✅ `/admin/users` API 与前端模块已落地：支持分页筛选、CSV/Excel 导出、详情抽屉、禁用/启用与角色调整。

### 6. 订单管理模块（预计 3~4 天）✅ 已完成

- 【后端】扩展 `order` 模块：
  - `GET /admin/orders` 支持订单编号、用户/服务人员姓名、状态、时间范围、金额区间等过滤器；
  - `GET /admin/orders/:id` 返回 `OrderDetailSchema`；
  - 视需要补充导出、状态修改接口。
- 【前端】`/orders` 页面：
  - 筛选器使用组合组件（日期区间、数字范围、选择器等）；
  - 列表支持自定义列显示/隐藏、状态颜色；
  - 详情页显示支付记录、地址、服务分类；
  - 常用批量操作（批量标记状态、导出）。
- ✅ `/admin/orders` 已上线分页筛选、订单详情以及单/批量状态流转；`/orders` 页面具备筛选器、列显隐、批量导出与详情抽屉。

### 7. 服务分类管理（预计 3 天）

- 【后端】扩展 `service`/`work-skill` 模块或创建 `service-category`：
  - 支持最多两级的父子分类 CRUD（Drizzle schema 需支持 `parentId` 及排序字段）；
  - 分类图标上传接口可复用 `files` 模块；
  - 返回结构要包含嵌套树与拍平列表。
- 【前端】`/service-categories`：
  - 左侧展示树形结构，右侧是详情/编辑表单；
  - 新增/编辑使用 `dialog` + 表单验证（`zod`）；
  - 图标上传组件复用 `@repo/web-ui/upload`（若未有则实现）。
- ✅ `/admin/service-categories` API 已提供树形 + 平铺结构、排序/图标字段及 CRUD，图标上传复用 files 模块并新增 Drizzle 迁移与单元测试。
- ✅ `/service-categories` 页面落地分类树、详情、批量手势与 Dialog 表单，使用 TanStack Form + Zod、`@repo/web-ui/upload` 完成图标上传及校验。

### 8. 平台收益变动记录（预计 2 天）✅ 已完成

- 【后端】在 `pay` 模块新增 `GET /admin/revenue-logs`，支持时间区间、交易类型、金额范围与收入方向筛选，返回结构复用 `@repo/types` 的收益流水 Schema，并通过仓储/Service 分层实现。
- 【前端】`/revenue-logs` 页面落地：包含筛选面板、TanStack Table 列表、导出 CSV、关联订单跳转及详情抽屉，金额方向以收入/支出颜色区分，支持 Suspense + ErrorBoundary + Skeleton。

### 9. 服务人员提现记录（预计 2 天）

- 🔄 **流程更新**：服务人员发起提现后仅冻结余额并记录提现意向，状态保持 `pending`，必须由管理员在后台审核（通过/驳回）。审核通过时才会触发实际打款与 `financial_transactions` 流水写入，驳回则解冻冻结余额并写入审核备注/原因。
- ✅ 【后端】扩展 `pay` 模块：`GET /admin/withdrawals` + `PATCH /admin/withdrawals/:id`（审核状态流转），包含支付宝打款、冻结余额释放与日志流水写入。
- ✅ 【前端】`/withdrawals` 页面（管理端）：
  - 支持时间范围、金额区间、状态、提现方式、关键词筛选并同步 URL；
  - 列表使用 TanStack Table + Suspense + Skeleton，展示服务人员、收款账户与审核信息；
  - 提供详情抽屉，内含审批备注编辑区以及“通过/驳回”确认对话框，打通接口后可即时刷新列表。

### 10. 验证、文档与交付（持续）

- 为每个模块补充 Swagger 注释与 e2e/单元测试，确保回归可自动化执行。
- 编写 `docs/admin-web/README` 或 Storybook 片段，记录组件用法。
- 整理部署与回滚流程：在 `docs/` 中更新部署手册，确保 `.env` 示例附带新的变量（如 `NEXT_PUBLIC_ADMIN_API_BASE_URL`）。
- 在 PR 阶段提供前端截图、后端接口样例响应，确保 QA 可复现。

## 验收输出

- 管理端具备完整登录、导航与 6 个核心业务页面，数据来自线上/测试 API 并可筛选。
- 新增后端接口通过 `pnpm test --filter=backend`、`pnpm lint`，前端通过 `pnpm test --filter=admin-web`（补充后）。
- `docs/admin-web-plan.md` 与后续 README/操作指南持续更新，供团队查阅。
