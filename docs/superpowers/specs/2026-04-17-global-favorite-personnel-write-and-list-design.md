# 全局收藏能力补充设计稿

> 目标：在现有“全局服务人员收藏读态”基础上，补齐真正可执行的收藏写操作，以及“收藏商户”列表页；并确保该能力是全局 `service_personnel` 能力，而不是只服务于按摩分类。

## 1. 背景与问题

[2026-04-14-massage-real-data-design.md](/mnt/f/home_server/docs/superpowers/specs/2026-04-14-massage-real-data-design.md) 已经完成了以下设计：

- `follows` 作为收藏底表复用
- `GET /follows/personnel/:personnelId/summary` 作为全局收藏读态接口
- 按摩详情页聚合 `favoriteCount` / `isFavorited`
- 按摩 landing 页保留“收藏商户”入口文案

但当前实现仍有两个关键缺口：

- 缺少真正的收藏写操作，按钮只能展示读态，不能收藏或取消收藏
- 缺少“收藏商户”页面，用户无法浏览自己已收藏对象

同时需要明确一个现实约束：

- 当前仓库没有可落地的独立 `merchant/shop` 实体链路
- 当前前端所谓“商户”在收藏语义上，实际对应的是全局 `service_personnel`
- 因此本次设计不引入新的商户实体，也不扩展 `follows` 为多目标类型

本次设计的核心原则是：

- 保持现有 `follows(user -> user)` 数据模型
- 收藏对象统一定义为 `service_personnel.userId`
- 页面文案允许继续使用“收藏商户”，但接口、类型、缓存、路由语义一律按“收藏服务人员”设计
- 按摩页只是入口之一，其他分类详情页必须能复用同一套收藏能力

## 2. 设计结论

- 不新增 `merchant_favorites`、`favorite_targets`、`favorite_type` 等新表或多态模型
- 继续复用 `follows`
- 新增全局收藏写接口：
  - `POST /follows/personnel/:personnelId`
  - `DELETE /follows/personnel/:personnelId`
- 新增全局“我的收藏”列表接口：
  - `GET /follows/personnel`
- 新增共享类型与 hooks，统一管理读写与 query invalidation
- 新增移动端“收藏商户”页面，但页面真实含义为“我收藏的服务人员”
- 按摩 landing 页“收藏商户”入口跳到该新页面
- 服务人员详情页收藏按钮改为真实可点击，且全站所有服务人员详情页共用
- 分类筛选页、搜索结果页、首页推荐卡等列表卡片本期不强制补收藏按钮；但只要跳入服务人员详情页，就必须具备真实收藏能力

## 3. 现状调研结论

### 3.1 已存在的能力

- 数据底表：`follows`
- 后端读接口：`GET /follows/personnel/:personnelId/summary`
- 后端服务：`FollowService.getPersonnelFavoriteSummary(...)`
- 前端共享 hook：`usePersonnelFavoriteSummary(personnelId)`
- 按摩详情页已消费 `favoriteSummary.isFavorited` 和 `favoriteSummary.favoriteCount`
- 按摩 landing 页有“收藏商户”入口文案，但目前只是静态展示，没有点击行为

### 3.2 当前限制

- `follows` 是 `followerId -> followingId` 的用户关系表，不带目标类型
- `followingId` 当前天然只能指向 `users.id`
- `service_personnel` 与 `users` 已有关联，因此“收藏服务人员”可以直接成立
- 仓库中 `shops` 相关链路已被移除或废弃，当前没有稳定可用的商户主实体

### 3.3 必须避免的误区

- 不要把“收藏商户”页面实现成新的商户域模型
- 不要为了页面文案去设计一个假的 merchant adapter
- 不要把按摩页专门做成收藏唯一入口
- 不要把收藏写逻辑塞进 `massage` 模块；它应属于全局 `follow` 模块

## 4. 推荐方案

### 方案 A：继续复用 `follows`，把收藏对象固定为服务人员用户

做法：

- 使用 `follows.follower_id = 当前用户`
- 使用 `follows.following_id = service_personnel.user_id`
- `follow` 模块负责读、写、列表三类能力
- 移动端所有服务人员详情页统一消费该能力

