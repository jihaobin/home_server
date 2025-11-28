# Next.js SSR + TanStack Query 集成指南

> 适用于 `apps/admin-web`，目标是在 Next.js App Router 中获得稳定的服务端渲染（SSR）体验，并保证后续页面能复用相同的查询与错误处理模式。

## 1. 集成概览

| 阶段 | 关键文件 | 责任 |
| --- | --- | --- |
| 客户端初始化 | `apps/admin-web/src/components/providers.tsx`、`apps/admin-web/src/lib/ssr-api-client.ts` | 创建 `QueryClient`，注入 `@repo/hooks/api/ssr` 所需的 API Client，挂载 `QueryClientProvider`、全局错误提示与主题。 |
| 服务端预取 | `apps/admin-web/src/lib/react-query-server.ts`、`apps/admin-web/src/lib/prefetchers.ts` | 使用 `prefetchDehydratedState`（内部封装 `createQueryClient + dehydrate`）收集数据并清理缓存。 |
| 客户端水合 | `apps/admin-web/src/components/hydrate-client.tsx` | 使用 `HydrationBoundary` 恢复服务端缓存，避免重复请求。 |
| 查询定义 | `packages/hooks/src/api/ssr` | 所有可用于 SSR 的查询/Hook（如管理员 Profile）必须放在该目录，其他端也可以直接使用。 |
| UI 展示 | `apps/admin-web/src/components/layout/admin-shell.tsx` | 通过 `Suspense` + `react-error-boundary` 渲染 TopBar、页面内容，确保加载与错误状态一致。 |

## 2. 初始化步骤

1. **统一 API Client**
   - `apps/admin-web/src/lib/api-client.ts` 会根据运行环境附加 `headers`/`credentials`。
   - 在任意需要 TanStack Query 的地方调用 `ensureSsrApiClient()`（定义于 `apps/admin-web/src/lib/ssr-api-client.ts`），该函数只在第一次调用时执行 `setSsrApiClient(apiClient)`，确保 `@repo/hooks/api/ssr` 可获取到正确的 `ApiClient`。

2. **QueryClientProvider**

   ```tsx
   // apps/admin-web/src/components/providers.tsx
   ensureSsrApiClient();
   const [queryClient] = useState(() => createQueryClient());
   return (
     <QueryClientProvider client={queryClient}>
       {/* RouteAnalyticsTracker, Toaster, Devtools 等 */}
     </QueryClientProvider>
   );
   ```

   `createQueryClient`（`@repo/lib/query-client`）预置了统一的重试策略、错误 Toast。保持 Provider 结构不变，即可自动继承。

3. **错误/加载状态**
   - `AdminShell` 使用 `QueryErrorResetBoundary` + `react-error-boundary` 包裹 `TopBar`，失败时展示“管理员信息加载失败”并允许重试。
   - 页面内容位于 `Suspense` 内，通过 `Skeleton` 展示加载态；如需更细粒度的错误边界，请在对应组件再包裹一层。

## 3. 服务端预取与水合

1. **预取助手**

   ```ts
   // apps/admin-web/src/lib/react-query-server.ts
   export async function prefetchDehydratedState(prefetcher) {
     const queryClient = createQueryClient();
     await prefetcher(queryClient);
     const dehydratedState = dehydrate(queryClient);
     queryClient.clear();
     return dehydratedState;
   }
   ```

   - 确保每个请求都使用独立的 `QueryClient`，防止缓存串联。
   - `queryClient.clear()` 避免长期占用内存。

2. **页面级预取器**
   以管理员 Shell 为例：

   ```ts
   // apps/admin-web/src/lib/prefetchers.ts
   ensureSsrApiClient();
   export function preloadAdminShellState() {
     return prefetchDehydratedState((queryClient) =>
       queryClient.prefetchQuery(adminProfileQueryOptions())
     );
   }
   ```

3. **布局中水合**

   ```tsx
   // apps/admin-web/src/app/(dashboard)/layout.tsx
   const dehydratedState = await preloadAdminShellState();
   return (
     <HydrateClient state={dehydratedState}>
       <AdminShell>{children}</AdminShell>
     </HydrationClient>
   );
   ```

   `HydrateClient` 只是安全封装的 `HydrationBoundary`，可以重复使用。

## 4. 新页面/模块集成指南

1. **在 `packages/hooks/src/api/ssr/` 定义查询**
   - 创建独立文件（例如 `packages/hooks/src/api/ssr/orders.ts`），导出 `queryOptions` 与 Hook（`useSuspenseQuery`/`useSuspenseInfiniteQuery`）。
   - 所有请求必须通过 `getSsrApiClient()` 调用 `apiClient.get/post`，保持与服务端环境兼容。

2. **加入预取器（可选，但推荐）**
   - 在 `apps/admin-web/src/lib/prefetchers.ts` 中添加一个导出函数，用于当前布局/页面所需的所有查询。
   - `prefetchQuery` 支持 `Promise.all` 并发，记得在需要顺序时使用 `fetchQuery`。

3. **在布局或页面中加载**
   - 对于共享布局（`(dashboard)`、`(management)`），直接调用新的 `preloadXXXState()` 并传给 `HydrateClient`。
   - 如果是单页面（例如 `/reports`），可以在 `page.tsx` 顶层 `async` 组件中执行预取，也可以新增局部 `HydrationBoundary`。

4. **错误与 Skeleton**
   - 遵循文档（`docs/admin-web-plan.md`）的要求：所有需要 API 数据的区域都需要有 `Suspense` fallback 与 Error Boundary。
   - 可以复用 `TopBarError` 的写法，或在页面内使用 `react-error-boundary` 提供的 `ErrorBoundary` 并结合 `QueryErrorResetBoundary`。

5. **请求瀑布治理**
   - 优先在预取阶段并行加载独立查询，避免客户端导航时出现瀑布。
   - 若存在依赖顺序的查询（例如先拿用户信息再请求订单），尽量把逻辑写在 `prefetcher` 内保证只在服务器发生一次。

## 5. 常见排错

| 现象 | 解决思路 |
| --- | --- |
| `[@repo/hooks/api/ssr] 未初始化 API 客户端` | 确认在页面/Provider/预取器执行前调用了 `ensureSsrApiClient()`。可以在入口或特定模块显式调用一次。 |
| 客户端重复请求同一数据 | 检查是否缺失 `HydrateClient` 或 `dehydratedState`；确保 `queryKey` 与预取时一致，并设置合适的 `staleTime`。 |
| 请求瀑布或交互卡顿 | 使用 `prefetchDehydratedState` 并在 `prefetcher` 内 `Promise.all` 并发执行。必要时在客户端二次导航中利用 Next.js 的 `prefetch`。 |
| 错误状态一直 Loading | 确保对应 UI 节点有 `ErrorBoundary`，并在 `fallbackRender` 中调用 `resetErrorBoundary` 或使用 `QueryErrorResetBoundary`。 |

## 6. 参考资料

- [TanStack Query: Server Rendering & Hydration Guide](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)
- [TanStack Query: Prefetching Guide](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)
- [TanStack Query: Request Waterfalls Guide](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls)

建议在实现新模块前快速复习上面三个官方指南，并对照本仓库中的 `prefetchDehydratedState`、`HydrateClient`、`packages/hooks/src/api/ssr/` 等文件，确保行为一致。
