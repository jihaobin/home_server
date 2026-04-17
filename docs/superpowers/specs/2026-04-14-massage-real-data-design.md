# 按摩频道真实数据与服务标签设计稿

> 目标：让 [apps/mobile-user/app/massage/index.tsx](/mnt/f/home_server/apps/mobile-user/app/massage/index.tsx) 和 [apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx) 脱离本地 mock，改为消费后台真实数据；同时把按摩 landing 页中的“保健 / 调理”一类入口定义为真实的服务标签入口，点击后跳转到通用分类筛选页并按标签过滤结果。

## 1. 设计结论

本次设计按“真实业务语义优先、避免过度运营配置”收敛：

- 不新增任何 `massage_channel_*` 表
- 不给 `service_personnel` 增加 `heroImageFileId`
- 按摩详情页顶部大图继续复用现有服务 `gallery`
- 按摩 landing 页 banner 继续复用 `home_banners`
- `home_banners` 增加 `scene` 字段区分首页与按摩页
- 按摩页只是 `cat_massage` 分类的独立展示页，不引入按摩专属服务、服务人员、服务分类数据模型
- 按摩页中的服务、服务人员、服务分类、定价、评价、收藏均复用现有共享数据表和查询链路
- 新增全局服务标签模型 `service_tags`
- 在 `services` 上增加 `service_tag_id`
- 当前一条服务最多属于一个标签
- 标签按业务域分组，本期按摩页使用 `domain = 'massage'`
- 标签是后台维护的真实业务数据，但管理端维护能力不在本次实现计划内
- 标签永远不承载图片、渐变色、副标题等视觉元数据
- 页面接入真实数据后必须提供加载骨架屏
- 加载骨架屏必须通过 React Suspense fallback 实现
- 页面 UI 严格保持现有像素稿结构与视觉，不允许借接真实数据之机调整布局、层级、文案层次或新增展示模块

这意味着本期重点不只是“接入真实数据”，还包括把按摩 landing 页里的两个标签入口改成真实业务入口。

## 2. 现有能力复用

### 2.1 可直接复用

- 服务人员详情能力
  - 现有 `GET /service-personnel/getServiceDetails`
  - 现有 `ServicePersonnelService.getPersonnelServiceDetails(...)`
  - 已能返回某个服务的 `gallery`、`topReviews`
- 服务人员资料聚合能力
  - 现有 `ServicePersonnelService.getPersonnelProfile(...)`
  - 已能返回服务人员的多服务列表、各服务 gallery、定价信息
- 首页运营位
  - `home_banners`
- 服务目录和定价
  - `service_categories`
  - `services`
  - `service_personnel_pricing`
- 收藏底表
  - `follows`
- 文件能力
  - 已支持预签名 URL + blurhash
- 通用分类筛选页
  - [apps/mobile-user/app/category/filter.tsx](/mnt/f/home_server/apps/mobile-user/app/category/filter.tsx)
  - 已支持 `categoryId`、`defaultServiceId` 驱动的服务筛选与技师列表

### 2.2 页面边界

- 当前“上门按摩”只是现有服务分类体系中的一个分类页面
- 该页面复用现有 `services`、`service_personnel`、`service_categories`、`service_personnel_pricing`、`reviews`、`follows`
- `massage` 模块只是面向按摩分类页的聚合接口层，不代表按摩拥有独立数据域
- `service_tags.domain = 'massage'` 只是标签分组维度，不表示服务、服务人员、分类数据隔离

### 2.3 不再新增的内容

以下内容从本次方案中移除：

- `massage_channel_banners`
- `massage_channel_category_cards`
- `massage_channel_featured_services`
- `massage_channel_featured_personnel`
- `service_personnel.heroImageFileId`
- 标签视觉元数据字段，例如标签图片、标签渐变色、标签副标题

原因很直接：