优点：

- 与现有数据库和代码完全一致
- 风险最低
- 可以立即覆盖按摩、搜索、分类筛选、首页等所有服务人员详情入口
- 后续如果未来真有商户实体，再新增商户收藏能力即可，不会污染当前实现

缺点：

- “收藏商户”只是 UI 文案，不等于真实收藏对象

结论：

- 本期采用

### 方案 B：给 `follows` 增加目标类型

优点：

- 表意更泛化

缺点：

- 当前没有第二种收藏目标，属于过度设计
- 需要数据库迁移和全链路改造
- 会拖慢本期落地

结论：

- 本期不采用

### 方案 C：重新引入商户实体后再做收藏

优点：

- 语义更纯

缺点：

- 不符合当前仓库现状
- 会把一个收藏补洞需求升级为领域重建

结论：

- 本期不采用

## 5. 数据模型设计

### 5.1 底表继续使用 `follows`

不改 schema。

语义约束补充如下：

- `follower_id`：执行收藏动作的 C 端用户
- `following_id`：被收藏的服务人员用户 ID，即 `service_personnel.user_id`

### 5.2 应用层约束

写接口必须校验：

- `personnelId` 对应的 `service_personnel` 存在
- 目标服务人员处于可展示状态
- 当前用户不能收藏自己

说明：

- “可展示状态”不要求新增字段，只需复用现有服务人员查询中的有效性判断口径
- 若项目当前缺少统一 `isActive + isAvailable` 判定封装，本次在 `follow` 模块中复用现有 repository 查询条件，不另起概念

## 6. 接口设计

### 6.1 收藏读态接口

保留现有接口：

- `GET /follows/personnel/:personnelId/summary`

响应保持不变：

```ts
type PersonnelFavoriteSummaryResponse = {
    personnelId: string;
    favoriteCount: number;
    isFavorited: boolean;
};
```

### 6.2 新增收藏写接口

新增：

- `POST /follows/personnel/:personnelId`

语义：

- 当前用户收藏指定服务人员
- 若已收藏，接口仍返回成功，保持幂等

建议响应：

```ts
type PersonnelFavoriteMutationResponse = {
    personnelId: string;
    isFavorited: true;
    favoriteCount: number;
};
```

新增：

- `DELETE /follows/personnel/:personnelId`

语义：

- 当前用户取消收藏指定服务人员
- 若原本未收藏，接口仍返回成功，保持幂等

建议响应：

```ts
type PersonnelFavoriteMutationResponse = {
    personnelId: string;
    isFavorited: false;
    favoriteCount: number;
};
```

约束：

- 两个接口都要求登录
- 不允许未登录静默写入
- 未登录时返回 401，由移动端统一走登录拦截

### 6.3 新增“我的收藏”列表接口

新增：

- `GET /follows/personnel`

查询参数建议：

```ts
type ListFavoritePersonnelQuery = {
    page?: number;
    pageSize?: number;
};
```

建议响应：

```ts
type FavoritePersonnelListItem = {
    personnelId: string;
    personnelName: string;
    avatarUrl: string | null;
    avatarBlurhash: string | null;
    addressText: string;
    distanceText: string | null;
    availableTimeText: string | null;
    favoriteCount: number;
    reviewCount: number;
    ratingValue: number;
    yearlyOrderCount: number;
    primaryServiceId: string | null;
    primaryPricingId: string | null;
    primaryServiceName: string | null;
    favoritedAt: string | null;
};

type FavoritePersonnelListResponse = {
    items: FavoritePersonnelListItem[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
};
```

排序规则建议：

- 默认按 `favoritedAt DESC`
- 即最近收藏的排最前面

说明：

- 列表页目的是帮助用户找回自己收藏的人，不是推荐页，因此排序应按收藏时间，而不是评分或距离
- `primaryService*` 用于卡片点击后快速跳入详情页或下单页时保留默认服务上下文
- 距离和最早可约时间若当前接口无法稳定计算，可返回 `null`，但字段保留，前端按空态降级

## 7. 后端模块设计

### 7.1 模块职责

- `follow.controller.ts`
  - 承载读、写、列表接口
