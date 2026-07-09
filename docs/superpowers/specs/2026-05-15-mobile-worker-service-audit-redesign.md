# 服务人员端 服务发布与审核流可视化重构

日期：2026-05-15
范围：apps/mobile-worker 三个核心页面（服务设置 / 添加服务 / 编辑服务）+ 接口聚合层
关联 spec：`2026-05-13-service-offering-review-takedown-design.md`（后端审核与下架基础能力）

## 背景

2026-05-13 已完成"服务发布审核 + 管理员下架"的后端能力（草稿表 `service_personnel_offering_drafts` + 状态表 `service_personnel_offering_statuses` + 管理端审核入口）。该能力上线后，移动端的服务发布相关三页（cut1 服务设置 / cut2 添加服务 / cut3 编辑服务）出现以下问题：

1. **状态系统呈现混乱**：审核中、审核未通过、已下架三种状态在不同页面以不同方式（baner / 标签 / 红色文本）呈现，用户拼不出整体状态机心智。
2. **信息架构矛盾**：服务设置页标题写"已启用服务"却混入"已下架"项；添加服务页又把"已下架"塞进可添加目录。
3. **编辑/审核语义模糊**：编辑页底部统一为"提交审核"，用户不知道改任意字段是否都触发审核；缺乏对"审核期间老版本是否继续运营"的明确告知。
4. **缺少时间线信息**：用户不知道"提交了多久"、"还要等多久"、"什么时候被驳回的"。
5. **删除按钮位于顶部右上角**，与返回箭头距离过近，存在误触风险。

本期不重做后端状态机，目标是在已有后端能力之上建立**前端的状态可视化语言**和**编辑页的双轨提交模式**，让服务人员能直观地理解和操作服务的全生命周期。

## 与既有 spec 的关系

`2026-05-13-service-offering-review-takedown-design.md` 在文字描述上写过"同一服务人员同一时间只允许存在一个 pending 审核稿"，但实际 schema（`service_personnel_offering_drafts` 表上的 `uniq_service_offering_drafts_pending_personnel_service` 唯一索引）建立在 `(personnelUserId, serviceId)` 复合键上，因此**真实的草稿粒度是"每个服务最多 1 个 pending draft"**，不是"每个人员最多 1 个"。本 spec 以 schema 为准，所有设计基于"按服务粒度的双轨"模型。

## 目标

1. 建立服务人员端可识别、跨页一致的 4 态状态机视觉语言。
2. 提供清晰的审核进度可视化，让用户知道"提交了多久 / 当前进展 / 预计何时出结果"。
3. 编辑运营中服务时实现"双轨保护"：审核期间老版本继续对外运营，消费端无感知。
4. 通过状态 Tab 化解决"列表混杂多状态"的信息架构矛盾。
5. 为申诉机制保留 UI 占位（按钮 disabled + 提示文案），便于后续会话追加后端实现。

## 非目标

- 不实现申诉机制的后端逻辑和申诉对话历史，仅保留 UI 占位。
- 不改造管理端审核页面（独立项目）。
- 不引入 WebSocket 实时推送（消息中心通知本期已可承载结果通知）。
- 不修改用户端服务发现链路（沿用 2026-05-13 spec 的过滤规则）。
- 不引入"草稿（未提交）"形态：只有提交后的 draft，没有"本地保存"的中间态。

## 核心状态语言

### 4 态 + 2 副态

服务人员看到的服务状态由"主体 publicationStatus + 当前 draft.status"派生而来，前端呈现 4 个主状态 + 2 个副状态。副状态归属于主状态的 Tab，但卡片上挂明显的副条提示：

| 前端状态 | 归属 Tab | 后端表达 | 含义 | 用户可执行动作 |
| --- | --- | --- | --- | --- |
| `审核中` | 审核中 | 无主体 + 1 条 `pending` draft | 新服务首次提交，排队审核 | 撤回提交 |
| `运营中` | 运营中 | 主体 `active` + 无 draft（或仅有 `approved` draft） | 已上架且无变更 | 编辑（任何字段）、主动下架、删除 |
| `运营中・有更新待审`（副） | 运营中 | 主体 `active` + 1 条 `pending` draft | 老版本继续对外，新版本审核中 | 查看更新内容、撤回更新、再次编辑（覆盖草稿） |
| `运营中・上次更新被驳回`（副） | 运营中 | 主体 `active` + 最近 draft `rejected` | 老版本继续对外，最近一次更新被驳回 | 查看驳回原因、修改重提 |
| `审核未通过` | 审核未通过 | 无主体 + 最近 draft `rejected` | 新服务首次提交被驳回，无线上版本 | 查看驳回原因、修改重提 |
| `已下架` | 已下架 | 主体 `taken_down` | 平台处罚下架 | 查看下架原因、申诉（占位）、修改重提 |

