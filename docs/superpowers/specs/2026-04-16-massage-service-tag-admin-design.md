# 按摩服务标签管理端最小闭环设计稿

> 目标：在已完成按摩频道真实数据接入的基础上，为下一期补齐服务标签的管理端维护闭环。复用现有 `service_tags` 与 `services.service_tag_id` 模型，新增管理端标签 CRUD，并在现有服务编辑入口中补充单标签绑定能力；能力按全局模型设计，但首版仅开放 `domain = 'massage'`。

## 1. 设计结论

本次设计按“最小闭环、尽量复用现有结构、不顺手扩项目范围”收敛：

- 新增独立管理端页面 `/service-tags`
- 侧边栏在“运营管理”下新增“服务标签”入口
- 不新增新的标签底表
- 不新增 `services` 新字段，继续复用 `services.service_tag_id`
- 不新增数据库迁移
- 不新增 `service_tags.createdAt / updatedAt` 字段
- 标签能力继续按全局服务标签模型设计
- 管理端首版只开放 `domain = 'massage'`
- 不提供多 domain 切换 UI
- 标签资源管理放入现有 `admin` 模块，不新增独立 Nest 模块
- 标签 CRUD 使用管理端独立 admin 接口
- 服务绑定标签不新增专用接口，继续复用现有 `PUT /service/services/:id`
- 服务分类页继续复用现有 [apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx](/mnt/f/home_server/apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx) 中的服务编辑 Dialog，只新增一个 `serviceTagId` 字段
- 当前一条服务仍然最多只能绑定一个标签
- 已被服务引用的标签允许停用
- 已被服务引用的标签不允许删除
- 停用标签后不再出现在客户端按摩 landing 入口中
- 停用标签不会自动解绑已有服务
- 服务不能新绑定或改绑到停用标签
- 历史上已绑定停用标签的服务允许保留原值并继续编辑其他字段
- 管理端不做标签视觉元数据
- 本期不做多标签归属
- 本期不改移动端按摩页面与既有 `massage` 聚合接口契约

这意味着下一期的重点不是继续改按摩移动端，而是把一期已经落地的标签能力补成“后台可维护”的业务闭环。

## 2. 背景与现状

### 2.1 一期已经完成的能力

根据上一期设计稿 [docs/superpowers/specs/2026-04-14-massage-real-data-design.md](/mnt/f/home_server/docs/superpowers/specs/2026-04-14-massage-real-data-design.md)，当前已经完成：

- `service_tags` 与 `services.service_tag_id`
- 按 `domain = 'massage'` 返回按摩 landing 标签入口
- 分类筛选页支持 `serviceTagId`
- 按摩 landing / 详情页真实数据化
- `home_banners.scene`
- 全局服务人员收藏读态

上一期设计稿已明确把“标签管理 + 服务绑定标签管理端”留到下一阶段处理。

### 2.2 管理端现有结构

当前管理端不是空白状态，而是已有固定组织方式：

- 路由采用 Next.js App Router 的 `(management)` 分组
- 侧边栏导航集中定义在 [apps/admin-web/src/components/layout/nav-config.ts](/mnt/f/home_server/apps/admin-web/src/components/layout/nav-config.ts)
- 页面装配统一采用：
  - `PageSection`
  - `Suspense`
  - `QueryErrorResetBoundary`
  - `ErrorBoundary`
- 管理端资源型页面的数据访问优先走 `packages/hooks/src/api/ssr/*`

### 2.3 服务管理的真实入口

当前并不存在独立 `/services` 管理页。

现有服务管理能力实际挂在 [apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx](/mnt/f/home_server/apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx)：

- 分类页面内可以新增 / 编辑 / 启停 / 删除服务
- 服务编辑入口是内嵌 Dialog，而不是独立服务详情页
- 服务写接口继续走现有 `/service/services/:id`

因此，下一期如果只为补“标签维护闭环”，最稳妥的方案是：

- 标签资源新增独立管理页
- 服务绑定入口继续复用现有分类页里的服务编辑 Dialog

而不是顺手重做服务管理模块。

## 3. 方案比较

### 方案 A：独立标签页 + 复用现有服务编辑 Dialog

