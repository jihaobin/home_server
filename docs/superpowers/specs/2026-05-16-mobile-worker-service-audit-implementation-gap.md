# 服务人员端审核流重构 — 实施差异审计

日期：2026-05-16
关联 spec：`2026-05-15-mobile-worker-service-audit-redesign.md`
范围：apps/mobile-worker 三页（我的服务 / 服务库 / 编辑服务）已完成首版实现，对照截图与 spec 发现若干偏离，本文记录差异、定位与改动建议，作为后续修复的输入。

## 1. 已实现的代码资产

### 1.1 页面文件

| 页面 | 文件 |
| --- | --- |
| 我的服务（cut-1） | `apps/mobile-worker/app/profile/service-settings-redesign.tsx` (266 行) |
| 服务库（cut-2） | `apps/mobile-worker/app/profile/service-settings-manage-redesign.tsx` (427 行) |
| 编辑服务（cut-3） | `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx` (~2520 行) |
| 状态/时间线模型 | `apps/mobile-worker/app/profile/service-settings-audit-model.ts` |

### 1.2 共享组件 / Hook

- `packages/mobile-ui/src/components/StatusBadge.tsx`
- `packages/mobile-ui/src/components/AuditStepBar.tsx`
- `packages/hooks/src/api/work-skill/index.ts`
  - L111 `useMyWorkerServices`
  - L219 `useSubmitServiceUpdate`（= `useUpdateServiceOfferings()`）
  - L300 `useWithdrawServiceDraft`
  - 缺：spec §`useUpdateActiveService`（非敏感字段直接 PATCH 主体）
  - 待确认：`useTakedownService` / `useDeleteService` 是否已暴露

### 1.3 状态模型常量

`service-settings-audit-model.ts`：

- `WorkerServiceTabKey = "active" | "pending" | "rejected" | "takendown"`
- `WORKER_SERVICE_TABS` 顺序：运营中 / 审核中 / 审核未通过 / 已下架
- `WorkerServiceAuditStepKey = "submitted" | "reviewing" | "result"`
- `WorkerServiceAuditStepState = "done" | "current" | "waiting" | "withdrawn"`
- 工具函数：`groupWorkerServicesByTab` / `getWorkerServiceTitle` / `getWorkerServiceStatusLabel` / `getWorkerServiceStatusTone` / `getWorkerServiceReason` / `formatAuditElapsed` / `hasSensitiveServiceChanges`

## 2. 与 spec 的差异（按页）

### 2.1 cut-1 我的服务

| spec 要求 | 实现现状 | 定位 |
| --- | --- | --- |
| 单一标题"我的服务" | 同时渲染"服务设置"大标题 + "我的服务"小副标题 | `service-settings-redesign.tsx:113`、`:117` |
| 顶部右上角"管理"文字按钮（多选/排序入口） | 顶部栏只有返回箭头 | 顶部栏代码无管理按钮 |
| 右下浮动 FAB `+ 新增` | 改为底部双吸底按钮 `+ 添加服务 / 管理服务` | `service-settings-redesign.tsx:189-200` |
| 卡片首行 `[icon] 服务名 [徽章]`（分类图标） | 缺少左侧分类图标 | `AuditServiceCard` 渲染 |
| 卡片次信息行 `分类 · 价格 · N 个规格` | 仅渲染 `categoryName` | 卡片次行 |
| 副条统一 `更新审核中 · 已提交 Xh　[查看进度]` | 副条文案 + 卡片底"已提交 X / 查看服务详情" 是两条独立行，文案非 spec 模板 | `:241` 副条 + 卡片末尾行 |
| 副条按状态着色（黄/红/灰） | 现统一红底 `bg-[#FEF2F2]`，未按 derivedStatus 区分 | 副条容器 |

### 2.2 cut-2 服务库

| spec 要求 | 实现现状 | 定位 |
| --- | --- | --- |
| 标题"从服务库添加" | `isAddMode ? "添加服务" : "管理服务"` 二选一 | `service-settings-manage-redesign.tsx:` 顶部栏 |
| 横向 chips：`全部 / 上门按摩 / 保洁 / 洗车 / 维修` | 仍为手风琴折叠分类（`expandedCategoryIds: Set<string>`） | `:151-200` `ServiceCategoryList` + `:281-` `ServiceCategoryCard` |
| 删除底部"点击服务可直接进入编辑页面…" 提示 | 仍存在 | `:132` |
| 卡片 `[图标] 名称 + 分类` 平铺 | 卡片在折叠分组内部，无图标 | `ServiceOptionRow` |
| 不展示商家级"已下架" | OK：本页只用 `useServiceList` 平台目录数据 | — |
| `+ 添加 / 已添加` 状态 | OK | `:412-425` |
| 废弃 `mode=manage` 路由分支 | 仍在使用 | `params.mode !== "manage"` 判断 |