Tab 数量徽标按归属 Tab 累加：`运营中 Tab` 数量 = 纯运营中 + 运营中·有更新待审 + 运营中·上次更新被驳回 三类卡片之和。

### 状态转移图

```
[新建] ──提交──▶ 审核中 ──通过──▶ 运营中
                  │
                  └──驳回──▶ 审核未通过 ──修改重提──▶ 审核中

运营中 ──编辑敏感字段──▶ 运营中・有更新待审 (老版本继续运营)
   ├──新版本通过──▶ 运营中（新版本替换）
   └──新版本驳回──▶ 运营中（老版本继续）+ 顶部提示"上次更新被驳回"
                └──修改重提──▶ 运营中・有更新待审

运营中 ──编辑非敏感字段──▶ 运营中（直接生效，不进审核）

运营中 ──平台下架──▶ 已下架 ──修改重提──▶ 审核中
                └──申诉(UI 占位)──▶ ...
```

### 关键澄清

- 一个服务最多同时存在 1 条 active draft（schema 唯一索引保证）。再次编辑同一服务时，UI 提示"将覆盖未审核的更新"，确认后替换草稿内容。
- 驳回不影响线上：被驳回的更新只是变成"待修改的草稿"，运营中状态不动，老版本继续对外。
- 编辑运营中服务时区分敏感/非敏感字段，由前端在脏检查阶段判断，决定主按钮文案与提交路径。

### 敏感字段定义

触发审核的字段（保存时创建/更新 draft，主体不变）：

- 服务名称
- 服务分类
- 服务简介
- 服务图片
- 服务规格（含价格、币种、时长）

非敏感字段（保存即生效，直接更新主体）：

- 服务区域
- 可预约时段
- 默认规格选择

## 信息架构

### 3 页结构

```
[我的服务] (主页) ─── [服务库] (从平台目录添加新服务)
   │
   └── [编辑服务] (新建/编辑/查看单个服务，5 种模式)
```

### 页 A：我的服务（替代 cut1 + 现有 manage 页）

- 顶部栏：返回、标题"我的服务"、右上角"管理"（多选/排序进入态）。
- 状态 Tab：`运营中 N` / `审核中 N` / `审核未通过 N` / `已下架 N`，仅 N>0 的 Tab 显示数量徽标。默认停在"运营中"。
- 列表区：当前 Tab 的服务卡片列表；空时展示插画 + "去服务库挑选服务"。
- 右下浮动 FAB：`+ 新增` → 跳转服务库页。
- **吉祥物图标移除**：原本三页都漂浮的小岛图标在主业务页面不再出现。

### 页 B：服务库（替代 cut2）

- 顶部栏：返回、标题"从服务库添加"。
- 搜索框：搜索服务名称。
- 横向 chips 分类切换：`全部 / 上门按摩 / 保洁 / 洗车 / 维修`（替代当前的手风琴折叠分类）。
- 服务卡片列表：每张卡显示分类图标、服务名、所属分类。
- 右侧操作：未添加显示 `+ 添加`；已添加显示置灰"已添加"。
- 删除当前 cut2 顶部的"待审核"全局 banner 和底部"点击服务可直接进入编辑页面…"提示。
- **服务库不展示"已下架"状态** —— 那是商家自己的状态，与平台目录无关。这是当前 cut2 的核心错误。

### 页 C：编辑服务（替代 cut3）

单一壳，5 种模式由路由参数 `?mode=` 切换。详见下一节。

### 导航流