做法：

- 新增 `/service-tags` 管理页
- 标签 CRUD 走 admin 独立接口
- 服务绑定标签继续复用现有 `service-categories` 页面中的服务编辑弹窗

优点：

- 贴合当前管理端结构，改动最小
- 能形成标签管理与服务绑定的完整闭环
- 不会把“补管理能力”扩成“重构服务后台”
- 后续如果扩展到更多 domain，标签页仍然可复用

缺点：

- 服务绑定入口仍依附在分类页里，不是独立服务后台

结论：

- 本期采用

### 方案 B：把标签管理塞进 `service-categories` 页面

做法：

- 不新增独立标签页
- 在现有分类页中增加标签表格 / 标签弹窗 / 标签筛选

优点：

- 页面入口少
- 实现表面上更集中

缺点：

- 分类、服务、标签三类职责会混在一个页面里
- 现有页面已经承担分类树、服务列表、拖拽移动、服务编辑，不适合继续膨胀
- 后续扩展到更多业务域会更难维护

结论：

- 本期不采用

### 方案 C：顺手拆独立服务管理模块，再把标签绑定做到新模块中

做法：

- 新增 `/services` 页面
- 把服务 CRUD 从分类页抽离
- 标签绑定改挂在新服务管理模块

优点：

- 长期结构更清晰

缺点：

- 已明显超出“最小闭环”范围
- 会把当前需求从“补后台维护”扩大成“重构服务管理结构”
- 风险和工作量都不成比例

结论：

- 本期不采用

## 4. 设计原则

- 最小闭环优先，不顺手扩成服务管理重构
- 标签仍然是全局服务标签能力，不是按摩专属底表
- 管理端首版只开放 `massage` 域，但接口与类型命名保持全局化
- 当前一条服务最多绑定一个标签
- 服务绑定标签属于服务编辑的一部分，不额外拆专用写接口
- 已引用标签允许停用，不允许删除
- 停用只影响客户端入口展示，不影响历史绑定数据
- 新增或改绑时只允许选择启用中的标签
- 管理端不做标签图片、颜色、副标题等视觉元数据
- 不新增 `createdAt / updatedAt` 字段，避免为管理列表展示引入额外迁移
- 不改移动端按摩页面现有 UI 与接口契约

## 5. 数据模型与业务规则

### 5.1 继续复用 `service_tags`

本期不新增新表，继续复用现有：

- `service_tags`

字段继续使用现有模型：

- `id`
- `name`
- `slug`
- `domain`
- `sortOrder`
- `isActive`
- `description`

本期不新增：

- `createdAt`
- `updatedAt`
- 任意视觉元数据字段

### 5.2 继续复用 `services.service_tag_id`

本期不新增新字段，继续复用：

- `services.service_tag_id`

含义保持不变：

- 一条服务当前最多归属一个标签
- `null` 表示该服务没有标签

### 5.3 派生字段 `serviceCount`

管理端标签列表需要展示标签被多少个服务引用，但这不是底表字段，而是管理端查询派生值：

- `serviceCount`

用途：

- 展示标签影响范围
- 作为删除前校验依据
- 帮助运营判断停用成本

### 5.4 标签删除规则

- 若 `serviceCount > 0`
  - 不允许删除
  - 后端返回 `409 Conflict`
- 若 `serviceCount = 0`
  - 允许删除

### 5.5 标签停用规则

- 停用允许执行
- 停用不会自动把关联服务的 `serviceTagId` 清空
- 停用后该标签不再出现在按摩 landing 标签入口中
- 停用后该标签也不应再出现在“新绑定 / 改绑”的可选项中

### 5.6 服务绑定规则

- 创建服务时：
  - 若传 `serviceTagId`，必须指向存在且 `isActive = true` 的标签
- 更新服务时：
  - 若本次把标签改为另一个标签，目标标签必须存在且 `isActive = true`
  - 若本次只是保留原本已经绑定的停用标签，不报错
- 清空标签时：
  - `serviceTagId = null`

这组规则的目标是：

- 允许历史脏值被安全保留
- 禁止新的业务继续流入停用标签
- 不因为停用操作引入自动解绑副作用