- 当前需求关注的是“标签的作用”，不是“标签的装修”
- 标签图片和颜色不应进入后端模型
- 现有 `home/service/service_personnel/pricing/review/follows` 已足够支撑真实化
- 新增 `service_tags` 已经覆盖当前所需的业务语义，继续引入装修配置只会放大范围

## 3. 推荐方案

### 方案 A：全局服务标签 + 服务单标签归属

做法：

- 新增全局 `service_tags` 表
- `service_tags` 通过 `domain` 区分业务域，例如 `massage`
- 在 `services` 上增加 `service_tag_id`
- 按摩 landing 返回真实标签入口列表
- 点击标签后跳到通用分类筛选页，并带上 `serviceTagId`
- 分类筛选页和聚合接口补充标签过滤能力

优点：

- 标签成为真实业务数据
- 当前“一服务一个标签”可直接满足需求
- 后续其他业务域也能复用，不会被“按摩专属设计”锁死
- 将来若扩展成多标签，再升级关联关系即可

缺点：

- 需要数据库变更
- 需要把标签过滤条件打通到前后端查询链路

结论：

- 本期采用

### 方案 B：在 `services` 上加字符串/枚举字段

优点：

- 实现更快

缺点：

- 标签不是实体，无法自然进入后台维护
- 后续一旦要做排序、启停、域隔离，会很快失控
- 会把真实业务模型做成临时常量

结论：

- 本期不采用

### 方案 C：把“保健 / 调理”塞进 `service_categories`

优点：

- 能复用一部分现有分类筛选逻辑

缺点：

- 语义错误
- 分类树和标签语义会混在一起
- 后续会干扰服务目录、筛选 Tab 和运营入口的职责边界

结论：

- 本期不采用

## 4. 设计原则

- 不新增按摩专属运营表
- 不新增服务人员头图字段
- 标签是全局服务能力，不是按摩专属能力
- 标签必须按业务域分组
- `domain` 只用于标签分组，不用于隔离服务、服务人员、服务分类主数据
- 当前一条服务最多只属于一个标签
- 标签只承载业务语义，不承载视觉元数据
- 页面 UI 改造只允许做数据兼容，不允许重构现有视觉结构
- 数据加载态统一使用骨架屏，不使用空白页或纯文字“加载中”替代
- 骨架屏需与最终页面结构对齐，避免首屏布局跳变
- landing 页优先取后端 banner，没有再用前端默认图
- 详情页顶部视觉继续复用 `gallery` 轮播
- 收藏能力设计成全局服务人员收藏
- 按摩页只是全局服务标签能力和全局收藏能力的首个消费方

## 5. 数据模型设计

### 5.1 新增 `service_tags`

建议新增表：

- `service_tags`

建议字段：

- `id`
- `name`
- `slug`
- `domain`
- `sort_order`
- `is_active`
- `description` 可选
- `created_at`
- `updated_at`

字段约束建议：

- `domain` 非空，例如 `massage`
- 同一 `domain` 下 `slug` 唯一
- `sort_order` 用于 landing 页入口排序
- `is_active = false` 的标签不应出现在客户端入口列表中

职责：

- 表达“某个业务域下有哪些可用标签分组”
- 作为服务标签归属和 landing 标签入口的唯一真实来源

### 5.2 修改 `services`

建议新增字段：

- `service_tag_id`

约束：

- 允许为 `null`
- 当前一条服务最多关联一个标签
- 该标签需属于当前业务允许的 `domain`

表达关系：

- “泰式按摩” 这种具体服务可以归属到“调理”
- “中式推拿” 这种具体服务可以归属到“保健”

职责边界：

- `service_categories` 继续表达服务分类归属
- `service_tags` 表达业务域内的标签归属
- 标签归属不会改变服务、服务人员、服务分类本身的共享数据来源

### 5.3 后续扩展路径

本期不做多对多。

如果未来一条服务需要同时属于多个标签，再把：

- `services.service_tag_id`

升级成：

- `service_tag_bindings`

本次设计不提前实现这条路径，也不为此增加多余字段。

## 6. 接口设计

### 6.1 按摩 landing

新增：

