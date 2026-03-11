# RustFS 登录与旧桶 AccessDenied 故障处理 Runbook

## 适用场景

本 Runbook 用于处理以下连续故障：

1. RustFS 控制台登录报错：`set_temp_user failed`
2. 登录恢复后，旧桶访问 `Access Denied`，但新建桶正常

环境前提：Windows + Docker Desktop + Docker Compose + RustFS（命名卷部署）。

## 故障现象与根因

### 阶段一：`set_temp_user failed`

- 现象：升级镜像后控制台登录失败，报 `set_temp_user failed`
- 根因：新镜像容器用户组调整为 `10001`，挂载目录权限不匹配
- 关键结论：命名卷比 Windows 盘符 bind mount 更稳定

### 阶段一修复步骤（`set_temp_user failed`）

以下命令在 PowerShell 下执行，适用于命名卷部署。

1. 停止服务并删除本地故障镜像（以 `alpha.71` 为例）

```powershell
docker compose down
docker image rm rustfs/rustfs:1.0.0-alpha.71
docker pull rustfs/rustfs:1.0.0-alpha.71
```

1. 修正 RustFS 数据卷权限为 `10001:10001`

```powershell
docker run --rm `
  -v home_server_home_server_rustfs_data:/data `
  -v home_server_home_server_rustfs_logs:/logs `
  alpine sh -c "chown -R 10001:10001 /data /logs && chmod -R ug+rwX /data /logs"
```

1. 启动并验证控制台登录

```powershell
docker compose up -d
docker compose logs --tail=100 home_server_rustfs_container
```

1. 浏览器验证：访问 `http://localhost:9001`，确认不再出现 `set_temp_user failed`

说明：

- 如果你的 compose 实际使用的是其他标签（如 `1.0.0-alpha.85`），上面镜像标签需对应替换。
- 如果是 Windows 盘符 bind mount（如 `E:\...:/data`），`chown` 可能不生效，建议迁移到命名卷后再执行本步骤。

### 阶段二：旧桶 `Access Denied`

- 现象：控制台/API 对旧桶 `Access Denied`，但新桶可正常读写
- 根因：旧桶元数据/策略状态异常（非 AK/SK 变更、非基础目录权限）
- 关键结论：在生产版本下直接修旧桶不稳定，最稳是“救援实例读取备份 -> 迁移到生产新桶”

## 最终采用方案（已验证可用）

1. 停生产并创建数据卷备份
2. 用备份卷启动旧版本 RustFS 救援实例
3. 生产实例创建全新目标桶
4. 用 `minio/mc mirror` 从救援实例迁移到生产新桶
5. 对新桶做读写删验证
6. 业务切换到新桶

## 一次性命令版（手工执行）

以下命令在 PowerShell 下执行。

### 0) 变量

```powershell
$SK = "你的RUSTFS_SECRET_KEY"
```

### 1) 停服务并备份卷

```powershell
docker compose down

docker volume create rustfs_data_backup
docker volume create rustfs_logs_backup

docker run --rm -v home_server_home_server_rustfs_data:/from -v rustfs_data_backup:/to alpine sh -c "cp -a /from/. /to/"
docker run --rm -v home_server_home_server_rustfs_logs:/from -v rustfs_logs_backup:/to alpine sh -c "cp -a /from/. /to/"
```

### 2) 启动生产实例

```powershell
docker compose up -d
```

### 3) 启动救援实例（读取备份卷）

```powershell
docker run -d --name rustfs_rescue_backup `
  -p 19000:9000 -p 19001:9001 `
  -v rustfs_data_backup:/data `
  -v rustfs_logs_backup:/logs `
  -e RUSTFS_ACCESS_KEY=root `
  -e RUSTFS_SECRET_KEY="$SK" `
  -e RUSTFS_CONSOLE_ENABLE=true `
  rustfs/rustfs:1.0.0-alpha.65
