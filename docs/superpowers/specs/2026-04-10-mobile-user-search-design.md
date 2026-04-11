# 移动端用户端搜索链路设计

## 背景

当前用户端首页顶部搜索框仅为静态展示，未承接真实搜索行为。[首页入口](/mnt/f/home_server/apps/mobile-user/app/(tabs)/index.tsx:896) 已占据核心流量位置，因此需要补齐一套可扩展的搜索链路，覆盖以下场景：

- 用户从首页进入搜索页，先看历史记录与候选词；
- 用户可输入任意关键词直接搜索；
- 若关键词命中某个服务人员姓名，则结果页只展示该服务人员可提供的服务；
- 若关键词未唯一命中服务人员姓名，则结果页展示可提供相关服务的服务人员列表。

本设计第一版聚焦移动端用户端，不改动管理端与服务人员端。

## 目标

- 将首页静态搜索框改造为可跳转的真实搜索入口；
- 提供独立搜索页，承载历史记录、候选词与直接提交；
- 提供独立结果页，承接一个已确认的搜索词；
- 后端新增统一搜索能力，避免前端并发拼装多个接口；
- 第一版保持结果页语义清晰，不做服务与人员的统一混排。

## 非目标

- 不在首页内联展示搜索结果；
- 不实现统一 relevance 混排；
- 不引入复杂的个性化推荐权重；
- 不在第一版支持多种高级筛选条件；
- 不在第一版处理热门搜索运营配置后台。

## 用户流程

### 1. 首页入口

- 用户点击首页顶部搜索输入框区域；
- 页面跳转到搜索页 `/search`；
- 首页不保留输入态，也不发起搜索请求。

### 2. 搜索页

- 默认展示历史记录；
- 用户输入后，前端对输入值做 `300ms` 防抖；
- 防抖后请求候选词接口；
- 用户可通过两种方式进入结果页：
- 点击候选词；
- 键盘直接提交任意关键词。

### 3. 结果页

- 结果页固定接收一个已确认的 `keyword`；
- 结果页不自行猜测业务意图，完全依据后端返回的 `mode` 渲染；
- 后端返回两种模式之一：
- `personnel_services`：唯一命中一个服务人员，页面只展示该人员可提供的服务；
- `personnel_list`：未命中唯一服务人员，页面展示可提供相关服务的服务人员列表。

## 前端页面设计

### 搜索页 `/search`

职责：

- 承载输入框、历史记录、候选词；
- 维护本地输入态；
- 调用候选词接口；
- 将最终搜索词路由到结果页。

页面状态：

- 默认态：历史记录；
- 输入中：显示输入值与清空按钮；
- 候选态：展示候选词列表；
- 空态：无候选词时展示空提示；
- 错误态：候选词接口失败时展示轻量错误提示，不阻塞直接提交。

交互规则：

- 点击历史记录项，直接进入结果页；
- 点击候选词：
- 若候选词为服务人员，路由带上 `personnelId`；
- 若候选词为服务项，路由带上 `serviceId`；
- 用户直接提交：
- 仅传 `keyword`；
- 不额外要求必须命中候选词。

建议路由：

- `/search`
- `/search/result`

### 结果页 `/search/result`

职责：

- 接收 URL 参数；
- 调用统一搜索接口；
- 根据后端 `mode` 渲染不同结果布局；
- 负责分页加载更多。

URL 参数：

- `keyword`：必传；
- `personnelId`：可选，来自人员候选词点击；
- `serviceId`：可选，来自服务候选词点击。

渲染规则：

- `mode = personnel_services`
- 头部展示服务人员基础信息；
- 主体展示该服务人员可提供的服务列表；
- 点击某个服务进入当前既有的服务详情/预约流转。
- `mode = personnel_list`
- 页面展示服务人员卡片列表；
- 列表结构与现有分类筛选页、首页推荐卡片尽量复用；
- 支持分页加载更多。

## 后端接口设计

### 1. 候选词接口

`GET /home/search/suggestions`

用途：

- 搜索页输入联想；
- 返回轻量候选数据，不返回大结果集。

请求参数：

```ts
type HomeSearchSuggestionsQuery = {
    keyword: string;
    lat?: number;
    lng?: number;
    limit?: number;
};
```

响应结构：

```ts
type HomeSearchSuggestionResponse = {
    suggestions: Array<{
        type: "personnel" | "service";
        label: string;
        subtitle?: string;
        personnelId?: string;
        serviceId?: string;
    }>;
};
```

返回规则：

- 服务人员候选：匹配人员姓名；
- 服务候选：匹配服务名称；
- 同类候选按相关性排序；
- 第一版总量建议 `limit <= 10`。

### 2. 统一搜索接口

`GET /home/search`

用途：

- 结果页真实搜索；
- 返回判别式结果，不要求前端自行决定渲染类型。

请求参数：

```ts
type HomeSearchQuery = {
    keyword: string;
    lat?: number;
    lng?: number;
    page?: number;
    limit?: number;
    personnelId?: string;
    serviceId?: string;
};
```

响应结构：

```ts
type HomeSearchResponse =
    | {
          mode: "personnel_services";
          keyword: string;
          matchedPersonnel: {
              id: string;
              name: string;
              avatarUrl?: string | null;
              avatarBlurhash?: string | null;
          };
          services: Array<{
              serviceId: string;
              serviceName: string;
              pricingId?: string;
              price?: number;
              estimatedDurationMinutes?: number;
              categoryId?: string;
          }>;
      }
    | {
          mode: "personnel_list";
          keyword: string;
          serviceHint?: {
              serviceId?: string;
              serviceName?: string;
          };
          personnel: Array<{
              personnelId: string;
              name: string;
              avatarUrl?: string | null;
              avatarBlurhash?: string | null;
              serviceId?: string;
              serviceName?: string;
              pricingId?: string;
              minPrice?: number;
              distanceKm?: number;
              addressText?: string;
              workDays?: string;
              workStartTime?: string;
              workEndTime?: string;
          }>;
          page: number;
          limit: number;
          hasMore: boolean;
          nextPage: number | null;
      };
```