- `GET /massage/landing`

查询参数建议：

- `lat?: number`
- `lng?: number`
- `addressText?: string`

建议响应结构：

```ts
type MassageLandingResponse = {
    banner: {
        title: string | null;
        imageUrl: string | null;
        imageBlurhash?: string | null;
        linkType: "route" | "url" | "none";
        linkTarget?: string | null;
    } | null;
    tagEntries: Array<{
        tagId: string;
        tagName: string;
        tagSlug: string;
        domain: "massage";
        serviceCount: number;
    }>;
    newcomerPersonnel: Array<MassageLandingPersonnelCard>;
    recommendedPersonnel: Array<MassageLandingPersonnelCard>;
};

type MassageLandingPersonnelCard = {
    personnelId: string;
    name: string;
    avatarUrl: string | null;
    avatarBlurhash?: string | null;
    serviceId: string | null;
    pricingId: string | null;
    serviceName: string | null;
    ratingValue: number;
    reviewCount: number;
    orderCountLabel: string | null;
    favoriteCount: number;
    distanceText: string | null;
    availableTimeText: string | null;
};
```

说明：

- `banner` 来自 `home_banners`，按 `scene = 'massage'` 过滤
- `tagEntries` 来自 `service_tags`
- 只返回 `domain = 'massage'` 且 `is_active = true` 的标签
- `serviceCount` 用于过滤空标签或决定是否展示
- 标签身份和点击后的筛选结果来自真实数据
- 标签长什么样仍由前端本地渲染，不进入接口模型
- `newcomerPersonnel` 和 `recommendedPersonnel` 由后端按固定规则聚合
- 若 `banner` 为 `null`，前端使用默认 banner 图

### 6.2 按摩详情

新增：

- `GET /massage/personnel/:personnelId`

查询参数建议：

- `serviceId?: string`
- `pricingId?: string`
- `lat?: number`
- `lng?: number`

建议响应结构：

```ts
type MassagePersonnelDetailResponse = {
    personnelId: string;
    personnelName: string;
    avatarUrl: string | null;
    avatarBlurhash?: string | null;
    galleryImages: Array<{
        url: string;
        blurhash?: string | null;
    }>;
    addressText: string;
    distanceText: string | null;
    availableTimeText: string | null;
    yearlyOrderCount: number;
    favoriteCount: number;
    isFavorited: boolean;
    description: string | null;
    guaranteeItems: string[];
    stats: {
        yearsOfExperience: number;
        averageServiceQuality: number | null;
        repurchaseRate: number | null;
        goodRatePercentage: number;
    };
    reviewSummary: {
        averageRating: number;
        totalReviews: number;
        averageAttitude: number | null;
        averageSkill: number | null;
        customerSatisfactionRate: number;
    };
    services: Array<{
        serviceId: string;
        serviceName: string;
        pricingId: string | null;
        tags: string[];
        durationMinutes: number | null;
        price: number | null;
        originalPrice: number | null;
        imageUrl: string | null;
        imageBlurhash?: string | null;
        actionLabel: string;
        highlightLabel?: string | null;
    }>;
    topReviews: Array<{
        id: string;
        rating: number;
        ratingLabel: string | null;
        comment: string;
        reviewerName: string | null;
        createdAt: string;
        images: Array<{
            url: string;
            blurhash?: string | null;
        }>;
    }>;
};
```

说明：

- `galleryImages` 来自当前选中服务的 `gallery`
- 若当前 `serviceId` 没有 gallery，则回退到该服务人员第一个有 gallery 的服务
- 不设计单独的 `heroImageUrl`

### 6.3 全局收藏读态

新增：

- `GET /follows/personnel/:personnelId/summary`

建议响应结构：

```ts
type PersonnelFavoriteSummaryResponse = {
    personnelId: string;
    favoriteCount: number;
    isFavorited: boolean;
};
```

说明：

- 目标对象是任意 `service_personnel`
- 不限制服务分类
- 按摩页只是首个消费方