```
[我的服务] ──tab──▶ [运营中卡片] ──tap──▶ [编辑(edit-active)]
    │
    ├──FAB──▶ [服务库] ──+添加──▶ [编辑(create)]
    │
    └──tab──▶ [审核中卡片]    ──tap──▶ [编辑(edit-pending)]
              [审核未通过卡片] ──tap──▶ [编辑(edit-rejected)]
              [已下架卡片]    ──tap──▶ [编辑(edit-takendown)]
```

## 卡片与可视化规范

### 状态徽章组件

统一组件 `<StatusBadge status={...} />`，跨页一致。颜色用浅底 + 深字 + 1px 边，圆角 6px，字号 12px：

| 状态 | 颜色（Tailwind/NativeWind） | 图标 |
| --- | --- | --- |
| 运营中 | `bg-green-50 text-green-700 border-green-200` | 圆点 |
| 审核中 | `bg-amber-50 text-amber-700 border-amber-200` | 转圈图标 |
| 审核未通过 | `bg-red-50 text-red-700 border-red-200` | 警告图标 |
| 已下架 | `bg-gray-100 text-gray-600 border-gray-300` | 锁/禁止图标 |
| 副：更新审核中 | `bg-amber-50 text-amber-600 border-amber-200`（虚线边） | 转圈小图标 |

### 卡片基础结构

```
┌──────────────────────────────────────┐
│ [icon]  服务名称                  [状态徽章]    │  ← 主信息行
│         分类 · 价格 · N 个规格                 │  ← 次要信息行（不超过 3 段）
│  ──────────────────────  │
│ ⓘ 更新审核中 · 已提交 2h     [查看进度]      │  ← 状态副条（按状态条件渲染）
└────────────────────────┘
```

- 价格归一化：单规格 `¥0.10`；多规格 `¥0.10 起`。底层 `0.1-0.1` 这种区间在 hooks 层处理。
- 副条按状态显示：
  - `运营中・有更新待审` → 黄底"更新审核中 · 已提交 Xh / 查看进度"
  - `运营中・上次更新被驳回` → 红底"上次更新被驳回：xxx / 修改重提 →"（老版本不受影响仍在运营，副条作为提醒）
  - `审核未通过` → 红底"驳回原因：xxx / 修改重提 →"
  - `已下架` → 灰底"下架原因：xxx / 申诉 →"（申诉按钮 disabled，提示"敬请期待"）
- 纯 `运营中` 和 `审核中` 不显示副条。

### 进度步骤条

仅在编辑页头部完整展开。三段式横向，每节点带状态色：

- 新服务首次提交：`已提交 → 审核中 → 待审核结果（预计 24h）`
- 更新审核（已运营服务）：`已提交更新 → 平台审核中 → 待生效（预计 24h）`
- 驳回：`已提交 → 审核中 → 审核未通过（红色，附原因）`
- 下架：`上架运营 → 平台核查 → 已下架（灰色，附原因）`

实现要点：

- 时间戳一律用相对时间（"2h 前"），带 tooltip 显示绝对时间。
- "预计 24h"的 SLA 文案由后端配置返回，不要 hardcode。
- 未达成节点 `○` 空心 + 灰色，达成节点 `●` 实心 + 状态色。
- 进度条本身不可点击，纯展示。

### 列表态 vs 详情态

- 列表态（我的服务页）：仅显示卡片副条（单行文字），不展开步骤条。
- 详情态（编辑页头部）：完整展开步骤条 + 原因 + 操作按钮。

### 分类图标

每个分类用一个固定图标（保洁 / 按摩 / 洗车 / 维修…），避免当前 cut1 同分类下出现不同图标。图标颜色与状态联动："运营中"用品牌色，"审核中"用琥珀色，"已下架"用灰色。

## 编辑页 5 种模式

编辑页是单一壳，5 模式由 `?mode=` 参数切换，差异在三处：**头部信息卡** / **字段可编辑性** / **底部主按钮**。

### 模式总览

