# 移动端应用内更新方案（用户端 & 服务人员端）

## 背景与目标

- 现有移动端（`apps/mobile-user`、`apps/mobile-worker`）缺少应用内更新能力，发布新版 APK 需手工分发。
- 目标：在后台管理端完成版本管理（上传/发布/回滚/下载），由后端统一落盘 RustFS，并为客户端提供强制/非强制更新检查接口与直连下载。

## 功能清单（含补充）

1. 管理端可上传新版本 APK，查看历史版本并下载旧版本（支持直接浏览器下载）。
2. 版本号采用标准 `x.y.z` 语义化校验，限制同一 `app + platform` 下的唯一性。
3. 可配置是否强制更新；补充 `minSupportedVersion`（低于该版本直接视为强更）、`releaseStatus`（draft/published/rollback）。
4. 上传 APK 保存至 RustFS 对象存储，路径规范：`apk/{appName}/{version}/{appName}-{version}.apk`，桶名建议独立为 `app-releases`（或通过 env 配置）。
5. 管理端列表展示所有版本的下载链接，点击后生成短期预签名 URL 并触发浏览器下载。
6. 补充：记录 `changelog`（展示给客户端的更新文案）、`fileHash`/`fileSize` 用于校验、`createdBy`/`publishedBy` 便于审计；支持“撤回/回滚”到上一已发布版本。
7. 补充：下载/更新埋点（下载次数、强更拦截次数），便于统计灰度效果；预留灰度发布参数（如 `rolloutPercent` 或 `channel=staging/production`）。

## 数据模型与存储

- 新表 `app_releases`（Drizzle + `packages/types` 同步），去除冗余的存储字段，核心字段：
  - 基本信息：`id`、`app`（`mobile-user`/`mobile-worker`）、`platform`（`android`/`ios`）、`version`（semver）、`buildNumber?`
  - 状态：`forceUpdate`、`minSupportedVersion?`、`releaseStatus`（`draft`/`published`/`rollbacked`）、`isActive`
  - 元信息：`changelog?`、`downloadUrlOverride?`（iOS 外链/TestFlight 等）
  - 关联文件：`fileId`（FK -> `files.id`，复用 `files` 表中的 `bucket/objectPath/fileSize/fileHash`，避免重复列）
  - 审计：`createdBy`、`publishedBy?`、`publishedAt?`、`rollbackFromId?`、`createdAt/updatedAt`
  - 索引：唯一索引 `app + platform + version`；组合索引 `app + platform + isActive + releaseStatus` 用于快速查找当前生效版本。
- 对象存储：沿用 `S3StoreServer`，新增可指定对象路径的上传入口，或在 `FilesService` 增加“自定义 objectPath + bucket”模式以符合 `apk/{app}/{version}/` 目录要求。
- 校验：上传时计算 `sha256`；版本号用 `semver` 库校验并做唯一索引（`app + platform + version`）。

## 后端接口设计

- 管理端（全部需 `AdminSessionMiddleware`）：
  - `POST /admin/app-releases`（multipart）：字段 `app`、`platform`、`version`、`forceUpdate`、`minSupportedVersion?`、`changelog?`、`status=draft|published`、`file`. 上传后落盘 RustFS 并返回 `fileHash/fileSize/downloadUrl`.
  - `GET /admin/app-releases`：筛选 `app/platform/status`，默认按发布时间倒序，返回预签名下载 URL（TTL 可配置，例如 10 分钟）。
  - `GET /admin/app-releases/:id`：详情含文件信息、审计记录。
  - `PATCH /admin/app-releases/:id`：修改 `forceUpdate/minSupportedVersion/changelog/status`；若从 draft → published 需记录 `publishedBy/At`。
  - `POST /admin/app-releases/:id/rollback`：将指定版本标记为 rollbacked，并自动激活上一版本。
- 客户端公开接口（无需登录）：
  - `GET /app-updates/check?app=mobile-user&platform=android&currentVersion=1.0.0` 返回：`latestVersion`、`forceUpdate`、`minSupportedVersion`、`downloadUrl`（预签名）、`changelog`、`size`、`hash`、`rollbackHint`。
  - 强制判定：`currentVersion < minSupportedVersion` 或 `forceUpdate=true` 时返回 `requireUpdate=true`；否则 `optionalUpdate=true`。