## 7. 移动端跳转与筛选链路

### 7.1 标签入口语义

按摩 landing 页中的两个入口应定义为：

- 面向按摩分类页的服务标签入口

它们不是：

- banner
- 服务分类树节点
- 服务项目卡片
- 技师头像

点击行为：

- 跳转到通用分类筛选页
- 但携带标签参数，让筛选页只展示该标签下的服务与技师

### 7.2 跳转参数

建议从按摩页跳转：

```ts
router.push({
    pathname: "/category/filter",
    params: {
        categoryId: MASSAGE_CATEGORY_ID,
        categoryName: "上门按摩",
        serviceTagId: tag.id,
        serviceTagName: tag.name,
        serviceTagDomain: tag.domain,
    },
});
```

含义：

- `categoryId`：继续锁定“按摩大类”
- `serviceTagId`：表达“只看这个标签下的服务”
- `serviceTagName`：用于前端标题或上下文文案
- `serviceTagDomain`：显式表达标签所在业务域，便于校验和调试

### 7.3 分类筛选页行为

现有 [apps/mobile-user/app/category/filter.tsx](/mnt/f/home_server/apps/mobile-user/app/category/filter.tsx) 保持复用，不新增按摩专属筛选页。

行为调整：

- 若没有 `serviceTagId`
  - 保持现有逻辑不变
- 若有 `serviceTagId`
  - 顶部服务 tabs 只展示该标签下的服务
  - 推荐态只展示该标签下的服务人员
  - 切到具体服务 tab 后，技师搜索继续按服务查人

这意味着：

- `serviceTagId` 先收窄服务集合
- 再沿用原有推荐态与服务 tab 逻辑

### 7.4 加载态约束

- 按摩 landing 页、按摩详情页以及本次改造涉及到的分类筛选页数据加载态，统一使用骨架屏
- 骨架屏通过 React Suspense fallback 承载，不额外发明独立 loading 分支
- 骨架屏结构应尽量贴近现有页面布局，保证真实数据返回前后页面骨架稳定
- 骨架屏只解决加载体验，不允许借此修改现有页面的 UI 结构

## 8. 后端改动范围

### 8.1 必改：`home_banners` 增加场景字段

建议修改：

- `apps/backend/src/common/database/schema/home.ts`
- `apps/backend/drizzle/*`

建议新增字段：

- `scene: varchar('scene', { length: 20 }).default('home').notNull()`

建议取值：

- `home`
- `massage`

用途：

- 复用一张 `home_banners` 表支撑不同页面 banner

### 8.2 必改：新增全局服务标签模型

建议修改：

- `apps/backend/src/common/database/schema/service.ts`
- `apps/backend/src/common/database/schema/index.ts`
- `apps/backend/drizzle/*`

新增内容：

- `service_tags`
- `services.service_tag_id`

职责：

- 提供按业务域分组的标签数据
- 提供服务与标签的归属关系
- 支撑 landing 标签入口与分类筛选过滤
- 不引入按摩专属服务、服务人员、服务分类主数据模型

### 8.3 必改：新增 `massage` 聚合模块

新增目录：

- `apps/backend/src/modules/massage/massage.controller.ts`
- `apps/backend/src/modules/massage/massage.service.ts`
- `apps/backend/src/modules/massage/massage.repository.ts`
- `apps/backend/src/modules/massage/massage.module.ts`

职责：

- `landing` 聚合 banner、标签入口、人员卡片
- `detail` 聚合 gallery、服务列表、评价、收藏读态
- 仅是面向按摩分类页的聚合接口层，不是独立数据域

### 8.4 必改：新增 `follow` 模块

新增目录：

- `apps/backend/src/modules/follow/follow.controller.ts`
- `apps/backend/src/modules/follow/follow.service.ts`
- `apps/backend/src/modules/follow/follow.repository.ts`
- `apps/backend/src/modules/follow/follow.module.ts`

职责：

- 输出全局服务人员收藏读态

### 8.5 必改：服务查询链路补标签过滤