| 模式 | 触发入口 | 头部 | 字段可编辑性 | 底部主按钮 |
| --- | --- | --- | --- | --- |
| `create` | 服务库 + 添加 | 简洁标题"新增服务" | 全部可编辑 | 提交审核 |
| `edit-active` | 运营中 / 运营中·有更新待审 / 运营中·上次更新被驳回 卡片点击 | 状态徽章 + "服务运营中"；副状态时附加黄/红提示卡 | 全部可编辑 | 动态：见下文 |
| `edit-pending` | "审核中"卡片点击（首次提交） | 进度步骤条 | 全部只读 | 撤回提交 |
| `edit-rejected` | "审核未通过"卡片点击（首次提交被驳回） | 红色驳回原因卡 + 步骤条 | 全部可编辑 | 修改并重新提交 |
| `edit-takendown` | "已下架"卡片点击 | 灰色下架原因卡 + 申诉按钮（disabled） | 全部可编辑 | 修改并重新提交 |

`edit-active` 模式下根据 derivedStatus 显示不同的头部提示卡：

- `active`（纯运营中）：仅状态徽章，无额外提示卡。
- `active_with_pending_update`：黄色提示卡"有一个待审核的更新（已提交 Xh），是否在此基础上继续修改？"，含 [继续编辑/放弃更新] 选择（详见下方冲突处理）。
- `active_with_rejected_update`：红色提示卡"上次更新被驳回：xxx。老版本仍在运营。修改后可重新提交。"加载主体当前内容（不加载已驳回的草稿快照），用户在此基础上修改后重新提交即可创建新 draft。

### `edit-active` 模式：动态主按钮

进入页面（无修改）：主按钮 `保存修改` (disabled)。

只修改非敏感字段：主按钮 `保存修改`（启用）→ 直接 PATCH 主体 → toast "已保存" → 关闭。

修改任意敏感字段：

1. 主按钮变为 `保存并提交审核`（启用）。
2. 顶部出现黄色提示条："你修改了 [名称、规格] 等内容，提交后将进入审核。审核期间，老版本继续对外运营。"
3. 点击后弹出二次确认 dialog：
    - 标题：提交更新审核
    - 内容："该服务的更新将进入审核流程，预计 24h 内出结果。审核期间，当前线上版本（老版本）继续运营，用户下单不受影响。"
    - 操作：取消 / 确认提交
4. 确认后 → 创建/覆盖 draft → 服务卡片状态变为 `运营中・有更新待审`。

### `edit-active` 冲突处理

仅在 `active_with_pending_update`（运营中・有更新待审）时触发。进入编辑：

- 进入页面时弹提示："你有一个待审核的更新尚未完成，是否在此基础上继续修改？"
- `继续编辑` → 加载 draft 快照内容；保存时覆盖原 draft（保持 pending，时间戳更新）。
- `放弃更新` → 加载主体当前内容（清空草稿）。

`active_with_rejected_update` 不走此分支：直接加载主体内容，已驳回的 draft 不应作为编辑起点（避免用户在已被驳回的内容上继续叠加修改）。重新提交时复用同一 draft 记录（status 从 `rejected` 重置为 `pending`，详见 §接口）。

### `edit-pending` 模式

字段全部只读，主按钮 `撤回提交`：

- 新服务首次提交的 pending：撤回 → 删 draft → 服务从列表消失（回到"未添加"状态）。
- 已运营服务的更新审核中：撤回 → 删 draft → 服务回到纯"运营中"。
- 撤回操作需要二次确认。

### `edit-rejected` 模式

头部红色卡片：

```
⚠ 审核未通过
驳回原因：xxx
———
修改后可重新提交审核
```

字段可编辑，主按钮 `修改并重新提交`。提交后状态变 `审核中`（复用同一 draft 记录，详见 §接口）。

### `edit-takendown` 模式

头部灰色卡片：

```
🔒 已下架
下架原因：xxxx
处理时间：2026-05-13
———
[申诉] (disabled，提示"敬请期待")
```

字段可编辑，主按钮 `修改并重新提交`。点击 disabled 的申诉按钮 → toast "申诉功能开发中，敬请期待"。

### 离开前未保存提示

可编辑模式下，若有脏数据：

- 系统返回手势/返回按钮 → 弹"未保存的修改将丢失，确定离开？" / [取消 / 离开]。
- 仅在脏数据存在时弹出。

### 危险操作区

仅 `edit-active` / `edit-rejected` 模式显示，位于页面底部：

```
危险操作

[下架服务] 仅自己不再提供该服务  → 二次确认
[删除服务] 彻底删除，无法恢复    → 二次确认 + 输入服务名验证
```

- 顶部右上角的红色"删除"按钮取消。
- `edit-pending` / `edit-takendown` 不显示该区。

