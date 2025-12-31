# 部署前检查清单与方案

## 部署前检查清单

- 代码质量：已完成 `pnpm install && pnpm lint && pnpm type-check && pnpm test --filter=backend`（必要时补充前端/移动端测试）。
- 环境变量：`env/production/*.env` 已填充真实值，执行 `pnpm env:setup` 后校验 `apps/*/.env.production` 无占位与开发地址；对外域名、端口、跨域来源已匹配生产。
- 数据与存储：PostgreSQL（pgroonga）、Redis、对象存储（RustFS/MinIO 兼容）已就绪，备份目录与凭据隔离保存；首次部署前确认空库或完成数据迁移窗口。
- 证书与网络：获取正式域名与 TLS 证书；云防火墙/安全组仅放行 80/443，内网放行数据库/Redis；服务器时区、NTP、时钟同步正常。
- 日志与监控：确定日志落盘路径（如 `apps/backend/logs`）、轮转/清理策略，准备基础监控（CPU、内存、磁盘、接口 5xx）与告警通道。
- 迁移与回滚：Drizzle 迁移文件已确认；有数据库备份/快照；明确回滚流程（代码回滚 + DB 备份恢复）。
- 移动端依赖：推送、OAuth、地图、支付等移动端密钥已配置在 `.env.production`，并与对应包名/签名一致；如需发布原生安装包，预留 EAS/签名证书。

## 单机部署方案示例（后台 + Admin + 移动端 Web 版）

1. 准备运行环境
    - 安装 Node.js ≥18、pnpm ≥10。
    - 安装 Docker 与 Docker Compose，使用仓库根目录的 `docker-compose.yaml` 启动数据库/Redis/对象存储：

    ```bash
    docker compose up -d
    ```

    - 挂载路径和密码根据云主机目录及安全要求调整。
2. 获取代码与依赖

    ```bash
    git clone <repo-url> && cd home_server
    pnpm install
    ```

3. 配置生产环境变量
    - 填写 `env/production/.env.api`、`.env.admin`、`.env.mobile`、`.env.common` 等文件。
    - 生成软链到各项目：`pnpm env:setup`。
    - 校验关键值：`DATABASE_URI`、`REDIS_CLIENT_HOST/PORT/DB`、`BETTER_AUTH_SECRET`、`TRUSTED_ORIGINS`、`NEXT_PUBLIC_API_URL`、对象存储/支付/推送密钥等。
4. 构建

    ```bash
    pnpm build
    ```

    仅构建单个应用可用 `pnpm backend:build`、`pnpm admin:build`、`pnpm --filter mobile-user build`、`pnpm --filter mobile-worker build`。
5. 数据库迁移

    ```bash
    dotenvx run -f apps/backend/.env.production -- pnpm --filter backend db:migration
    ```

6. 以 PM2 常驻进程方式启动（示例端口：API 5050，Admin 3000）

    ```bash
    pnpm dlx pm2 start "pnpm backend:start" --name backend --time
    pnpm dlx pm2 start "pnpm admin:start" --name admin-web --time --env PORT=3000
    ```

    - 查看：`pnpm dlx pm2 ls`，日志：`pnpm dlx pm2 logs backend`。
    - 如使用 systemd，可将上述命令替换为相应服务单元。
7. 部署移动端 Web 版本（静态托管）

    ```bash
    pnpm --filter mobile-user build
    pnpm --filter mobile-worker build
    pnpm dlx serve -s apps/mobile-user/dist -l 8081
    pnpm dlx serve -s apps/mobile-worker/dist -l 8082
    ```

    - 若需原生包，请用 EAS/CI 生成 APK/IPA 并按渠道分发；上述为 Web 导出方案，便于统一在服务器托管。
8. 反向代理与 HTTPS（Nginx 示意）
    - `api.example.com` 反代 `http://127.0.0.1:5050`，开启 WebSocket；
    - `admin.example.com` 反代 `http://127.0.0.1:3000`；
    - `user.example.com` / `worker.example.com` 指向静态目录或 8081/8082。
    - 使用 certbot/ACME 自动续期证书。
9. 运维与备份
    - 启用 PM2 开机自启：`pnpm dlx pm2 startup && pnpm dlx pm2 save`。
    - 设定数据库与对象存储的每日/每周备份；定期清理日志与镜像；上线前后观测 5xx、延迟和资源占用。

## 快速验证

- API 健康检查：`curl https://api.example.com/health` 返回 200。
- Admin 页面可正常登录，静态站点可加载并能调用生产接口。
- 移动端推送/支付/地图等关键链路在生产配置下可打通。

## App 端部署方案

- 前置：在 `env/production/.env.mobile` 填好正式的 API 域名、推送/地图/支付等密钥，并运行 `pnpm env:setup`。
- Web 版（静态托管，快速上线）：
  - 构建：`pnpm --filter mobile-user build`、`pnpm --filter mobile-worker build`。
  - 部署：将 `apps/mobile-user/dist`、`apps/mobile-worker/dist` 作为静态站点托管（可用 Nginx 静态目录或 `pnpm dlx serve -s ...`），域名与 HTTPS 由 Nginx/证书提供。
- 原生 Android（自托管打包）：
  - 环境：安装 Android SDK/NDK，准备 `keystore` 与签名信息。
  - 构建：`pnpm --filter mobile-user build:android`（worker 端同理），产物为 APK/AAB，可上传企业分发/内测渠道。
  - 要点：包名、签名与推送/支付配置一致，应用内的 API 域名指向生产。
- 原生 iOS（推荐 CI/EAS）：
  - 准备 Apple 开发者账号、证书/描述文件，在 CI/EAS 注入 `.env.production`。
  - 使用 EAS/CI 生成 IPA（示例：`eas build --platform ios`，需按 Expo 文档添加配置），通过 TestFlight/企业分发发布。
- 生产验收：登录、下单/派单、支付、推送（含 worker 端）、定位链路在生产环境全量打通后再全量发布；如需灰度，可先发布内测白名单。
