# 部署前检查清单与方案

## 部署前检查清单

- 代码质量：已完成 `pnpm install && pnpm lint && pnpm type-check && pnpm test --filter=backend`（必要时补充前端/移动端测试）。
- 环境变量：`env/production/*.env` 已填充真实值，执行 `pnpm env:setup` 后校验 `apps/*/.env.production` 无占位与开发地址；对外域名、端口、跨域来源已匹配生产。
- 数据与存储：PostgreSQL（pgroonga）、Redis、对象存储（RustFS/MinIO 兼容）已就绪，备份目录与凭据隔离保存；首次部署前确认空库或完成数据迁移窗口。
- 证书与网络：获取正式域名与 TLS 证书；云防火墙/安全组仅放行 80/443，内网放行数据库/Redis；服务器时区、NTP、时钟同步正常。
- 日志与监控：确定日志落盘路径（如 `apps/backend/logs`）、轮转/清理策略，准备基础监控（CPU、内存、磁盘、接口 5xx）与告警通道。
- 迁移与回滚：Drizzle 迁移文件已确认；有数据库备份/快照；明确回滚流程（代码回滚 + DB 备份恢复）。
- 移动端依赖：推送、OAuth、地图、支付等移动端密钥已配置在 `.env.production`，并与对应包名/签名一致；如需发布原生安装包，预留 EAS/签名证书。

## 单机部署方案示例（systemd + Nginx，dingsm.com）

约定：

- 代码目录：`/home/admin/home_server`（保持仓库结构不变）
- 端口：后端 `5050`，管理端 `3000`（仅监听本机 `127.0.0.1`，由 Nginx 对外提供 `80/443`）
- 域名：`dingsm.com` / `www.dingsm.com`
- 第三方依赖（PostgreSQL/Redis/对象存储等）在同一台机器上

1. 准备运行环境
    - 安装 Node.js ≥18、pnpm ≥10。
    - 安装 Docker 与 Docker Compose，使用仓库根目录的 `docker-compose.yaml` 启动数据库/Redis/对象存储：

    ```bash
    cd /home/admin/home_server
    docker compose up -d
    ```

2. 获取代码与依赖

    ```bash
    cd /home/admin/home_server
    pnpm install --frozen-lockfile
    ```

3. 配置生产环境变量
    - 填写 `env/production/.env.api`、`.env.admin`、`.env.mobile`、`.env.common` 等文件。
    - 生成软链到各项目：`pnpm env:setup`。
    - 后端关键值（必须确认无误）：`NODE_ENV`、`PORT`、`TRUSTED_ORIGINS`、数据库/Redis/对象存储/支付等密钥。
        - 说明：后端启动时会读取 `TRUSTED_ORIGINS`，未设置会导致启动失败。
    - 管理端关键值（建议明确配置）：`NEXT_PUBLIC_BASE_PATH=/admin`（用于在 `https://dingsm.com/admin` 下部署管理端）。

4. 构建（发布时建议只构建需要的应用）

    ```bash
    pnpm --filter backend build
    pnpm --filter admin-web build
    ```

5. 数据库迁移

    ```bash
    dotenvx run -f apps/backend/.env.production -- pnpm --filter backend db:migration
    ```

