# env/ 知识库

## 目标

- 通过合并 `env/<env>/.env.*` 片段，为每个 app 生成 `.env.development/.env.production`。

## 去哪里改

- 片段：`env/development/.env.*`、`env/production/.env.*`
- 合并脚本：`env/scripts/setup-env-links.js`
- 使用说明：`env/README.md`

## 使用

```bash
pnpm env:setup
```

当前映射在 `env/scripts/setup-env-links.js` 的 `ENV_CONFIG`：

- `apps/backend` → `.env.api + .env.common`
- `apps/admin-web` → `.env.admin + .env.common`
- `apps/mobile-user` → `.env.mobile + .env.mobile-user + .env.common`
- `apps/mobile-worker` → `.env.mobile + .env.mobile-worker + .env.common`