## 6. 接口设计

### 6.1 管理端标签列表

新增：

- `GET /admin/service-tags`

查询参数建议：

- `domain?: string`
- `keyword?: string`
- `status?: 'all' | 'active' | 'inactive'`

首版前端行为：

- 固定传 `domain=massage`
- 不暴露多 domain 切换 UI

建议响应结构：

```ts
type AdminServiceTag = {
    id: string;
    name: string;
    slug: string;
    domain: ServiceTagDomain;
    sortOrder: number;
    isActive: boolean;
    description: string | null;
    serviceCount: number;
};

type AdminServiceTagListResponse = {
    items: AdminServiceTag[];
};
```

说明：

- 首版不做分页
- 原因是 `massage` 域标签量预期很小，分页只会增加复杂度
- 列表按 `sortOrder asc, id asc` 排序

### 6.2 创建标签

新增：

- `POST /admin/service-tags`

请求字段：

- `name`
- `slug`
- `domain`
- `sortOrder`
- `description?`
- `isActive`

前端行为：

- 创建时 `domain` 固定写入 `massage`
- 不允许运营手填其他业务域

校验规则：

- `name` 必填
- `slug` 必填
- 同一 `domain` 下 `slug` 唯一
- `sortOrder` 为整数

### 6.3 更新标签

新增：

- `PATCH /admin/service-tags/:id`

支持更新：

- `name`
- `slug`
- `sortOrder`
- `description`
- `isActive`

不支持更新：

- `domain`

原因：

- 标签一旦创建到某个业务域，其业务语义已经确定
- 允许跨域改动会造成引用和运营含义混乱

### 6.4 删除标签

新增：

- `DELETE /admin/service-tags/:id`

规则：

- `serviceCount > 0` 返回 `409`
- `serviceCount = 0` 才允许删除

### 6.5 服务绑定标签写接口

不新增新接口，继续复用：

- `PUT /service/services/:id`

在现有更新服务请求中继续支持并补齐业务校验：

- `serviceTagId?: string | null`

说明：

- 服务绑定标签是服务编辑的一部分，不值得单独拆 admin 写接口
- 继续复用现有服务更新链路，能够减少重复契约与缓存失效逻辑

## 7. 管理端页面与交互设计

### 7.1 新增独立标签页

新增路由：

- `/service-tags`

新增侧边栏入口：

- 标签名称：`服务标签`
- 所属分组：`运营管理`

不替换现有：

- `/service-categories`

职责边界：

- `/service-tags`
  - 管标签资源本身
- `/service-categories`
  - 管分类和服务，并在服务编辑时绑定标签

### 7.2 页面装配模式

新页面继续遵循现有管理端模式：

- `Suspense`
- `QueryErrorResetBoundary`
- `ErrorBoundary`
- `PageHeader`

建议文件：

- `apps/admin-web/src/app/(management)/service-tags/page.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-section.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-content.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-error.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table-skeleton.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_components/service-tag-form-dialog.tsx`
- `apps/admin-web/src/app/(management)/service-tags/_utils/query.ts`

### 7.3 标签页主视图

页面主结构采用：

- 筛选栏
- 标签列表表格
- 新建 / 编辑弹窗
- 删除确认框

页面顶部展示一个只读上下文：

- `当前业务域：上门按摩（massage）`

筛选项建议保留：

- `keyword`
- `status`

首版不做：

- domain 切换器
- 统计图
- 抽屉详情页
- 批量操作

### 7.4 列表列建议

建议列：

- 标签名称
- `slug`
- 业务域
- 排序值
- 状态
- 已绑定服务数
- 操作

本期明确不展示：

- 创建时间
- 更新时间

因为当前真实模型没有这两个字段，本期也不为此新增迁移。

### 7.5 行操作

每行支持：

- `编辑`
- `启用 / 停用`
- `删除`

交互规则：

- 若 `serviceCount > 0`
  - 删除按钮置灰，或点击后提示“已被服务引用，无法删除”
- 若 `serviceCount = 0`
  - 允许删除，弹确认框
- 停用时需要给出明确提醒：
  - 停用后不会出现在客户端按摩频道入口中
  - 不会自动解绑已有服务

