# Web UI Agents 指南

## 概览

- `@repo/web-ui` 为管理端/网页端提供组件库，风格偏 shadcn/ui + Radix + Tailwind 4。
- 通过 subpath exports 引入：`@repo/web-ui/components/*`、`@repo/web-ui/lib/*`、`@repo/web-ui/globals.css`。

## 去哪里改

- 组件：`packages/web-ui/src/components/*.tsx`
- 全局样式：`packages/web-ui/src/styles/globals.css`
- Upload 组件：`packages/web-ui/src/upload/index.tsx`

## 约定

- 加载态统一用 `@repo/web-ui/components/skeleton`（管理端规范见 `docs/admin-web-plan.md`）。
- 组件新增尽量保持和现有文件同粒度（一个组件一个文件）。