## 接口对齐与数据流

### 后端需要补齐/暴露的接口

#### A. 我的服务列表（聚合接口）

`GET /api/worker/services` 返回数组，每项形如：

```ts
{
  offering: {
    id, name, categoryId, categoryName, icon,
    publicationStatus: 'active' | 'taken_down',
    takedownReason?: string,
    takedownAt?: ISO8601,
  } | null,
  draft: {
    id, status: 'pending' | 'rejected',
    submittedSnapshot,
    submittedAt: ISO8601,
    reviewedAt?: ISO8601,
    rejectionReason?: string,
  } | null,
  derivedStatus:
    | 'pending'                       // 审核中（首次提交）
    | 'active'                        // 运营中
    | 'active_with_pending_update'    // 运营中・有更新待审
    | 'active_with_rejected_update'   // 运营中・上次更新被驳回
    | 'rejected'                      // 审核未通过（首次提交被驳回）
    | 'takendown',                    // 已下架
  timeline: Array<{
    type: 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'takendown' | 'updated',
    at: ISO8601,
    note?: string,
  }>,
}
```

`derivedStatus` 由后端计算并返回，避免前端各端各算一遍口径飘移。

#### B. 服务库

`GET /api/worker/service-catalog?addedStatus=true` —— 不带商家审核/下架状态信息（不暴露平台目录之外的状态）。`addedStatus=true` 时为每条目录项附加 `isAdded: boolean` 用于禁用 `+ 添加` 按钮。

#### C. 撤回提交

`DELETE /api/worker/services/{offeringId}/draft` —— 撤回 pending draft。

### Schema 调整

仅补一个字段 + 一张表：

1. `service_personnel_offering_drafts` 表新增 `submitted_at` 字段（timestamp，标记本次提交时间，与 `created_at` 区分以支持驳回后重提）。
2. 新增 `service_offering_audit_logs` 表存储审核事件流：

```ts
service_offering_audit_logs:
  id, offering_id, draft_id,
  type: 'submitted' | 'approved' | 'rejected' | 'takendown' | 'restored',
  occurred_at, operator_id?, note?
```

每次状态变更追一条记录，timeline 由该表查询拼装而成。

**历史数据兜底**：本期上线前已存在的服务在 `audit_logs` 中没有记录。处理策略：

- 迁移脚本扫描所有现存 `service_personnel_offering_drafts` 和 `service_personnel_offering_statuses`，根据 `created_at` / `updated_at` / `reviewed_at` / `taken_down_at` 等字段反推一组合理的 audit_log 事件并回填。
- 回填的事件统一标 `operator_id = NULL` + `note = '历史数据迁移'`，以便后续审计区分。
- 仍无法推断完整时间线的边界场景（如字段缺失）：前端 timeline 展示时只渲染能拿到的节点，其它节点用"—"占位，不强行 fallback 到当前时间。

### 驳回后重提的处理

复用同一条 draft 记录：

- `status` 从 `rejected` → `pending`
- `submitted_snapshot` 更新
- `submitted_at` 更新
- `reviewed_at` / `rejection_reason` 清空
- `audit_logs` 追加 `submitted` 事件

### 前端 hooks 改造

`packages/hooks/src/api/service-personnel/` 下新增：

- `useMyServices()` —— 调 A，返回带 `derivedStatus` 的列表，按状态分组
- `useMyService(id)` —— 单条详情，给编辑页用
- `useServiceCatalog(opts)` —— 调 B
- `useSubmitServiceDraft()` —— mutation，新建/重提
- `useUpdateActiveService()` —— mutation，编辑运营中服务的非敏感字段（直接更新主体）
- `useSubmitServiceUpdate()` —— mutation，编辑运营中服务的敏感字段（创建/覆盖 draft）
- `useWithdrawDraft()` —— mutation，撤回提交
- `useTakedownService()` —— mutation，自主下架
- `useDeleteService()` —— mutation，删除

缓存失效规则：所有 mutation 成功后 invalidate `['my-services']` queryKey 触发列表刷新。详情页 mutation 同时 invalidate `['my-service', id]`。

### 数据流

