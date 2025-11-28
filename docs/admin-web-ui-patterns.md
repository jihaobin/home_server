# 管理端 UI Skeleton / Error 模式

在 `apps/admin-web` 中，布局与数据展示均遵循统一的 Skeleton、Empty 与 Toast 规范，方便后续模块复用。本指南概述关键组件及其组合方式。

## 1. 通用组件

- **PageHeader**：统一页面标题、面包屑与操作区，位于 `apps/admin-web/src/components/common/page-header.tsx`。所有路由在进入模块前都渲染 `PageHeader`，可通过 `actions`、`meta`、`children` 插入自定义信息或工具条。
- **DataFilterBar**：位于 `common/data-filter-bar.tsx`，负责筛选表单布局，支持吸顶（`sticky`）、操作区、重置按钮与说明文字。与 `@repo/web-ui/form` 或 `@tanstack/react-form` 结合即可驱动真实数据。
- **EntityTable / EntityTablePagination**：封装 TanStack Table 的 Skeleton、Empty、Error、分页与空状态。通过 `table`、`isLoading`、`isError`、`onRetry` 等属性控制状态，`emptyState` 可自定义占位文案。
- **EntityDrawer**：基于 `@repo/web-ui/drawer` 的实体详情容器，包含 `EntityDrawerBody/Section/Property`，用于在任意列表中展示详情。

## 2. Skeleton + Empty + Toast

1. **加载态**  
   - 布局层（`AdminShell`）通过 `Suspense fallback` + `@repo/web-ui/skeleton` 渲染 TopBar、页面容器加载态。  
   - 列表类组件使用 `EntityTable` 的 `isLoading`，自动注入多行 Skeleton。

2. **错误态**  
   - 顶部 TopBar 已接入 `QueryErrorResetBoundary` + `react-error-boundary`，失败时展示 `TopBarError`。  
   - 业务列表调用 `EntityTable` 的 `isError` + `onRetry`，结合 `toast.error`（在 `Providers` 中通过 `setQueryClientErrorNotifier` 统一注册）呈现错误提示。

3. **空状态**  
   - `EntityTable` 默认在 `rows.length === 0` 时输出 `@repo/web-ui/empty`，可通过 `emptyState` 自定义描述与操作。  
   - 其他模块可直接使用 `Empty` 组件，在抽屉或图表区域显示“暂无数据”。

4. **示例**  
   `/users` 页面中的 `UsersPageContent`（`apps/admin-web/src/app/(management)/users/_components/users-page-content.tsx`）演示了完整组合：  
   - `DataFilterBar` 控制筛选项；  
   - `EntityTable` + `EntityTablePagination` 驱动 TanStack Table；  
   - `EntityDrawer` 展示行详情；  
   - `PageHeaderToolbar` + `toast` 按钮模拟刷新与错误，以 Skeleton + Empty + Toast 呈现全流程。

在接入真实 API 时，仅需将 `isLoading`/`isError` 与 TanStack Query 状态对齐，`EntityTable`/`DataFilterBar` 等组件即可复用，不需要重复编写骨架或错误界面。