6. systemd 服务单元（后端 + 管理端 + 营销站）

    - 后端服务：`/etc/systemd/system/home-server-backend.service`
    - 注意：`ExecStart=/usr/bin/node ...` 仅适用于系统包安装的 Node.js；如果你用 nvm 安装，请将 `ExecStart` 改为 `command -v node` 查到的绝对路径。

    ```ini
    [Unit]
    Description=home-server backend
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=admin
    WorkingDirectory=/home/admin/home_server/apps/backend
    EnvironmentFile=/home/admin/home_server/apps/backend/.env.production
    ExecStart=/usr/bin/node dist/main.js
    Restart=on-failure
    RestartSec=3

    [Install]
    WantedBy=multi-user.target
    ```

    - 管理端服务：`/etc/systemd/system/home-server-admin-web.service`
    - 注意：同上，若 Node.js 不在 `/usr/bin/node`，需要调整 `ExecStart` 为实际 node 路径。
    - 注意：本仓库使用 pnpm `node-linker=hoisted`，依赖安装在仓库根目录的 `node_modules`，因此不要写 `apps/admin-web/node_modules/...`。

    ```ini
    [Unit]
    Description=home-server admin web
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=admin
    WorkingDirectory=/home/admin/home_server/apps/admin-web
    EnvironmentFile=/home/admin/home_server/apps/admin-web/.env.production
    Environment=NODE_ENV=production
    Environment=PORT=3000
    ExecStart=/usr/bin/node /home/admin/home_server/node_modules/next/dist/bin/next start -p 3000
    Restart=on-failure
    RestartSec=3

    [Install]
    WantedBy=multi-user.target
    ```

    - 营销站服务：`/etc/systemd/system/home-server-marketing-web.service`
    - 注意：如果使用 fnm，请把 `Environment=PATH=...` 中的 `<NODE_VERSION>` 替换为实际版本（可通过 `fnm list` 或 `command -v node` 查看）。
    - 注意：同上，pnpm `node-linker=hoisted`，依赖在仓库根目录 `node_modules`。

    ```ini
    [Unit]
    Description=home-server marketing web
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=admin
    WorkingDirectory=/home/admin/home_server/apps/marketing-web
    EnvironmentFile=/home/admin/home_server/apps/marketing-web/.env.production
    Environment=NODE_ENV=production
    Environment=PORT=3010
    Environment=PATH=/home/admin/.local/share/fnm/node-<NODE_VERSION>/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
    ExecStart=/usr/bin/env node /home/admin/home_server/node_modules/next/dist/bin/next start -p 3010
    Restart=on-failure
    RestartSec=3

    [Install]
    WantedBy=multi-user.target
    ```

    - 启用并启动：

    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable --now home-server-backend home-server-admin-web home-server-marketing-web
    ```

    - 查看状态/日志：
        - `sudo systemctl status home-server-backend -l`
        - `sudo systemctl status home-server-admin-web -l`
        - `sudo systemctl status home-server-marketing-web -l`
        - `sudo journalctl -u home-server-backend -f`
        - `sudo journalctl -u home-server-admin-web -f`
        - `sudo journalctl -u home-server-marketing-web -f`

7. Nginx 反向代理与 HTTPS（待配置）

    - 目标：外网只暴露 `80/443`，内部端口为本机 `127.0.0.1:5050` 与 `127.0.0.1:3000`。
    - 路由约定（后续按实际需要落地 Nginx 配置）：
        - `https://dingsm.com/api/*` → `http://127.0.0.1:5050`
        - `https://dingsm.com/*` → `http://127.0.0.1:3000`
        - WebSocket：`/socket.io/*` 需要开启 upgrade
    - TLS 证书：建议使用 certbot/ACME 自动签发与续期。

8. 代码更新后的发布流程（建议）

    ```bash
    cd /home/admin/home_server
    git pull
    pnpm install --frozen-lockfile
    pnpm --filter backend build
    pnpm --filter admin-web build
    pnpm systemd:restart
    ```

    - 若只更新后端/管理端，也可用：
        - `pnpm systemd:restart:backend`
        - `pnpm systemd:restart:admin`
    - 快速看状态（已封装脚本）：`pnpm systemd:status`

9. 运维与备份
    - systemd 开机自启：通过 `systemctl enable --now ...` 已开启。
    - 设定数据库与对象存储的每日/每周备份；定期清理日志；上线前后观测 5xx、延迟和资源占用。

## 快速验证

- 本机检查（确认进程起来）：
  - 后端：`curl -i http://127.0.0.1:5050/api`（通常会返回 404，但能证明服务已监听并可响应）
  - 管理端：`curl -I http://127.0.0.1:3000`
- 域名检查（确认 Nginx 反代与证书）：
  - `curl -I https://dingsm.com/`
  - `curl -i https://dingsm.com/api`

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