### 7.6 新建 / 编辑标签弹窗

表单统一使用：

- `@tanstack/react-form`
- `Zod`

字段：

- `name`
- `slug`
- `sortOrder`
- `description`
- `isActive`

`domain` 规则：

- 创建时前端固定写入 `massage`
- 编辑时展示只读 `domain`
- 不允许运营手工切换 domain

`slug` 交互：

- 保留显式输入框
- 可做轻量格式提示
- 最终以后端唯一性校验为准

### 7.7 服务分类页中的标签绑定

继续复用现有服务编辑入口：

- [apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx](/mnt/f/home_server/apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx)

在 `ServiceFormDialog` 中新增字段：

- `serviceTagId`

控件形态：

- 单选 `Select`

选项来源建议：

- 默认请求 `/admin/service-tags?domain=massage&status=all`

前端展示规则：

- 可选候选项默认只展示 `isActive = true` 的标签
- 若当前服务已绑定停用标签，仍需额外回显该值
- 回显的停用标签需标记为“已停用”
- 提供“未设置标签”选项，对应 `null`

这要同时支持三类操作：

- 新绑定标签
- 改绑到另一个标签
- 清空已有标签

## 8. 后端、类型与 Hooks 改动范围

### 8.1 后端 admin 模块

新增：

- `apps/backend/src/modules/admin/admin-service-tags.controller.ts`
- `apps/backend/src/modules/admin/admin-service-tags.service.ts`
- `apps/backend/src/modules/admin/admin-service-tags.repository.ts`

修改：

- [apps/backend/src/modules/admin/admin.module.ts](/mnt/f/home_server/apps/backend/src/modules/admin/admin.module.ts)

职责：

- `repository`
  - 标签列表查询
  - `serviceCount` 聚合
  - 删除前引用检查
- `service`
  - 创建 / 更新 / 启停 / 删除业务规则
  - 处理同域 `slug` 唯一性冲突
- `controller`
  - 暴露 `/admin/service-tags` CRUD

### 8.2 服务模块

修改：

- [apps/backend/src/modules/service/service.controller.ts](/mnt/f/home_server/apps/backend/src/modules/service/service.controller.ts)
- [apps/backend/src/modules/service/service.service.ts](/mnt/f/home_server/apps/backend/src/modules/service/service.service.ts)
- [apps/backend/src/modules/service/service.repository.ts](/mnt/f/home_server/apps/backend/src/modules/service/service.repository.ts)

职责：

- 在现有服务更新链路里补 `serviceTagId` 的写入与校验
- 拒绝绑定不存在或已停用的目标标签
- 允许保留历史上已经绑定的停用标签

### 8.3 共享类型

管理端相关 Schema 继续集中放在：

- [packages/types/src/admin.ts](/mnt/f/home_server/packages/types/src/admin.ts)

建议新增：

- `AdminServiceTagSchema`
- `AdminServiceTagListResponseSchema`
- `AdminServiceTagListQuerySchema`
- `CreateAdminServiceTagSchema`
- `UpdateAdminServiceTagSchema`

继续复用：

- [packages/types/src/service-tag.ts](/mnt/f/home_server/packages/types/src/service-tag.ts)
- [packages/types/src/service.ts](/mnt/f/home_server/packages/types/src/service.ts)

同步修改：

- [packages/types/src/index.ts](/mnt/f/home_server/packages/types/src/index.ts)

### 8.4 Hooks

新增管理端 SSR hooks：

- `packages/hooks/src/api/ssr/admin-service-tags.ts`

修改：

- `packages/hooks/src/api/ssr/index.ts`

建议提供：

- `adminServiceTagsQueryOptions(params)`
- `useAdminServiceTags(params)`
- `useCreateAdminServiceTag()`
- `useUpdateAdminServiceTag()`
- `useDeleteAdminServiceTag()`

服务绑定标签继续复用现有：

- `useUpdateService()`

不新增：

- admin 专用服务标签绑定 mutation

### 8.5 前端管理端

新增：

- `/service-tags` 页面与其 `_components/*`

修改：

