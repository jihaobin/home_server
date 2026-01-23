# Hooks Agents 指南

## 目标

- `@repo/hooks` 是跨端的“数据访问层”，优先放这里而不是在 app 内重复写请求。
- 管理端 SSR 相关 hooks 集中在 `src/api/ssr/`，并依赖应用端注入的 SSR apiClient。

## 目录速查

- 业务域 hooks：`packages/hooks/src/api/<domain>/index.ts`
- Admin SSR hooks：`packages/hooks/src/api/ssr/*`
- SSR apiClient 容器：`packages/hooks/src/api/ssr/client.ts`

## 约定（建议保持一致）

- Query：优先 `useSuspenseQuery`/`useSuspenseInfiniteQuery`，并设置 `meta.errorMessage` 供统一 toast。
- Mutation：在 `onSuccess` 内 invalidate 相关 queryKey（例如订单相关：`orders-list`、`staff-orders-list`、`order-detail`）。
- queryKey：使用稳定的字符串前缀 + 参数（示例见 `packages/hooks/src/api/order/index.ts`）。

## SSR（Admin Web）

- SSR 请求必须通过 `getSsrApiClient()`；应用端通过 `setSsrApiClient()` 注入（见 `packages/hooks/src/api/ssr/client.ts`）。
- Admin Web 侧需要在入口/预取器里调用：`ensureSsrApiClient()`（`apps/admin-web/src/lib/ssr-api-client.ts`）。

## 已知问题

- `packages/hooks/package.json` 声明了 `./api/notification` 导出，但当前缺少 `packages/hooks/src/api/notification/index.ts`；如需通知 hooks，请先补齐目录或修正 exports。
