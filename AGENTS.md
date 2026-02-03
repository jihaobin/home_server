# Home Server Monorepo AGENTS 知识库

Generated: 2026-01-23
Branch: main
Commit: 24e1b4e

## 语言

- 本仓库默认使用中文输出（文档/注释/沟通）。

## 概览

- Turborepo + pnpm workspace 的 TypeScript monorepo：NestJS 后端 + Next.js 管理端 + Expo 双端 App。
- 环境变量通过 `env/` 片段合并到各 app 的 `.env.*`（`pnpm env:setup`），运行时统一经由 `dotenvx` 注入。

## 结构

```
./
├── apps/
│   ├── backend/          # NestJS 11 API + Drizzle
│   ├── admin-web/        # Next.js (App Router) 管理端
│   ├── mobile-user/      # Expo Router 用户端
│   └── mobile-worker/    # Expo Router 服务人员端
├── packages/
│   ├── types/            # @repo/types：类型 + Zod Schema（跨端共享）
│   ├── utils/            # @repo/utils：低层 api-client
│   ├── lib/              # @repo/lib：http/auth/query client 等共享基础设施
│   ├── hooks/            # @repo/hooks：按域的 React Query hooks + SSR hooks
│   ├── web-ui/           # @repo/web-ui：Web 组件库（Tailwind 4 + shadcn 风格）
│   └── mobile-ui/        # @repo/mobile-ui：RN 组件库（NativeWind + rn-primitives）
├── env/                  # env 片段 + 合并脚本
├── docs/                 # 设计/迁移/排障文档
└── docker-compose.yaml   # 本地基础设施（Postgres+PostGIS+PGroonga/Redis/RustFS）
```

## 去哪里改

| 需求                | 入口                                      | 备注                                                             |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| 后端启动/全局中间件 | `apps/backend/src/main.ts`                | 全局前缀 `api`，better-auth 需要 raw body（`bodyParser: false`） |
| 数据库 Schema       | `apps/backend/src/common/database/schema` | Drizzle schema，字段倾向 `snake_case`                            |
| 数据库迁移          | `apps/backend/drizzle/`                   | `pnpm --filter backend db:generate` / `db:migration`             |
| 管理端路由          | `apps/admin-web/src/app`                  | Route Groups：`(auth)`/`(dashboard)`/`(management)`              |
| 管理端 SSR 预取     | `apps/admin-web/src/lib/prefetchers.ts`   | 必须 `ensureSsrApiClient()`，每次请求独立 QueryClient            |
| 移动端路由          | `apps/mobile-*/app`                       | Expo Router，根 Provider 在 `app/_layout.tsx`                    |
| 共享类型/Schema     | `packages/types/src`                      | 只改 `src/`，不要编辑 `dist/`                                    |
| 跨端 API hooks      | `packages/hooks/src/api`                  | 约定：queryKey + `meta.errorMessage` + invalidation              |
| 通知 WebSocket 方案 | `docs/notification-ws-migration.md`       | SSE 视为已弃用，统一走 socket.io                                 |
| 环境变量合并        | `env/scripts/setup-env-links.js`          | 生成各 app 的 `.env.development/.env.production`                 |

## 常用命令

```bash
pnpm install
pnpm env:setup
docker-compose up -d

pnpm dev
pnpm backend:dev
pnpm admin:dev
pnpm mobile-user:dev
pnpm mobile-worker:dev

pnpm lint
pnpm type-check
pnpm format:check
pnpm test --filter=backend
```

## 约定与差异

- 格式：`.editorconfig` 默认 `CRLF + 4 空格`；移动端（`apps/mobile-*`）由 Biome 统一为 `tab + 双引号`。
- React 版本：`pnpm-workspace.yaml` 使用 catalogs；Expo 用 `react19-1`，Admin Web 用 `react19-2`。
- Admin Web SSR：必须遵循 `docs/admin-web-ssr-guide.md`（`ensureSsrApiClient` + `prefetchDehydratedState` + `HydrateClient`）。

## 反模式（本仓库）

- 不要提交真实密钥/证书/`.env.*` 的敏感值（本地/CI 注入）。
- 管理端表单：按 `docs/admin-web-plan.md` 统一用 `@tanstack/react-form` + Zod；不要新写 `react-hook-form`。
- 移动端 NativeWind：动态切换 `shadow-*`/`opacity-*`/`bg-*/opacity` 等 className 可能触发导航上下文崩溃；动态样式用内联 `style`。

## 图片返回与占位（新增约定）

- 移动端需要展示的远程图片：后端优先直接下发“预签名 URL + BlurHash”，避免客户端额外请求 `/files/*`。
- 前端（Expo）：统一使用 `expo-image` 渲染远程图片，`placeholder={{ blurhash }}` 提供加载前占位。
- 若无法提供 blurhash（存量数据/非图片/生成失败），返回 `null`，前端不传 placeholder 即可。

## 提交与 PR

- 建议遵循 Conventional Commits（带 scope），例如：`feat(backend): add admin dashboard overview`。
- PR 至少包含：意图说明 + 关键验证命令（`pnpm lint`/`pnpm type-check`/相关 `pnpm test`）。

## 备注

- `docker-compose.yaml` 仅用于本地基础设施；其中可能包含默认凭据/开发用配置，不应直接用于生产环境。

## 子知识库

- Apps 总览：`apps/AGENTS.md`
- Packages 总览：`packages/AGENTS.md`