### 2.3 cut-3 编辑服务

| spec 要求 | 实现现状 | 定位 |
| --- | --- | --- |
| 纯 `edit-active` (`active`)：仅状态徽章，不展开步骤条 | `buildServiceAuditNotice()` 默认分支对 `active` 也返回带 `steps` 的 notice → 头部强制渲染步骤条 | `:1654-1709`，特别是 `:1700-1709` 默认分支 |
| 头部分类行用"运营中"统一用语 | 仍写 `已启用 / 未启用` | `:2505` `buildCategoryLine` |
| `edit-active` 动态主按钮：默认 `保存修改`(disabled) → 仅非敏感 `保存修改` → 含敏感 `保存并提交审核` + 黄色提示条 + 二次确认 dialog | 主按钮固定：`editMode === "edit-pending" ? "撤回提交" : "提交审核"`；无"保存修改"分支、无黄色提示条、无二次确认 dialog | `:1108-1109` 主按钮 label；`:896-915` `saveService` 一律调 `submitServiceUpdate` |
| `edit-rejected` 主按钮"修改并重新提交" | 同样固定为"提交审核" | `:1108-1109` |
| `edit-takendown` 头部带 `[申诉] disabled` 按钮 | `buildServiceAuditNotice` 的 takendown 分支只有 title/message，无申诉按钮 | `:1663-1670` |
| `edit-takendown` 主按钮"修改并重新提交" | 也固定"提交审核" | `:1108-1109` |
| 危险操作区位于页面底部（自然滚动） | 在表单尾部，但与主 CTA 视觉上挤在一起 | `:1434-1465` 紧贴 `:1468-` 主 CTA |
| `edit-pending` / `edit-takendown` 不显示危险操作区 | OK | `:1105-1107` `canShowDangerActions = edit-active || edit-rejected` |
| `active_with_pending_update` 进入编辑时弹"继续编辑 / 放弃更新" | 仅有 draft 加载分支，无用户选择 dialog | `:406` 判定，无 dialog |
| 删除按钮二次确认 + 输入服务名 | OK | `:1492-1500` `DeleteConfirmDialog` |

### 2.4 跨页

- **吉祥物图标**：三页代码均无 `MascotIsland` 引用，截图也无，OK。
- **副状态视觉**：`运营中・有更新待审` spec 要求虚线边（`border-amber-200` + dashed），需检查 `StatusBadge` 是否支持 dashed variant。
- **后端接口对齐**：spec §`useUpdateActiveService` 走"非敏感字段直接 PATCH 主体"路径，目前实现一律走 `submitServiceUpdate` 创建草稿。需确认后端是否暴露主体直改接口；如未提供，需新增。

## 3. 改动建议（按优先级）

### P0 · 功能正确性

1. **编辑页头部步骤条只在审核相关态展开**
   - `buildServiceAuditNotice` 对纯 `active` 返回 `null`，移除默认 fallback 分支；纯运营中头部仅渲染 `StatusBadge`。
   - 文件：`service-settings-detail-redesign.tsx:1654-1709`

2. **`edit-active` 动态主按钮 + 黄色提示条 + 二次确认 dialog**
   - 派生：
     - `isDirty = baselinePayload != current`
     - `sensitiveDirty = hasSensitiveServiceChanges(...)`
     - `nonSensitiveDirty = isDirty && !sensitiveDirty`
   - 按 `editMode + dirty 派生状态` 决定 `label / action / disabled`：
     - `create` → `提交审核`
     - `edit-pending` → `撤回提交`（已实现）
     - `edit-active` 进入 → `保存修改`(disabled)
     - `edit-active` 仅非敏感 → `保存修改`，调用新增的 `useUpdateActiveService`，toast "已保存" 后 `router.back()`
     - `edit-active` 含敏感 → `保存并提交审核`，先弹二次确认 dialog（标题/正文按 spec §`edit-active` 模式：动态主按钮第 3 步），确认后调 `submitServiceUpdate`
     - `edit-rejected` / `edit-takendown` → `修改并重新提交`
   - 同时在表单顶部条件渲染黄色提示条："你修改了 [字段列表] 等内容，提交后将进入审核。审核期间，老版本继续对外运营。"（仅 `edit-active && sensitiveDirty` 时出现）
   - 文件：`service-settings-detail-redesign.tsx:1108-1116`、`:896-915`

3. **非敏感字段直接 PATCH 主体的 hook + 接口**
   - `packages/hooks/src/api/work-skill/index.ts` 新增 `useUpdateActiveService`（PATCH）
   - 后端：确认/新增 `PATCH /api/worker/services/{offeringId}`，仅接受 `serviceArea / availableSlots / defaultSpecId` 等非敏感字段
   - 与 `useSubmitServiceUpdate` 互斥使用