- `follow.service.ts`
  - 承载收藏业务规则、幂等逻辑、返回结构聚合
- `follow.repository.ts`
  - 承载 `follows` 的增删查、计数和列表查询

### 7.2 Repository 需要补的能力

- `createFavorite(userId, personnelId)`
- `deleteFavorite(userId, personnelId)`
- `listFavoritePersonnel(userId, page, pageSize)`
- `countFavoritesByUserId(userId)`
- `getFavoriteSummary(personnelId, userId?)`

实现约束：

- 新增收藏使用 insert + 冲突忽略，保证幂等
- 删除收藏直接按联合主键删除
- 列表查询从 `follows` 出发，join `service_personnel` / `users` / 必要的服务与评价聚合信息

### 7.3 Service 业务规则

`favoritePersonnel(userId, personnelId)`：

- 校验目标服务人员存在且可展示
- 校验不是收藏自己
- 调用 repository 写入
- 返回最新 `favoriteCount + isFavorited`

`unfavoritePersonnel(userId, personnelId)`：

- 若目标不存在，仍应按业务选择报 404；不建议静默吞掉非法 ID
- 若存在则执行删除
- 返回最新 `favoriteCount + isFavorited`

`listFavoritePersonnel(userId, query)`：

- 返回分页结果
- 保持字段与移动端列表卡片需求对齐

### 7.4 错误语义

- `401`：未登录
- `404`：服务人员不存在或不可访问
- `409`：原则上不需要；收藏已存在/不存在均按幂等成功处理
- `400`：收藏自己、非法参数

## 8. 共享类型与 Hooks 设计

### 8.1 `@repo/types`

新增类型：

- `PersonnelFavoriteMutationResponseSchema`
- `FavoritePersonnelListItemSchema`
- `FavoritePersonnelListResponseSchema`
- `ListFavoritePersonnelQuerySchema`

保留：

- `PersonnelFavoriteSummaryResponseSchema`

### 8.2 `@repo/hooks/api/follow`

新增：

- `useFavoritePersonnel(personnelId)`
- `useUnfavoritePersonnel(personnelId)`
- `useFavoritePersonnelList(params)`

保留：

- `usePersonnelFavoriteSummary(personnelId)`

推荐 queryKey：

```ts
["personnel-favorite-summary", personnelId]
["favorite-personnel-list", page, pageSize]
```

mutation 成功后的统一失效策略：

- invalidate `["personnel-favorite-summary", personnelId]`
- invalidate `["favorite-personnel-list"]`
- 若当前页面持有服务人员详情聚合 query，也应同步 invalidate 对应详情 query

说明：

- 收藏按钮点击后不能只更新本地按钮文案，必须保证详情页统计区与收藏列表页最终一致
- 如果使用乐观更新，仍需要在成功后做一次权威数据校正

## 9. 移动端页面与路由设计

### 9.1 新增页面

新增页面：

- `apps/mobile-user/app/profile/favorite-personnel.tsx`

页面文案：

- 页面标题继续使用“收藏商户”

页面真实职责：

- 展示当前用户收藏的服务人员列表

这样处理的原因：

- 与当前产品文案保持一致
- 不引入新的 merchant 实体误解到接口层

### 9.2 页面结构

页面包含：

- 顶部导航栏
- 收藏列表
- 空态
- 分页加载更多

单卡片建议展示：

- 头像
- 服务人员名称
- 主服务名
- 评分
- 评论数
- 收藏数
- 一年订单数
- 地址 / 距离 / 最早可约时间

点击行为：

- 点击卡片跳转服务人员详情页
- 透传 `personnelId`、`primaryServiceId`、`primaryPricingId`、`primaryServiceName`

### 9.3 页面空态

当列表为空时显示：

- 空状态插画或占位图
- 文案“暂无收藏商户”
- 次文案说明“去逛逛并收藏感兴趣的服务人员”

按钮建议：

- “去看看”

跳转建议：

- 返回首页或上一个业务入口页
- 不强制回到按摩页，因为收藏能力是全局的

### 9.4 页面加载态

- 首屏使用 skeleton
- 分页使用底部 loading
- 下拉刷新可选，本期建议支持