## 搜索判定规则

### 高优先级显式命中

当请求参数带有 `personnelId` 时：

- 直接返回 `personnel_services`；
- 不再根据 `keyword` 做额外猜测；
- 用于候选词点击进入结果页的高置信路径。

当请求参数带有 `serviceId` 时：

- 直接以该服务为搜索目标；
- 返回 `personnel_list`；
- 列出能提供该服务的服务人员。

### 任意关键词直接提交

当只有 `keyword` 时，后端执行如下流程：

1. 对关键词做标准化：
- `trim`；
- 归一化连续空格；
- 大小写归一。
2. 执行服务人员姓名精确匹配；
3. 若唯一命中一个服务人员，返回 `personnel_services`；
4. 若未命中或命中多个同名人员，转入服务搜索；
5. 服务搜索命中后，返回 `personnel_list`。

这里的“精确匹配”仅指第一版对标准化后姓名的等值匹配，不引入拼音、别名、模糊人名纠错。

## 数据来源与仓库分工

### 服务搜索

可复用现有服务搜索能力：

- [service hook](/mnt/f/home_server/packages/hooks/src/api/service/index.ts:209)
- [service repository](/mnt/f/home_server/apps/backend/src/modules/service/service.repository.ts:326)

后端可沿用 `services.name`、`services.description` 的关键字检索能力，先获得命中的 `serviceId` 集合。

### 服务人员搜索

现有服务人员查询以 `serviceId + 地理位置` 为核心输入：

- [service-personnel hook](/mnt/f/home_server/packages/hooks/src/api/service-personnel/index.ts:105)
- [service-personnel filter schema](/mnt/f/home_server/packages/types/src/work-skill.ts:211)

需要在仓库层补充两类能力：

- `findPersonnelByExactName(keyword)`：用于唯一人员命中；
- `findPersonnelByServiceIds(serviceIds, lat/lng, page/limit)`：用于根据相关服务反查服务人员。

### 首页模块聚合

建议将搜索接口放在 `home` 模块下，与首页推荐同属用户端发现链路，便于后续复用坐标、地址与搜索历史能力：

- [home controller](/mnt/f/home_server/apps/backend/src/modules/home/home.controller.ts:47)

## 搜索历史

第一版建议只做客户端本地历史：

- 存储介质：移动端本地存储；
- 数量建议：最多保留 10 条；
- 去重策略：标准化后去重，保留最近一次搜索；
- 支持单条删除与全部清空。

不建议第一版将历史上收至服务端，原因是该功能不影响搜索主链路，且会引入登录态同步、匿名态归并与隐私处理成本。

## 错误处理

搜索页：

- 候选词接口失败时，只展示轻量错误提示；
- 用户仍可直接提交任意关键词；
- 不因为联想失败而阻断搜索主流程。

结果页：

- 若 `personnel_services` 未找到人员或人员无可售服务，展示明确空态；
- 若 `personnel_list` 无结果，展示“未找到相关服务人员”；
- 分页加载失败时保留已加载数据，并提供重试入口。

## 性能要求

- 候选词接口应保持轻量，单次返回小结果集；
- 搜索页输入请求需做防抖；
- 结果页只在 `keyword` 或显式 `personnelId/serviceId` 变化时重查；
- 结果页分页使用增量加载，避免一次性拉取大列表。

## 第一版边界

第一版明确不做以下能力：

- 服务结果与人员结果混排；
- 拼音搜索、别名搜索、错别字纠正；
- 高级筛选条件叠加到搜索结果页；
- 搜索结果排序个性化；
- 服务端热门搜索与用户云端历史同步。

## 测试策略

后端：

- 覆盖 `personnelId` 显式命中；
- 覆盖 `serviceId` 显式命中；
- 覆盖关键词唯一命中服务人员；
- 覆盖关键词未命中人员、命中服务；
- 覆盖关键词同时命中多个同名人员时降级为 `personnel_list`；
- 覆盖空结果与分页。

前端：

- 搜索页默认态、候选态、错误态；
- 点击历史记录进入结果页；
- 点击人员候选词进入 `personnel_services`；
- 点击服务候选词进入 `personnel_list`；
- 直接提交任意关键词；
- 结果页两种 `mode` 的渲染分支与空态。

## 实施建议

建议实现顺序：

1. 定义 `packages/types` 的 query/response schema；
2. 在 `home` 模块新增 `suggestions` 与 `search` controller/service；
3. 在 `service-personnel` 与 `service` repository 补齐搜索仓库能力；
4. 在 `packages/hooks` 增加搜索 hooks；
5. 新增 `/search` 与 `/search/result` 页面；
6. 将首页顶部搜索框改为跳转入口；
7. 补充前后端测试。

## 结论

第一版采用“首页入口 -> 搜索页 -> 结果页”的三段式搜索链路。后端提供两个接口：候选词接口与统一搜索接口。结果页不做统一混排，而是由后端根据显式参数或唯一人员命中规则返回 `personnel_services` 或 `personnel_list`。该方案能在保证语义清晰的前提下，最小化前端状态复杂度，并为后续扩展混排、热词、个性化排序预留空间。