- 下载：生成 `Content-Disposition: attachment` 的直链下载，或返回预签名 URL 让前端直接跳转；记录访问计数。
  - 公开长链：`GET /file/apk/:app`（免鉴权）始终 302 到当前 is_active=true 的最新 Android 版本；若最新版本被标记为 is_active=false 则自动回退到上一可用版本，不存在则返回 404。

## 管理端 UI 方案（Next.js `apps/admin-web`）

- 新增菜单「应用版本管理」，路径建议 `/management/app-releases`。
- 页面组成：
  - 列表：列出 `app`、`platform`、`version`、`status`、`forceUpdate`、`minSupportedVersion`、`文件大小`、`上传/发布时间`、`下载`、`操作`。
  - 筛选：按 `app/platform/status`、上传时间范围。
  - 上传/发布表单：`Upload` 组件 + 表单字段（版本号校验、强更开关、最低兼容版本、更新说明）。支持「上传即发布」或先存草稿。
  - 交互：点击「下载」直接打开预签名链接；提供「复制链接」「回滚/撤回」「设为强更」等操作。
- 复用能力：表单/表格沿用 `@repo/web-ui` + TanStack Table，数据 Hook 放在 `packages/hooks/src/api/app-release`，类型放入 `@repo/types`.

## 客户端接入建议（Expo React Native）

- 公共逻辑：在 `@repo/hooks` 增加 `useCheckAppUpdate(app, platform)`，封装 `GET /app-updates/check` 请求与 semver 对比。
- 触发时机：应用启动、从前后台恢复、设置页「检查更新」按钮；非强更时可在会话周期内缓存一次提示（`react-query` + `mmkv` 标记）。
- 弹窗与交互：统一用 Modal 展示版本号 + 更新日志 + 文件大小，下方「立即更新」「取消」。强制更新时隐藏「取消」且不可关闭 Modal/返回上一页。
- 组件封装：抽象公共组件与 Hook（如 `UpdateModal` + `useAppUpdateController`），集中管理检查结果、Modal 状态、忽略标记与强更拦截；在 `@repo/mobile-ui` 封装可复用的 Modal、按钮与进度条，user/worker 端共用。
- 下载与安装（Android）：点击「立即更新」即用 `expo-file-system` 下载 APK 至本地，进度条实时展示（`DownloadResumable` progress callback）；下载完成后直接调用 `IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: 'file://...', flags: FLAG_GRANT_READ_URI_PERMISSION, type: 'application/vnd.android.package-archive' })` 触发安装覆盖旧版本。强更下禁止退出，仅允许继续下载或重试。(具体方案参考我与chatgpt的对话：<https://chatgpt.com/share/695c8281-42e4-8001-9532-a459ba9ee4a8>)
- iOS：如暂无自签分发，可返回 App Store 链接或 TestFlight 链接（`downloadUrlOverride`）。

## 风险与补充

- 安全：下载链接使用短期预签名 + https；校验 `sha256`，避免被替换；限制上传大小/类型仅允许 `.apk`。
- 监控与审计：记录上传/发布/回滚操作日志；下载/更新次数写入指标，方便看板。
- 清理：定时任务扫描 `app_releases` 标记为 rollbacked 且时间超过 N 天的版本，按需删除 RustFS 对象。
- 环境变量：新增 `S3_APP_RELEASE_BUCKET`、`APP_UPDATE_PRESIGN_TTL`、`APP_UPDATE_BASE_URL`（如需要拼直链）。
- 测试：Jest 覆盖版本排序、强制更新判定、唯一性校验；E2E 验证上传 → 发布 → 客户端检查 → 下载链路。

## 落地任务拆解

- [x] Drizzle 迁移 + `app_releases` Repository/Service（含唯一索引与 semver 校验）。
- [x] 后端接口实现（admin + 公共 check），集成 RustFS 上传/预签名，补充单元测试。
- [x] `@repo/types` / `@repo/hooks` / `@repo/utils` 增加对应类型与 API Client。
- [x] 管理端页面 `/management/app-releases`，含上传、列表、回滚与下载。
- [x] 客户端接入：公共 Hook + 统一 Modal/进度条组件 + 下载落盘并自动安装流程（user & worker 同步）。
- [ ] 文档与环境变量示例更新，部署时验证桶策略与凭证。
