# 故障排除指南

本文档记录了项目开发过程中遇到的常见问题及其解决方案。

## React Native / Expo 相关问题

### Invalid Hook Call 错误

**问题描述：**
在启动 React Native Expo 项目时出现以下错误：

```bash
ERROR Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.

ERROR Warning: TypeError: Cannot read property 'useMemo' of null
```

**根本原因：**
在 monorepo 环境中，pnpm 的依赖管理可能导致多个 React 副本同时存在，造成 Hook 调用冲突。

**解决方案：**

1. **更新根目录的 `.npmrc` 配置文件：**

   ```text
   node-linker=hoisted
   link-workspace-packages=true
   ```

2. **清理缓存并重新安装依赖：**

   ```bash
   # 清理 pnpm 缓存
   pnpm store prune

   # 删除 node_modules（可选，如果权限允许）
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

   # 重新安装依赖
   pnpm install
   ```

3. **重新启动项目：**

   ```bash
   cd apps/mobile-user
   pnpm run dev
   ```

**配置说明：**

- `shamefully-hoist=true`: 强制提升所有依赖到根目录
这个配置确保整个 monorepo 中只有一个 React 实例，避免了 Hook 调用冲突。

**注意事项：**

- 这个问题特别容易在使用 pnpm 的 monorepo 项目中出现
- 修改 `.npmrc` 后必须重新安装依赖才能生效

---

## 其他常见问题