- [apps/admin-web/src/components/layout/nav-config.ts](/mnt/f/home_server/apps/admin-web/src/components/layout/nav-config.ts)
- [apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx](/mnt/f/home_server/apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx)

## 9. 错误处理设计

### 9.1 标签创建 / 编辑

- 同一 `domain` 下 `slug` 冲突时，后端返回明确业务错误
- 前端弹窗内展示可理解文案，例如：
  - `该 slug 已在当前业务域中使用`

### 9.2 标签删除

- 若 `serviceCount > 0`
  - 后端返回 `409 Conflict`
  - 前端提示：
    - `该标签已被服务引用，无法删除；如需下线请先停用`

### 9.3 服务绑定标签

- 若 `serviceTagId` 不存在，返回 `400`
- 若目标标签已停用且本次是新绑定 / 改绑，返回 `400`
- 若只是保留当前已经绑定的停用标签，不报错

### 9.4 标签停用

停用成功后的前端提示应明确：

- 停用后不会再出现在按摩频道入口中
- 不会自动解绑已有服务

## 10. 非目标范围

以下能力明确不放进本期实现：

- 多 domain 切换 UI
- 非 `massage` 域标签运营
- 多标签归属
- 标签批量迁移 / 批量绑定
- 标签视觉元数据
- 新的服务管理独立模块
- 移动端按摩页面调整
- `massage` 聚合接口调整
- 为 `service_tags` 补 `createdAt / updatedAt`
- 新的数据库表 / 字段 / 迁移

## 11. 测试要求

### 11.1 后端测试

建议新增：

- `apps/backend/src/modules/admin/admin-service-tags.service.spec.ts`

覆盖：

- 创建标签成功
- 同域 `slug` 冲突失败
- 已引用标签删除失败
- 未引用标签删除成功
- 标签启用 / 停用成功

建议补充：

- `service.service.spec.ts` 或对应 repository / service 测试

覆盖：

- 服务可绑定活跃标签
- 服务不可新绑停用标签
- 服务可保留历史停用标签
- 服务可清空 `serviceTagId`

### 11.2 前端验证

重点验证：

- `/service-tags` 首屏 skeleton、错误态、空态正常
- 标签创建 / 编辑 / 启停 / 删除后列表刷新正常
- `service-categories` 页中的服务编辑弹窗可正常加载标签选项
- 已绑定停用标签的服务进入编辑弹窗时，能正确回显当前值
- 选择“未设置标签”后，可成功解绑标签

### 11.3 回归验证

- 按摩 landing 仍然只展示 `isActive = true` 的标签
- 停用但仍被服务引用的标签，不会重新出现在客户端入口中
- 现有按摩真实数据链路不被破坏

## 12. 验收标准

### 12.1 管理端标签资源

- 管理端新增 `/service-tags` 页面
- 可维护 `domain = 'massage'` 的标签
- 可新增、编辑、启停标签
- 未被引用的标签可删除
- 已被引用的标签不可删除

### 12.2 服务绑定标签

- `service-categories` 页面中的服务编辑弹窗可为服务选择单个标签
- 服务可清空标签绑定
- 服务不能新绑定到停用标签
- 历史上已绑定停用标签的服务仍可正常进入编辑流程，并保留当前值

### 12.3 范围约束

- 不新增新的数据库表或字段
- 不新增多标签归属
- 不新增标签视觉元数据
- 不改移动端按摩页面现有 UI
- 不改按摩 landing / detail 的既有查询契约
- 不为 `service_tags` 新增 `createdAt / updatedAt`

## 13. 与上一期的衔接关系

本设计直接承接上一期 [docs/superpowers/specs/2026-04-14-massage-real-data-design.md](/mnt/f/home_server/docs/superpowers/specs/2026-04-14-massage-real-data-design.md) 第 11.2 节中约定的“下一期范围”：

- 标签管理
- 服务绑定标签

区别在于，本次进一步把下一期实现范围收缩成“最小闭环”：

- 标签资源有独立管理页
- 服务绑定只复用现有服务编辑 Dialog
- 不借此扩出独立服务管理模块
- 不借此扩出多 domain / 多标签 / 视觉运营能力
