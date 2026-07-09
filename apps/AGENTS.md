# apps/ 知识库

## 概览

- `apps/` 放可部署/可运行的应用：后端 API、管理端 Web、介绍页 Web、用户/服务人员移动端。

## 入口速查

| 应用          | 入口                                 | 运行                     |
| ------------- | ------------------------------------ | ------------------------ |
| backend       | `apps/backend/src/main.ts`           | `pnpm backend:dev`       |
| admin-web     | `apps/admin-web/src/app`             | `pnpm admin:dev`         |
| marketing-web | `apps/marketing-web/src/app`         | `pnpm marketing:dev`     |
| mobile-user   | `apps/mobile-user/app/_layout.tsx`   | `pnpm mobile-user:dev`   |
| mobile-worker | `apps/mobile-worker/app/_layout.tsx` | `pnpm mobile-worker:dev` |

## 约定

- 所有 app 的 `.env.development/.env.production` 由 `pnpm run env:setup` 生成（来源 `env/*`）。
- Admin Web：SSR 预取/水合固定模板（见 `docs/admin-web-ssr-guide.md`）。
- Mobile：Expo Router 文件系统路由；Provider 统一在 `app/_layout.tsx`。

## 子知识库

- Backend：`apps/backend/AGENTS.md`
- Admin Web：`apps/admin-web/AGENTS.md`
- Mobile User：`apps/mobile-user/AGENTS.md`
- Mobile Worker：`apps/mobile-worker/AGENTS.md`
