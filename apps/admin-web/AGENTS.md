# Admin Web Agents 指南

## 快速概览

- Next.js App Router（`src/app`），路由按 Route Groups 组织：`(auth)`/`(dashboard)`/`(management)`。
- 数据访问以 `@repo/hooks/api/ssr` 为范式：服务端预取 + 客户端水合（TanStack Query v5）。

## 去哪里看

- SSR apiClient：`apps/admin-web/src/lib/api-client.ts`
- SSR 注入（必做）：`apps/admin-web/src/lib/ssr-api-client.ts`
- 服务端预取：`apps/admin-web/src/lib/react-query-server.ts`
- 各页面预取器：`apps/admin-web/src/lib/prefetchers.ts`
- 管理员登录/会话：`apps/admin-web/src/lib/auth.ts`
- better-auth client（文件名有 typo）：`apps/admin-web/src/lib/auth-cient.ts`

## SSR + React Query 约定（强制）

- 新增可 SSR 的查询必须放在：`packages/hooks/src/api/ssr/`，并通过 `getSsrApiClient()` 发请求。
- 任意页面/预取器调用 SSR hooks 前，必须先调用：`ensureSsrApiClient()`（`apps/admin-web/src/lib/ssr-api-client.ts`）。
- 服务端预取使用：`prefetchDehydratedState`（`apps/admin-web/src/lib/react-query-server.ts`），每个请求创建独立 QueryClient 并 `clear()`。

## 表单/表格规范

- 表单：按 `docs/admin-web-plan.md` 使用 `@tanstack/react-form` + Zod；避免新增 `react-hook-form`。
- 列表：TanStack Table + `@repo/web-ui` 组件（Skeleton/Empty/Table/Form 等）。

## 常用命令

```bash
pnpm admin:dev
pnpm admin:build
pnpm admin:start
```