```
[页面] ──useMyServices()──▶ [后端聚合]
                              ├─ 查 service_offerings (主体)
                              ├─ 查 service_personnel_offering_drafts (草稿)
                              ├─ 查 service_offering_audit_logs (timeline)
                              └─ 服务端拼装 derivedStatus + timeline

[编辑页] ──useSubmitServiceUpdate()──▶ [后端]
                              ├─ 检查是否存在 active draft
                              │  ├─ 有 → 覆盖（提示已在前端处理）
                              │  └─ 无 → 新建 draft
                              ├─ 写 audit_log
                              └─ 触发管理端审核通知（独立 channel）

[管理端审核动作] ──▶ [后端]
                  ├─ 更新 draft.status (approved/rejected)
                  ├─ approved 时同步 submitted_snapshot 到主体
                  ├─ 写 audit_log
                  └─ 推送通知商家 + 写消息中心
```

### 通知机制

复用现有 `NotificationPublisher`（2026-05-13 spec 已实现）。本期不新增 WebSocket 实时推送，仅通过消息中心承载结果通知。事件类型沿用既有：

- `service_offering_review_approved`
- `service_offering_review_rejected`
- `service_offering_taken_down`

## 测试策略

### 后端单元测试

- `useMyServices` 聚合接口：覆盖 5 种 derivedStatus 分支（含 active_with_pending_update）。
- 撤回 pending draft：删除记录 + 写 audit_log。
- 驳回后重提：同一 draft 记录字段更新正确（status/snapshot/submitted_at/清空 reviewed 字段）。
- 非敏感字段更新：直接修改主体，不创建 draft。
- 敏感字段更新：创建 draft，主体不动。
- 主体 active 状态下覆盖既有 pending draft：唯一索引不冲突。
- audit_logs 在每次状态变更时正确追加事件。

### 移动端测试

- 我的服务页 4 个 Tab 切换 + 数量徽标渲染。
- 卡片副条按 derivedStatus 条件渲染（仅 4 种状态出现）。
- 编辑页 5 种模式头部/字段/按钮差异。
- `edit-active` 动态主按钮：从"保存修改"变为"保存并提交审核"。
- `edit-active` 冲突处理：进入页面时弹"继续编辑/放弃更新"提示。
- 离开前未保存提示在脏数据时弹出。
- 申诉按钮 disabled 状态 + toast 提示。
- 删除按钮的二次确认 + 输入服务名校验。

### 端到端

- 新建服务流程：服务库 + 添加 → 编辑 → 提交审核 → 审核中 Tab 显示 → 审核通过 → 运营中 Tab 显示。
- 编辑运营中服务（敏感字段）：双轨保护下，老版本对消费端持续可见，新版本审核通过后替换。
- 驳回 → 修改重提 → 二次审核通过的完整链路。
- 平台下架 → 修改重提 → 重新上线的完整链路。

## 验收标准

1. 服务人员端 4 状态在三页（我的服务 / 服务库 / 编辑）以一致的视觉语言呈现。
2. 我的服务页通过 Tab 区分状态，"已下架"不再出现在"运营中"列表中。
3. 服务库不展示任何商家级状态信息（包括"已下架"）。
4. 编辑运营中服务时，仅修改非敏感字段保存即生效；修改敏感字段后才进入审核，审核期间老版本对消费端持续可见。
5. 编辑页 5 模式按入口正确切换，删除按钮位于底部"危险操作"区且需输入服务名验证。
6. 审核中 / 审核未通过 / 已下架卡片均带可视化进度（列表副条 + 详情步骤条）。
7. 申诉按钮在已下架卡片和 `edit-takendown` 头部出现但 disabled，点击 toast 提示"敬请期待"。
8. 撤回提交、覆盖既有 draft、驳回后重提的边界场景全部按预期工作。

## 后续工作（不在本期范围）

1. **申诉机制后端 + UI 联通**：申诉对话历史表、申诉提交接口、申诉处理流程、UI 占位按钮启用。
2. **WebSocket 实时推送**：审核结果出来时立即在 app 内弹横幅，不必等用户进入页面。
3. **管理端审核页面优化**：当前管理端审核页与本次重构未对齐的部分（如步骤条、原因结构化）可后续推进。
4. **审核 SLA 配置化**：后端返回"预计审核时长"，前端不再 hardcode "24h"。