```

### 4) 初始化 mc 并配置双端点

```powershell
docker volume create mc_cfg
docker run --rm -v mc_cfg:/root/.mc minio/mc alias set prod http://host.docker.internal:9000 root "$SK"
docker run --rm -v mc_cfg:/root/.mc minio/mc alias set rescue http://host.docker.internal:19000 root "$SK"
```

### 5) 创建新桶并迁移

```powershell
docker run --rm -v mc_cfg:/root/.mc minio/mc mb --ignore-existing prod/files-live
docker run --rm -v mc_cfg:/root/.mc minio/mc mb --ignore-existing prod/chat-files-live

docker run --rm -v mc_cfg:/root/.mc minio/mc mirror --overwrite rescue/files prod/files-live
docker run --rm -v mc_cfg:/root/.mc minio/mc mirror --overwrite rescue/chat-files prod/chat-files-live
```

如果报目标桶 `Access Denied`，改用带时间戳的新桶名重试：

```powershell
$SUFFIX = Get-Date -Format "yyyyMMddHHmmss"

docker run --rm -v mc_cfg:/root/.mc minio/mc mb --ignore-existing prod/files-live-$SUFFIX
docker run --rm -v mc_cfg:/root/.mc minio/mc mb --ignore-existing prod/chat-files-live-$SUFFIX

docker run --rm -v mc_cfg:/root/.mc minio/mc mirror --overwrite rescue/files prod/files-live-$SUFFIX
docker run --rm -v mc_cfg:/root/.mc minio/mc mirror --overwrite rescue/chat-files prod/chat-files-live-$SUFFIX
```

### 6) 读写删验证（必须通过）

```powershell
docker run --rm -v mc_cfg:/root/.mc minio/mc cp /etc/hosts prod/files-live/__rwtest.txt
docker run --rm -v mc_cfg:/root/.mc minio/mc rm prod/files-live/__rwtest.txt

docker run --rm -v mc_cfg:/root/.mc minio/mc cp /etc/hosts prod/chat-files-live/__rwtest.txt
docker run --rm -v mc_cfg:/root/.mc minio/mc rm prod/chat-files-live/__rwtest.txt
```

### 7) 数据量校验

```powershell
docker run --rm -v mc_cfg:/root/.mc minio/mc ls --recursive --summarize rescue/files
docker run --rm -v mc_cfg:/root/.mc minio/mc ls --recursive --summarize prod/files-live

docker run --rm -v mc_cfg:/root/.mc minio/mc ls --recursive --summarize rescue/chat-files
docker run --rm -v mc_cfg:/root/.mc minio/mc ls --recursive --summarize prod/chat-files-live
```

### 8) 清理救援资源

```powershell
docker rm -f rustfs_rescue_backup
```

## 自动化脚本（推荐）

已沉淀脚本：`rustfs-recover-migrate.sh`

### 最简执行

```bash
RUSTFS_SECRET_KEY='你的SK' bash ./rustfs-recover-migrate.sh
```

### 避免桶名冲突（推荐）

```bash
RUSTFS_SECRET_KEY='你的SK' \
TARGET_SUFFIX="-$(date +%Y%m%d%H%M%S)" \
bash ./rustfs-recover-migrate.sh
```

### 自定义桶映射

```bash
RUSTFS_SECRET_KEY='你的SK' \
SOURCE_BUCKETS='files,chat-files' \
TARGET_BUCKETS='files-live,chat-files-live' \
bash ./rustfs-recover-migrate.sh
```

## 业务切换与回滚

### 切换

- 将业务桶名从 `files`、`chat-files` 切换到新桶（如 `files-live`、`chat-files-live`）
- 重启后端/网关使配置生效

### 回滚

- 将业务桶名改回旧桶
- 备份卷 `rustfs_data_backup*`、`rustfs_logs_backup*` 保留至少 7 天

## 经验与防复发建议

1. RustFS 升级前先做卷级备份并预演迁移
2. 对关键桶保持“同名新桶可切换”的预案，不在生产内强修异常旧桶
3. 统一使用命名卷，不使用 Windows 盘符 bind mount
4. 迁移后必须执行读写删验证，不只看控制台可登录