4. **`edit-takendown` 头部加申诉按钮（disabled）**
   - `buildServiceAuditNotice` 的 takendown 分支输出 `actions: [{ label: '申诉', disabled: true, hint: '敬请期待' }]`
   - notice 渲染层根据 `actions` 数组渲染按钮，点击 disabled 按钮 toast 提示
   - 文件：`service-settings-detail-redesign.tsx:1663-1670`、notice 渲染处

5. **`active_with_pending_update` 进入编辑前的"继续编辑/放弃更新"对话**
   - 在 `editableService` 加载完成、`derivedStatus === 'active_with_pending_update'` 且尚未确认时弹 Alert：
     - 继续编辑 → 加载 draft 快照（保持当前行为）
     - 放弃更新 → 切换 loadSource 为 `active`，加载主体内容
   - 文件：`service-settings-detail-redesign.tsx:406` 附近的 loadSource 选择逻辑

### P1 · 信息架构

6. **cut-1 顶部 / 底部重排**
   - 删"服务设置"大标题；"我的服务"提级为大标题（26px）
   - 顶部右上角加 `<Pressable>管理</Pressable>` 文字按钮（点击切换多选/排序态，本期可只占位）
   - 底部双吸底按钮整段删除，新增右下浮动 FAB `+ 新增` → `router.push('/profile/service-settings-manage-redesign')`（不再传 mode）
   - 文件：`service-settings-redesign.tsx:113-200`

7. **cut-2 改横向 chips + 平铺列表**
   - 顶部标题改"从服务库添加"
   - 删除 `expandedCategoryIds`、`ServiceCategoryCard` 折叠组件
   - 用横向 ScrollView 渲染 chips：`[全部] [上门按摩] [保洁] [洗车] [维修]`，状态在 `[selectedCategoryId, setSelectedCategoryId]`
   - 列表区直接渲染 `category.children` 的扁平数组（按 `selectedCategoryId` 过滤；`全部` 时合并所有分类的子项）
   - 删除 `:132` 底部"点击服务可直接进入编辑页面…"提示
   - 移除 `mode=manage` 分支
   - 文件：`service-settings-manage-redesign.tsx` 整体

### P2 · 视觉 / 文案

8. **`buildCategoryLine` 文案 `已启用/未启用` → 状态机用语**
   - 改为按 `derivedStatus` 输出 "运营中 / 审核中 / 审核未通过 / 已下架"
   - 文件：`service-settings-detail-redesign.tsx:2505`

9. **cut-1 卡片副条文案统一**
   - 副条模板按 spec §卡片基础结构：
     - `运营中・有更新待审` → 黄底 `更新审核中 · 已提交 Xh　查看进度`
     - `运营中・上次更新被驳回` → 红底 `上次更新被驳回：xxx　修改重提 →`
     - `审核未通过` → 红底 `驳回原因：xxx　修改重提 →`
     - `已下架` → 灰底 `下架原因：xxx　申诉 →`（disabled）
   - 卡片末尾"已提交 X / 查看服务详情"行可移除（信息已并入副条）
   - 文件：`service-settings-redesign.tsx` `AuditServiceCard`

10. **卡片左侧分类图标 + 多规格起价**
    - `AuditServiceCard` 首行追加 `[icon] 服务名 [徽章]`，图标颜色与状态联动
    - 次行 `分类 · 价格 · N 个规格`，价格归一化（单规格 `¥0.10`，多规格 `¥0.10 起`）

11. **`StatusBadge` 增加 amber-dashed 变体**
    - 用于 `active_with_pending_update` 副状态展示
    - 文件：`packages/mobile-ui/src/components/StatusBadge.tsx`

## 4. 备忘 / 约束

- WSL 环境下不要跑 `pnpm build` / 类型构建，验证类型用 `pnpm type-check`，build 由用户在 Windows 端处理。
- 申诉机制后端本期不实现，UI 仅占位。
- 通知沿用现有 `NotificationPublisher`，不新增 WebSocket。
- "审核 SLA 24h" 文案待后端配置返回，前端先沿用 hardcode，后续替换。

## 5. 推进顺序建议

1. P0-1 + P0-2（编辑页头部 + 主按钮）：用户体感最强烈，且能让 `edit-active` / `edit-rejected` / `edit-takendown` 三种模式真正按 spec 区分。(已完成)
2. P0-3 接口/hook：作为 P0-2 落地的前置依赖。
3. P0-4 + P0-5：补齐 takendown 申诉占位 + active_with_pending_update 选择对话。
4. P1-6 + P1-7：信息架构对齐，外观接近最终态。
5. P2 收尾。
