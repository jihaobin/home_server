# packages/ 知识库

## 概览

- `packages/` 放跨 app 复用的类型、UI、hooks 与工程配置。
- 大多数包通过 `package.json#exports` 以 subpath 方式导出（按需引入）。

## 包速查

| 包                        | 用途                                    | 去哪里改                               |
| ------------------------- | --------------------------------------- | -------------------------------------- |
| `@repo/types`             | 跨端类型 + Zod Schema                   | `packages/types/src`（不要改 `dist/`） |
| `@repo/utils`             | 低层 api-client 等工具                  | `packages/utils/src`                   |
| `@repo/lib`               | http/auth/query client 等共享基础设施   | `packages/lib/src`                     |
| `@repo/hooks`             | 各业务域 React Query hooks + SSR hooks  | `packages/hooks/src/api`               |
| `@repo/web-ui`            | Web 组件库（Tailwind 4 + shadcn 风格）  | `packages/web-ui/src`                  |
| `@repo/mobile-ui`         | RN 组件库（NativeWind + rn-primitives） | `packages/mobile-ui/src`               |
| `@repo/eslint-config`     | workspace ESLint flat config            | `packages/eslint-config/*`             |
| `@repo/typescript-config` | TS preset                               | `packages/typescript-config/*`         |

## 子知识库

- Hooks：`packages/hooks/AGENTS.md`
- Web UI：`packages/web-ui/AGENTS.md`
- Mobile UI：`packages/mobile-ui/AGENTS.md`
- Types：`packages/types/AGENTS.md`