建议修改：

- 服务列表查询接口与仓储
- 推荐/聚合查询接口与仓储
- 分类筛选页所依赖的 hooks 与类型

职责：

- 支持 `serviceTagId` 过滤
- 保证按摩 landing 标签跳转后，筛选结果被真实收窄

### 8.6 必改：新增共享契约和 hooks

新增：

- `packages/types/src/massage.ts`
- `packages/types/src/follow.ts`

建议新增或修改：

- `packages/types/src/service.ts`
- `packages/hooks/src/api/massage/index.ts`
- `packages/hooks/src/api/follow/index.ts`
- `packages/hooks/src/api/service/index.ts`
- `packages/hooks/src/api/service-personnel/*`

## 9. landing 页数据来源

### 9.1 banner

- 来源：`home_banners`
- 规则：查询 `scene = 'massage'` 且 `is_active = true`
- 前端处理：优先用接口返回；没有再用默认图

### 9.2 标签入口

- 来源：`service_tags`
- 规则：
  - `domain = 'massage'`
  - `is_active = true`
  - 按 `sort_order` 排序
- 关联：
  - 通过 `services.service_tag_id` 统计服务数量
- 前端处理：
  - 用真实标签数据决定入口身份和点击行为
  - 视觉仍由前端本地实现

说明：

- `domain = 'massage'` 只表示当前页面消费按摩这组标签
- 服务、服务人员、服务分类、定价、评价、收藏仍然来自现有共享模型

### 9.3 新人上线 / 推荐商户

不做运营配置表，先按固定规则生成：

- `newcomerPersonnel`
  - 有按摩服务定价
  - 年度订单数较少
  - 按评分、距离、订单数综合排序
- `recommendedPersonnel`
  - 有按摩服务定价
  - 按评分、订单数、距离综合排序

说明：

- “推荐商户”仍按推荐服务人员返回
- 后续如果业务真要“商户”实体，再单开需求

## 10. 详情页轮播图策略

顶部轮播图不新增头图字段，直接复用现有 gallery：

- 首选当前选中服务 `serviceId` 的 gallery
- 为空时回退到服务人员其他服务的第一组 gallery
- 前端按摩详情页改为轮播组件消费 `galleryImages`

## 11. 管理端边界

### 11.1 本期不做

以下能力不放进本次实现计划：

- `service_tags` 管理页面
- 服务绑定标签的管理端表单
- 标签启停、排序、编辑的管理端交互

### 11.2 下一期范围

下一阶段管理端需要补：

- 标签管理
  - 新增 / 编辑 / 启停 `service_tags`
  - 维护 `name`、`slug`、`domain`、`sortOrder`
- 服务绑定标签
  - 在服务管理页面为服务选择 `serviceTag`
  - 当前为单选

说明：

- 标签属于后台维护的真实业务数据
- 只是管理端交付优先级低于当前移动端真实化

## 12. 验收标准

### 12.1 按摩详情页

- 不再依赖本地 mock 详情数据
- 顶部轮播图来自真实 `gallery`
- 服务列表、评分、评论、收藏读态来自真实接口

### 12.2 按摩 landing 页

- banner 优先来自后端 `home_banners`
- 没有 banner 数据时才使用前端默认图
- 标签入口来自真实 `service_tags`
- 首屏加载时展示与现有布局对齐的骨架屏
- 点击标签后会进入通用分类筛选页
- 进入筛选页后结果会按 `serviceTagId` 真实收窄

### 12.3 领域约束

- 收藏能力是全局服务人员收藏
- 标签能力是全局服务标签能力，按摩页只是首个消费方
- 标签按业务域分组
- 按摩页只是 `cat_massage` 的独立展示页，不是独立数据域
- 当前一条服务最多只属于一个标签
- 不新增 `massage_channel_*` 表
- 不新增 `service_personnel.heroImageFileId`
- 不为标签设计任何视觉元数据字段
- 页面 UI 只做数据层兼容，不改现有视觉结构