## 10. 移动端入口设计

### 10.1 按摩 landing 页入口

当前 [massage-landing-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/massage/massage-landing-screen.tsx) 的“收藏商户”入口需要补点击行为：

```ts
router.push("/profile/favorite-personnel");
```

说明：

- 这是一个全局收藏页面入口，不应绑定按摩分类参数

### 10.2 个人中心入口

建议在“我的”页菜单中新增：

- “收藏商户”

位置建议：

- 与“服务地址”“官方客服”等并列

原因：

- 如果只把入口放在按摩 landing 页，能力虽是全局的，但用户心智仍会误以为它只属于按摩
- 个人中心入口才能真正形成全局能力闭环

### 10.3 服务人员详情页入口

当前服务人员详情页收藏按钮需改为真实写操作入口。

约束：

- 该按钮不属于按摩专属组件能力
- 所有服务人员详情页共用同一收藏 mutation hook

按钮状态：

- 未收藏：显示“收藏”
- 已收藏：显示“已收藏”
- 提交中：按钮禁用，避免重复点击

点击规则：

- 未登录用户点击时，先走登录
- 已登录用户执行收藏 / 取消收藏

## 11. 全局复用边界

本次必须实现的“全局可用”边界定义如下：

- 任何进入服务人员详情页的路径，都能使用真实收藏按钮
- 收藏列表页展示的是全局收藏结果，而不是按摩分类专属结果
- 按摩 landing 页只是入口之一
- 个人中心必须提供入口

本次不强制实现的范围：

- 各业务列表卡片上的就地收藏按钮
- 商户维度的独立收藏模型
- Admin Web 收藏管理
- 服务人员端查看谁收藏了自己

## 12. 与现有按摩设计稿的关系

本稿是对 [2026-04-14-massage-real-data-design.md](/mnt/f/home_server/docs/superpowers/specs/2026-04-14-massage-real-data-design.md) 的补充，不替代其主体结论。

需要对旧稿做如下解释修正：

- 旧稿中“全局收藏读态”结论保留
- 旧稿未覆盖收藏写操作与列表页，本稿补齐
- 旧稿中的“收藏商户”文案，实际应理解为“收藏服务人员页面入口文案”
- 旧稿里“按摩页只是全局收藏能力首个消费方”的结论仍然成立

## 13. 测试与验证要求

### 13.1 后端

至少覆盖：

- 收藏成功
- 重复收藏幂等成功
- 取消收藏成功
- 重复取消收藏幂等成功
- 获取收藏读态
- 获取我的收藏列表
- 非法 `personnelId`
- 收藏自己失败

### 13.2 共享 hooks

至少验证：

- mutation 后 summary query 正确失效
- mutation 后 favorite list query 正确失效
- 未登录错误能透传到调用方

### 13.3 移动端

至少验证：

- 按摩详情页点击收藏后文案和收藏数刷新
- 再次点击可取消收藏
- 个人中心能进入“收藏商户”页
- 按摩 landing 页“收藏商户”入口可进入列表页
- 收藏列表页点击卡片能进入详情页
- 其他分类进入的服务人员详情页同样可收藏

## 14. 实施范围控制

本期只做：

- `follow` 模块补写接口和列表接口
- `@repo/types` / `@repo/hooks` 补收藏写与列表能力
- `mobile-user` 补“收藏商户”页面
- `mobile-user` 接通按摩 landing 入口、个人中心入口、服务人员详情页按钮

本期不做：

- 新收藏表
- 商户实体重建
- 多目标收藏体系
- 收藏消息通知
- 收藏排行榜

## 15. 最终结论

本次收藏功能应被定义为：

- 基于现有 `follows` 的全局服务人员收藏能力

其产品表现为：

- 用户可以在任意服务人员详情页执行收藏或取消收藏
- 用户可以在“收藏商户”页面浏览自己已收藏的服务人员
- 按摩页只提供其中一个入口，不承载专属收藏逻辑

这样设计既能满足当前产品文案和需求，也能严格贴合现有数据库与代码结构，避免为了“商户”命名引入不真实的新领域模型。
