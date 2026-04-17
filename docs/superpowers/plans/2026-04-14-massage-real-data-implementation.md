# 按摩频道真实数据与服务标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `apps/mobile-user` 的按摩 landing 页、按摩版技师详情页和通用分类筛选页接入真实后端数据，并把“保健 / 调理”入口改造成真实的服务标签入口；同时建设全局 `service_tags` 数据模型与全局服务人员收藏读态。

**Architecture:** 后端在现有 `home_banners`、`services`、`service_personnel_pricing`、`review`、`follows` 基础上新增全局 `service_tags` 模型，并通过 `services.service_tag_id` 表达当前单标签归属；`massage` 聚合模块负责输出 landing/tagEntries 与 detail/gallery，`follow` 模块负责输出收藏读态。移动端继续复用 [filter.tsx](/mnt/f/home_server/apps/mobile-user/app/category/filter.tsx) 作为筛选页，但补 `serviceTagId` 链路，让按摩页标签点击后的结果被真实收窄；页面加载态统一通过 React Suspense + Skeleton 实现，且严格保持现有 UI 结构不变，只做数据层兼容。

**Tech Stack:** NestJS 11、Drizzle ORM、Zod v4、Jest、React Query v5、Expo Router 6、expo-image、NativeWind

---

## File Map

- Create: `packages/types/src/service-tag.ts`
  定义全局服务标签 schema、列表项 schema 与 `domain` 类型。
- Modify: `packages/types/src/database-entity.ts`
  新增 `ServiceTagsSchema`，并把 `serviceTagId` 加到 `ServicesSchema`。
- Modify: `packages/types/src/service.ts`
  给 `ServiceListRequestSchema` 增加 `serviceTagId`。
- Modify: `packages/types/src/home.ts`
  给 `HomeQuerySchema` 增加 `serviceTagId`。
- Create: `packages/types/src/massage.ts`
  定义按摩 landing/detail 的 query schema、response schema 与 TS 类型。
- Create: `packages/types/src/follow.ts`
  定义全局服务人员收藏读态 schema 与 TS 类型。
- Modify: `packages/types/src/index.ts`
  导出 `service-tag`、`massage`、`follow`。
- Modify: `apps/backend/src/common/database/schema/server.ts`
  新增 `service_tags` 表、`services.service_tag_id` 字段与 relations。
- Modify: `apps/backend/src/common/database/schema/home.ts`
  给 `home_banners` 增加 `scene` 字段。
- Modify: `apps/backend/src/common/database/schema/index.ts`
  统一导出 `server` / `home` schema 变更。
- Create: `apps/backend/drizzle/0067_add_service_tags_and_home_banner_scene.sql`
  创建 `service_tags`、回填初始按摩标签、给 `services` / `home_banners` 加字段。
- Modify: `apps/backend/drizzle/meta/_journal.json`
  登记 migration。
- Create: `apps/backend/src/modules/follow/follow.module.ts`
  注册全局收藏读态能力。
- Create: `apps/backend/src/modules/follow/follow.controller.ts`
  暴露 `GET /follows/personnel/:personnelId/summary`。
- Create: `apps/backend/src/modules/follow/follow.service.ts`
  聚合 `favoriteCount` / `isFavorited`。
- Create: `apps/backend/src/modules/follow/follow.repository.ts`
  直接访问 `follows` 表。
- Create: `apps/backend/src/modules/follow/follow.service.spec.ts`
  覆盖全局收藏读态读接口。
- Create: `apps/backend/src/modules/massage/massage.module.ts`
  注册按摩聚合模块并注入 `FollowModule`。
- Create: `apps/backend/src/modules/massage/massage.controller.ts`
  暴露 `GET /massage/landing` 与 `GET /massage/personnel/:personnelId`。
- Create: `apps/backend/src/modules/massage/massage.service.ts`
  聚合 landing/detail 的领域数据。
- Create: `apps/backend/src/modules/massage/massage.repository.ts`
  负责标签入口、banner、技师详情、gallery fallback 查询。
- Create: `apps/backend/src/modules/massage/massage.service.spec.ts`
  覆盖按摩 landing/detail 主链路。
- Modify: `apps/backend/src/modules/modules.module.ts`
  挂载 `FollowModule` 与 `MassageModule`。
- Modify: `apps/backend/src/modules/order/order.reposityro.ts`
  给 `countOrdersByStaff` 增加可选时间范围，支持“年度订单数”。
- Modify: `apps/backend/src/modules/service/service.repository.ts`
  支持 `serviceTagId` 过滤服务列表。
- Modify: `apps/backend/src/modules/service/service.controller.ts`
  接收 `serviceTagId` 查询参数。
- Modify: `apps/backend/src/modules/service/service.service.ts`
  透传 `serviceTagId`。
- Modify: `apps/backend/src/modules/home/home.repository.ts`
  支持推荐列表按 `serviceTagId` 收窄。
- Modify: `apps/backend/src/modules/home/home.service.ts`
  透传 `serviceTagId` 到推荐查询。
- Modify: `apps/backend/src/modules/home/home.service.spec.ts`
  覆盖 `serviceTagId` 透传。
- Create: `packages/hooks/src/api/massage/index.ts`
  暴露 `useMassageLanding` 与 `useMassagePersonnelDetail`。
- Create: `packages/hooks/src/api/follow/index.ts`
  暴露 `usePersonnelFavoriteSummary`。
- Modify: `packages/hooks/src/api/service/index.ts`
  让 `useServiceList` / `useServiceListSinglePage` 支持 `serviceTagId`。
- Modify: `packages/hooks/src/api/home/index.ts`
  让 `useHomeRecommendations` / `useHomeRecommendationsInfinite` 支持 `serviceTagId`。
- Modify: `packages/hooks/package.json`
  添加 `./api/massage` 与 `./api/follow` export。
- Create: `apps/mobile-user/components/massage/tag-entry-visuals.ts`
  只保留标签视觉映射，按 `tagSlug` 本地决定样式。
- Create: `apps/mobile-user/components/massage/route.ts`
  统一构造 `cat_massage + serviceTagId` 的筛选页路由参数。
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`
  改为消费真实 landing 数据，并在不改变现有 UI 的前提下补 Suspense 骨架屏与标签入口跳转。
- Create: `apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx`
  真实数据版按摩详情组件，沿用现有详情 UI 并补 Suspense 骨架屏。
- Modify: `apps/mobile-user/app/category/filter.tsx`
  接收 `serviceTagId` 并把它打到服务列表 / 推荐接口，保持现有 UI 不变。
- Modify: `apps/mobile-user/app/servicePersonnel/[id].tsx`
  把按摩分支切到真实数据版组件。
- Delete: `apps/mobile-user/components/massage/mock.ts`
  删除旧 mock 数据源。
- Delete: `apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx`
  删除旧 mock 详情组件。

## Task 1: 锁定共享契约与后端骨架

**Files:**

- Create: `packages/types/src/service-tag.ts`
- Create: `packages/types/src/massage.ts`
- Create: `packages/types/src/follow.ts`
- Modify: `packages/types/src/service.ts`
- Modify: `packages/types/src/home.ts`
- Modify: `packages/types/src/index.ts`
- Create: `apps/backend/src/modules/follow/follow.module.ts`
- Create: `apps/backend/src/modules/follow/follow.controller.ts`
- Create: `apps/backend/src/modules/follow/follow.service.ts`
- Create: `apps/backend/src/modules/follow/follow.repository.ts`
- Create: `apps/backend/src/modules/massage/massage.module.ts`
- Create: `apps/backend/src/modules/massage/massage.controller.ts`
- Create: `apps/backend/src/modules/massage/massage.service.ts`
- Create: `apps/backend/src/modules/massage/massage.repository.ts`
- Create: `apps/backend/src/modules/massage/massage.service.spec.ts`
- Modify: `apps/backend/src/modules/home/home.service.spec.ts`
- Modify: `apps/backend/src/modules/modules.module.ts`
- Test: `apps/backend/src/modules/massage/massage.service.spec.ts`
- Test: `apps/backend/src/modules/home/home.service.spec.ts`

- [ ] **Step 1: 先写失败测试，锁定 `tagEntries` 和 `serviceTagId` 的新契约**

```ts
// apps/backend/src/modules/massage/massage.service.spec.ts
import { MassageService } from './massage.service';
import type { MassageRepository } from './massage.repository';
import type { FilesService } from '../files/files.service';
import type { FollowService } from '../follow/follow.service';
import type { ReviewService } from '../review/review.service';

type MockMassageRepository = jest.Mocked<
    Pick<
        MassageRepository,
        | 'getLandingBanner'
        | 'getLandingTagEntries'
        | 'getLandingPersonnelBuckets'
        | 'getPersonnelDetailBase'
        | 'getPersonnelYearlyOrderCount'
    >
>;

describe('MassageService', () => {
    let service: MassageService;
    let repository: MockMassageRepository;

    beforeEach(() => {
        repository = {
            getLandingBanner: jest.fn(),
            getLandingTagEntries: jest.fn(),
            getLandingPersonnelBuckets: jest.fn(),
            getPersonnelDetailBase: jest.fn(),
            getPersonnelYearlyOrderCount: jest.fn(),
        };

        service = new MassageService(
            repository as unknown as MassageRepository,
            { getFileAccessInfo: jest.fn() } as unknown as FilesService,
            {
                getPersonnelFavoriteSummary: jest.fn(),
            } as unknown as FollowService,
            {
                getReviewStats: jest.fn(),
                getTopReviewsByTarget: jest.fn(),
            } as unknown as ReviewService,
        );
    });

    it('getLanding 返回真实 tagEntries 而不是旧 categories', async () => {
        repository.getLandingBanner.mockResolvedValue(null);
        repository.getLandingTagEntries.mockResolvedValue([
            {
                tagId: 'service_tag_massage_health',
                tagName: '保健',
                tagSlug: 'health',
                domain: 'massage',
                serviceCount: 2,
            },
        ]);
        repository.getLandingPersonnelBuckets.mockResolvedValue({
            newcomerPersonnel: [],
            recommendedPersonnel: [],
        });

        const result = await service.getLanding(undefined, {});

        expect(result.tagEntries).toEqual([
            expect.objectContaining({
                tagId: 'service_tag_massage_health',
                tagName: '保健',
            }),
        ]);
        expect(result).not.toHaveProperty('categories');
    });
});
```

```ts
// apps/backend/src/modules/home/home.service.spec.ts
it('getHomeRecommendations 透传 serviceTagId 到 repository', async () => {
    const homeRepository = {
        getOpsConfig: jest.fn(),
        getRecommendedPersonnelGlobal: jest.fn().mockResolvedValue([]),
        getRecommendedPersonnelWithCenter: jest.fn(),
    } as any;

    const service = new HomeService(
        homeRepository,
        {} as any,
        {} as any,
    );

    await service.getHomeRecommendations(undefined, {
        categoryId: 'cat_massage',
        serviceTagId: 'service_tag_massage_health',
        page: 1,
        limit: 20,
    });

    expect(homeRepository.getRecommendedPersonnelGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
            categoryId: 'cat_massage',
            serviceTagId: 'service_tag_massage_health',
        }),
    );
});
```

- [ ] **Step 2: 跑测试确认新契约尚未实现**

Run: `pnpm --filter backend test -- src/modules/massage/massage.service.spec.ts src/modules/home/home.service.spec.ts --runInBand`

Expected: FAIL，报出 `getLandingTagEntries`、`tagEntries`、`serviceTagId` 或相关类型尚未实现。

- [ ] **Step 3: 写最小共享契约与模块骨架**

```ts
// packages/types/src/service-tag.ts
import { z } from 'zod/v4';

export const ServiceTagDomainEnum = z.enum(['massage']);

export const ServiceTagSchema = z.object({
    id: z.string().max(255),
    name: z.string().max(100),
    slug: z.string().max(100),
    domain: ServiceTagDomainEnum,
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
    description: z.string().nullable().default(null),
});

export const ServiceTagEntrySchema = z.object({
    tagId: z.string().max(255),
    tagName: z.string().max(100),
    tagSlug: z.string().max(100),
    domain: ServiceTagDomainEnum,
    serviceCount: z.number().int().min(0),
});
```

```ts
// packages/types/src/massage.ts
import { z } from 'zod/v4';
import { ServiceTagEntrySchema } from './service-tag';

export const MassageLandingQuerySchema = z.object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    addressText: z.string().max(255).optional(),
});

export const MassageLandingResponseSchema = z.object({
    banner: z
        .object({
            title: z.string().nullable(),
            imageUrl: z.string().url().nullable(),
            imageBlurhash: z.string().nullable().optional(),
            linkType: z.enum(['route', 'url', 'none']),
            linkTarget: z.string().nullable().optional(),
        })
        .nullable(),
    tagEntries: z.array(ServiceTagEntrySchema),
    newcomerPersonnel: z.array(z.object({ personnelId: z.string().max(255) })),
    recommendedPersonnel: z.array(
        z.object({ personnelId: z.string().max(255) }),
    ),
});
```

```ts
// packages/types/src/service.ts
export const ServiceListRequestSchema = z.object({
    ...PaginationQuerySchema.shape,
    categoryId: z.string().max(255).optional(),
    serviceTagId: z.string().max(255).optional(),
    keyword: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});
```

```ts
// packages/types/src/home.ts
export const HomeQuerySchema = z.object({
    page: z.number().int().min(1).default(1),
    categoryId: z.string().max(255).optional(),
    serviceTagId: z.string().max(255).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    addressText: z.string().max(255).optional(),
    maxDistanceKm: z.number().min(0).max(100).default(10),
    limit: z.number().int().min(1).max(50).default(20),
});
```

```ts
// apps/backend/src/modules/massage/massage.service.ts
async getLanding(userId: string | undefined, query: MassageLandingQuery) {
    const [banner, tagEntries, personnelBuckets] =
        await Promise.all([
            this.repository.getLandingBanner(),
            this.repository.getLandingTagEntries(),
            this.repository.getLandingPersonnelBuckets(userId, query),
        ]);

    return {
        banner,
        tagEntries,
        newcomerPersonnel: personnelBuckets.newcomerPersonnel,
        recommendedPersonnel: personnelBuckets.recommendedPersonnel,
    };
}
```

- [ ] **Step 4: 重新跑测试确认骨架通过**

Run: `pnpm --filter backend test -- src/modules/massage/massage.service.spec.ts src/modules/home/home.service.spec.ts --runInBand`

Expected: PASS，`MassageService` 现在返回 `tagEntries`，`HomeService` 能透传 `serviceTagId`。

- [ ] **Step 5: 提交骨架**

```bash
git add packages/types/src/service-tag.ts packages/types/src/massage.ts packages/types/src/follow.ts packages/types/src/service.ts packages/types/src/home.ts packages/types/src/index.ts apps/backend/src/modules/follow apps/backend/src/modules/massage apps/backend/src/modules/home/home.service.spec.ts apps/backend/src/modules/modules.module.ts
git commit -m "feat(massage): add service tag contracts and module skeleton"
```

## Task 2: 落地 Drizzle schema 与 migration

**Files:**

- Modify: `apps/backend/src/common/database/schema/server.ts`
- Modify: `apps/backend/src/common/database/schema/home.ts`
- Modify: `apps/backend/src/common/database/schema/index.ts`
- Create: `apps/backend/drizzle/0067_add_service_tags_and_home_banner_scene.sql`
- Modify: `apps/backend/drizzle/meta/_journal.json`
- Modify: `packages/types/src/database-entity.ts`
- Test: `pnpm --filter backend type-check`

- [ ] **Step 1: 在 Drizzle schema 中新增 `service_tags` 和 `services.service_tag_id`**

```ts
// apps/backend/src/common/database/schema/server.ts
export const serviceTags = pgTable(
    'service_tags',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        name: varchar('name', { length: 100 }).notNull(),
        slug: varchar('slug', { length: 100 }).notNull(),
        domain: varchar('domain', { length: 50 }).notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        description: text('description'),
    },
    (table) => [
        index('idx_service_tags_domain_order').on(
            table.domain,
            table.sortOrder,
            table.id,
        ),
        index('uq_service_tags_domain_slug').on(table.domain, table.slug),
    ],
);

export const services = pgTable(
    'services',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        categoryId: varchar('category_id', { length: 255 })
            .notNull()
            .references(() => serviceCategories.id, { onDelete: 'restrict' }),
        serviceTagId: varchar('service_tag_id', { length: 255 }).references(
            () => serviceTags.id,
            { onDelete: 'set null' },
        ),
        name: varchar('name', { length: 100 }).notNull(),
        description: text('description'),
        imageFileId: varchar('image_file_id', { length: 255 }).references(
            () => files.id,
            { onDelete: 'set null' },
        ),
        isActive: boolean('is_active').default(true).notNull(),
    },
    (table) => [
        index('idx_services_service_tag').on(table.serviceTagId, table.id),
        index('idx_services_name_active')
            .using('pgroonga', table.name)
            .where(sql`is_active = true`),
    ],
);
```

- [ ] **Step 2: 给 `home_banners` 增加 `scene` 并补 migration**

```ts
// apps/backend/src/common/database/schema/home.ts
scene: varchar('scene', { length: 20 }).default('home').notNull(),
```

```sql
-- apps/backend/drizzle/0067_add_service_tags_and_home_banner_scene.sql
CREATE TABLE "service_tags" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "slug" varchar(100) NOT NULL,
    "domain" varchar(50) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "description" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_tags_domain_slug"
ON "service_tags" ("domain","slug");
--> statement-breakpoint
CREATE INDEX "idx_service_tags_domain_order"
ON "service_tags" ("domain","sort_order","id");
--> statement-breakpoint
ALTER TABLE "services"
ADD COLUMN "service_tag_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "services"
ADD CONSTRAINT "services_service_tag_id_service_tags_id_fk"
FOREIGN KEY ("service_tag_id") REFERENCES "public"."service_tags"("id")
ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "idx_services_service_tag"
ON "services" ("service_tag_id","id");
--> statement-breakpoint
ALTER TABLE "home_banners"
ADD COLUMN "scene" varchar(20) DEFAULT 'home' NOT NULL;
--> statement-breakpoint
INSERT INTO "service_tags" ("id", "name", "slug", "domain", "sort_order", "is_active")
VALUES
    ('service_tag_massage_health', '保健', 'health', 'massage', 10, true),
    ('service_tag_massage_conditioning', '调理', 'conditioning', 'massage', 20, true)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: 同步 Zod entity schema，保证前后端字段名一致**

```ts
// packages/types/src/database-entity.ts
export const ServiceTagsSchema = z.object({
    id: z.string().max(255),
    name: z.string().max(100),
    slug: z.string().max(100),
    domain: z.string().max(50),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
    description: z.string().nullable().default(null),
});

export const ServicesSchema = z.object({
    id: z.string().max(255),
    categoryId: z.string().max(255),
    serviceTagId: z.string().max(255).nullable().optional(),
    name: z.string().max(100),
    description: z.string().nullable().optional(),
    imageFileId: z.string().max(255).nullable().optional(),
    imageFileUrl: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
});
```

- [ ] **Step 4: 跑后端类型检查确认 schema 变更闭合**

Run: `pnpm --filter backend type-check`

Expected: PASS，`serviceTags`、`serviceTagId`、`scene` 在 backend/types 两侧都能编译通过。

- [ ] **Step 5: 提交 migration**

```bash
git add apps/backend/src/common/database/schema/server.ts apps/backend/src/common/database/schema/home.ts apps/backend/src/common/database/schema/index.ts apps/backend/drizzle/0067_add_service_tags_and_home_banner_scene.sql apps/backend/drizzle/meta/_journal.json packages/types/src/database-entity.ts
git commit -m "feat(database): add service tags and massage banner scene"
```

## Task 3: 实现全局收藏读态与按摩详情聚合

**Files:**

- Create: `apps/backend/src/modules/follow/follow.service.spec.ts`
- Create: `apps/backend/src/modules/follow/follow.repository.ts`
- Create: `apps/backend/src/modules/follow/follow.service.ts`
- Create: `apps/backend/src/modules/follow/follow.controller.ts`
- Create: `apps/backend/src/modules/follow/follow.module.ts`
- Modify: `apps/backend/src/modules/massage/massage.service.spec.ts`
- Create: `apps/backend/src/modules/massage/massage.repository.ts`
- Create: `apps/backend/src/modules/massage/massage.service.ts`
- Create: `apps/backend/src/modules/massage/massage.controller.ts`
- Create: `apps/backend/src/modules/massage/massage.module.ts`
- Modify: `apps/backend/src/modules/order/order.reposityro.ts`
- Modify: `apps/backend/src/modules/modules.module.ts`
- Test: `apps/backend/src/modules/follow/follow.service.spec.ts`
- Test: `apps/backend/src/modules/massage/massage.service.spec.ts`

- [ ] **Step 1: 先写失败测试，锁定收藏读态和 detail/gallery fallback**

```ts
// apps/backend/src/modules/follow/follow.service.spec.ts
import { FollowService } from './follow.service';

describe('FollowService', () => {
    it('返回 favoriteCount 和 isFavorited', async () => {
        const repository = {
            countFavoritesByPersonnelId: jest.fn().mockResolvedValue(12),
            existsActiveFavorite: jest.fn().mockResolvedValue(true),
        } as any;

        const service = new FollowService(repository);
        const result = await service.getPersonnelFavoriteSummary(
            'personnel_1',
            'user_1',
        );

        expect(result).toEqual({
            personnelId: 'personnel_1',
            favoriteCount: 12,
            isFavorited: true,
        });
    });
});
```

```ts
// apps/backend/src/modules/massage/massage.service.spec.ts
it('detail 在当前服务没有 gallery 时回退到同技师其他服务的 gallery', async () => {
    repository.getPersonnelDetailBase.mockResolvedValue({
        personnelId: 'personnel_1',
        personnelName: '王师傅',
        avatarFileId: null,
        galleryFileIds: ['file_gallery_1'],
        addressText: '黄冈市',
        distanceText: null,
        availableTimeText: null,
        description: '擅长中式推拿',
        guaranteeItems: [],
        stats: {
            yearsOfExperience: 1,
            averageServiceQuality: null,
            repurchaseRate: null,
            goodRatePercentage: 100,
        },
        reviewSummary: {
            averageRating: 5,
            totalReviews: 1,
            averageAttitude: 5,
            averageSkill: 5,
            customerSatisfactionRate: 100,
        },
        services: [],
    });
    repository.getPersonnelYearlyOrderCount.mockResolvedValue(20);
    filesService.getFileAccessInfo.mockResolvedValue({
        fileUrl: 'https://example.com/gallery.jpg',
        blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    });
    followService.getPersonnelFavoriteSummary.mockResolvedValue({
        personnelId: 'personnel_1',
        favoriteCount: 9,
        isFavorited: false,
    });
    reviewService.getTopReviewsByTarget.mockResolvedValue([]);

    const result = await service.getPersonnelDetail(undefined, 'personnel_1', {
        serviceId: 'svc_1',
    });

    expect(result.galleryImages).toEqual([
        expect.objectContaining({
            url: 'https://example.com/gallery.jpg',
        }),
    ]);
    expect(result.favoriteCount).toBe(9);
});
```

- [ ] **Step 2: 跑测试确认 detail/follow 尚未实现**

Run: `pnpm --filter backend test -- src/modules/follow/follow.service.spec.ts src/modules/massage/massage.service.spec.ts --runInBand`

Expected: FAIL，提示 `FollowService`、`getPersonnelDetail` 或 gallery/favorite 聚合未实现。

- [ ] **Step 3: 实现 follow 模块与 detail 聚合**

```ts
// apps/backend/src/modules/follow/follow.service.ts
async getPersonnelFavoriteSummary(
    personnelId: string,
    userId?: string,
) {
    const [favoriteCount, isFavorited] = await Promise.all([
        this.repository.countFavoritesByPersonnelId(personnelId),
        userId
            ? this.repository.existsActiveFavorite(userId, personnelId)
            : Promise.resolve(false),
    ]);

    return {
        personnelId,
        favoriteCount,
        isFavorited,
    };
}
```

```ts
// apps/backend/src/modules/massage/massage.service.ts
async getPersonnelDetail(
    userId: string | undefined,
    personnelId: string,
    query: MassagePersonnelDetailQuery,
) {
    const base = await this.repository.getPersonnelDetailBase(personnelId, query);
    if (!base) {
        throw new NotFoundException('按摩技师不存在');
    }

    const [favoriteSummary, yearlyOrderCount, topReviews] = await Promise.all([
        this.followService.getPersonnelFavoriteSummary(personnelId, userId),
        this.repository.getPersonnelYearlyOrderCount(personnelId),
        this.reviewService.getTopReviewsByTarget('personnel', personnelId),
    ]);

    const galleryImages = await Promise.all(
        (base.galleryFileIds ?? []).map(async (fileId) => {
            const file = await this.filesService.getFileAccessInfo(fileId);
            return {
                url: file.fileUrl,
                blurhash: file.blurhash ?? null,
            };
        }),
    );

    return {
        personnelId: base.personnelId,
        personnelName: base.personnelName,
        avatarUrl: null,
        avatarBlurhash: null,
        galleryImages,
        addressText: base.addressText,
        distanceText: base.distanceText,
        availableTimeText: base.availableTimeText,
        yearlyOrderCount,
        favoriteCount: favoriteSummary.favoriteCount,
        isFavorited: favoriteSummary.isFavorited,
        description: base.description,
        guaranteeItems: base.guaranteeItems,
        stats: base.stats,
        reviewSummary: base.reviewSummary,
        services: base.services,
        topReviews,
    };
}
```

- [ ] **Step 4: 跑测试确认 detail/follow 通过**

Run: `pnpm --filter backend test -- src/modules/follow/follow.service.spec.ts src/modules/massage/massage.service.spec.ts --runInBand`

Expected: PASS，收藏读态和 detail 聚合都能返回真实结构。

- [ ] **Step 5: 提交 detail/follow**

```bash
git add apps/backend/src/modules/follow apps/backend/src/modules/massage apps/backend/src/modules/order/order.reposityro.ts apps/backend/src/modules/modules.module.ts
git commit -m "feat(massage): add follow summary and detail aggregation"
```

## Task 4: 打通服务标签过滤链路并实现按摩 landing 聚合

**Files:**

- Modify: `apps/backend/src/modules/service/service.repository.ts`
- Modify: `apps/backend/src/modules/service/service.service.ts`
- Modify: `apps/backend/src/modules/service/service.controller.ts`
- Modify: `apps/backend/src/modules/home/home.repository.ts`
- Modify: `apps/backend/src/modules/home/home.service.ts`
- Modify: `apps/backend/src/modules/home/home.service.spec.ts`
- Modify: `apps/backend/src/modules/massage/massage.service.spec.ts`
- Modify: `apps/backend/src/modules/massage/massage.repository.ts`
- Modify: `apps/backend/src/modules/massage/massage.service.ts`
- Modify: `apps/backend/src/modules/massage/massage.controller.ts`
- Test: `apps/backend/src/modules/home/home.service.spec.ts`
- Test: `apps/backend/src/modules/massage/massage.service.spec.ts`

- [ ] **Step 1: 先写失败测试，锁定 `serviceTagId` 过滤和 landing/tagEntries 聚合**

```ts
// apps/backend/src/modules/massage/massage.service.spec.ts
it('getLanding 会返回按 sortOrder 排序的 tagEntries', async () => {
    repository.getLandingBanner.mockResolvedValue(null);
    repository.getLandingTagEntries.mockResolvedValue([
        {
            tagId: 'service_tag_massage_conditioning',
            tagName: '调理',
            tagSlug: 'conditioning',
            domain: 'massage',
            serviceCount: 3,
        },
        {
            tagId: 'service_tag_massage_health',
            tagName: '保健',
            tagSlug: 'health',
            domain: 'massage',
            serviceCount: 2,
        },
    ]);
    repository.getLandingPersonnelBuckets.mockResolvedValue({
        newcomerPersonnel: [],
        recommendedPersonnel: [],
    });

    const result = await service.getLanding(undefined, {});

    expect(result.tagEntries.map((item) => item.tagSlug)).toEqual([
        'conditioning',
        'health',
    ]);
});
```

```ts
// apps/backend/src/modules/home/home.service.spec.ts
it('带坐标时也会把 serviceTagId 透传给地理推荐查询', async () => {
    const homeRepository = {
        getOpsConfig: jest.fn(),
        getRecommendedPersonnelGlobal: jest.fn(),
        getRecommendedPersonnelWithCenter: jest.fn().mockResolvedValue([]),
    } as any;

    const service = new HomeService(
        homeRepository,
        {} as any,
        {} as any,
    );

    await service.getHomeRecommendations(undefined, {
        categoryId: 'cat_massage',
        serviceTagId: 'service_tag_massage_conditioning',
        lat: 30.1,
        lng: 114.3,
        page: 1,
        limit: 20,
    });

    expect(
        homeRepository.getRecommendedPersonnelWithCenter,
    ).toHaveBeenCalledWith(
        expect.objectContaining({
            categoryId: 'cat_massage',
            serviceTagId: 'service_tag_massage_conditioning',
        }),
    );
});
```

- [ ] **Step 2: 在服务列表、推荐列表和按摩 landing 仓储里实现标签过滤**

```ts
// apps/backend/src/modules/service/service.repository.ts
async getServices({
    categoryId,
    serviceTagId,
    keyword,
    isActive,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}: ServiceListRequest) {
    const serviceConditions: SQL[] = [];

    if (serviceTagId) {
        serviceConditions.push(eq(services.serviceTagId, serviceTagId));
    }

    if (isActive !== undefined) {
        serviceConditions.push(eq(services.isActive, isActive));
    }

    // 其余逻辑保持不变
}
```

```ts
// apps/backend/src/modules/home/home.repository.ts
async getRecommendedPersonnelGlobal({
    limit,
    offset,
    categoryId,
    serviceTagId,
    excludePersonnelUserId,
}: {
    limit: number;
    offset: number;
    categoryId?: string;
    serviceTagId?: string;
    excludePersonnelUserId?: string;
}) {
    const conditions: SQL[] = [eq(services.isActive, true)];

    if (categoryId) {
        conditions.push(eq(services.categoryId, categoryId));
    }
    if (serviceTagId) {
        conditions.push(eq(services.serviceTagId, serviceTagId));
    }

    // 保持原有推荐排序与 join，只补过滤条件
}
```

```ts
// apps/backend/src/modules/massage/massage.repository.ts
async getLandingTagEntries() {
    return await this.db
        .select({
            tagId: serviceTags.id,
            tagName: serviceTags.name,
            tagSlug: serviceTags.slug,
            domain: serviceTags.domain,
            serviceCount: sql<number>`count(${services.id})::int`,
        })
        .from(serviceTags)
        .leftJoin(
            services,
            and(
                eq(services.serviceTagId, serviceTags.id),
                eq(services.isActive, true),
            ),
        )
        .where(
            and(
                eq(serviceTags.domain, 'massage'),
                eq(serviceTags.isActive, true),
            ),
        )
        .groupBy(serviceTags.id)
        .orderBy(asc(serviceTags.sortOrder), asc(serviceTags.id));
}
```

- [ ] **Step 3: 在 controller/service/query schema 中补 `serviceTagId`**

```ts
// apps/backend/src/modules/service/service.controller.ts
@UsePipes(new ZodValidationPipe(ServiceListRequestSchema))
async getServices(@Query() query: ServiceListRequest) {
    return await this.serviceService.getServices(query);
}
```

```ts
// apps/backend/src/modules/home/home.service.ts
const { maxDistanceKm = 10, limit = 20, page = 1, lat, lng, categoryId, serviceTagId } = query;

// 两个推荐分支都透传 serviceTagId
```

```ts
// apps/backend/src/modules/massage/massage.service.ts
async getLanding(userId: string | undefined, query: MassageLandingQuery) {
    const [banner, tagEntries, personnelBuckets] =
        await Promise.all([
            this.repository.getLandingBanner(),
            this.repository.getLandingTagEntries(),
            this.repository.getLandingPersonnelBuckets(userId, query),
        ]);

    return {
        banner,
        tagEntries,
        newcomerPersonnel: personnelBuckets.newcomerPersonnel,
        recommendedPersonnel: personnelBuckets.recommendedPersonnel,
    };
}
```

- [ ] **Step 4: 跑测试确认 landing 与 `serviceTagId` 过滤通过**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts src/modules/massage/massage.service.spec.ts --runInBand`

Expected: PASS，`serviceTagId` 在推荐查询里可透传，`GET /massage/landing` 返回真实 `tagEntries`。

- [ ] **Step 5: 提交 landing 与过滤链路**

```bash
git add apps/backend/src/modules/service/service.repository.ts apps/backend/src/modules/service/service.service.ts apps/backend/src/modules/service/service.controller.ts apps/backend/src/modules/home/home.repository.ts apps/backend/src/modules/home/home.service.ts apps/backend/src/modules/home/home.service.spec.ts apps/backend/src/modules/massage/massage.repository.ts apps/backend/src/modules/massage/massage.service.ts apps/backend/src/modules/massage/massage.controller.ts
git commit -m "feat(massage): add service tag filtering and landing aggregation"
```

## Task 5: 新增 hooks 并打通分类筛选页标签参数

**Files:**

- Create: `packages/hooks/src/api/massage/index.ts`
- Create: `packages/hooks/src/api/follow/index.ts`
- Modify: `packages/hooks/src/api/service/index.ts`
- Modify: `packages/hooks/src/api/home/index.ts`
- Modify: `packages/hooks/package.json`
- Create: `apps/mobile-user/components/massage/route.ts`
- Modify: `apps/mobile-user/app/category/filter.tsx`
- Test: `pnpm --filter mobile-user type-check`

- [ ] **Step 1: 在 hooks 层补 `serviceTagId` 和按摩接口**

```ts
// packages/hooks/src/api/service/index.ts
...(restParams.serviceTagId
    ? { serviceTagId: restParams.serviceTagId }
    : {}),
```

```ts
// packages/hooks/src/api/home/index.ts
...(params.serviceTagId !== undefined
    ? { serviceTagId: params.serviceTagId }
    : {}),
```

```ts
// packages/hooks/src/api/massage/index.ts
export const useMassageLanding = (
    params: Partial<MassageLandingQuery> = {},
) =>
    useSuspenseQuery({
        queryKey: ['massage-landing', params],
        queryFn: async () => {
            const response = await apiClient.get<MassageLandingResponse>(
                '/massage/landing',
                {
                    query: {
                        ...(params.lat !== undefined
                            ? { lat: params.lat.toString() }
                            : {}),
                        ...(params.lng !== undefined
                            ? { lng: params.lng.toString() }
                            : {}),
                        ...(params.addressText
                            ? { addressText: params.addressText }
                            : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: '按摩落地页获取失败',
        },
    });
```

- [ ] **Step 2: 新增按摩标签路由 helper，并让筛选页吃到 `serviceTagId`**

```ts
// apps/mobile-user/components/massage/route.ts
export const MASSAGE_CATEGORY_ID = 'cat_massage';

export function createMassageTagFilterRouteParams(input: {
    tagId: string;
    tagName: string;
    tagDomain: 'massage';
}) {
    return {
        categoryId: MASSAGE_CATEGORY_ID,
        categoryName: '上门按摩',
        serviceTagId: input.tagId,
        serviceTagName: input.tagName,
        serviceTagDomain: input.tagDomain,
    };
}
```

```ts
// apps/mobile-user/app/category/filter.tsx
const params = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    defaultTabName?: string;
    defaultServiceId?: string;
    serviceTagId?: string;
    serviceTagName?: string;
    serviceTagDomain?: string;
}>();

const serviceTagId = params.serviceTagId
    ? String(params.serviceTagId)
    : undefined;

const serviceListQuery = useServiceListSinglePage({
    categoryId,
    serviceTagId,
    isActive: true,
    limit: 1,
    page: 1,
    enabled: Boolean(categoryId) && isTransitionSettled,
});

const recommendationsQuery = useHomeRecommendationsInfinite(
    {
        categoryId,
        ...(serviceTagId ? { serviceTagId } : {}),
        ...(resolvedCoords
            ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
            : {}),
        limit: 20,
    },
    {
        enabled:
            isTransitionSettled &&
            activeTabKey === RECOMMEND_TAB_KEY &&
            Boolean(categoryId),
    },
);
```

- [ ] **Step 3: 跑移动端类型检查确认 hooks + route params 闭合**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，`serviceTagId` 在 hooks、筛选页和按摩路由 helper 三处都能通过类型检查。

- [ ] **Step 4: 提交 hooks 与筛选页链路**

```bash
git add packages/hooks/src/api/massage/index.ts packages/hooks/src/api/follow/index.ts packages/hooks/src/api/service/index.ts packages/hooks/src/api/home/index.ts packages/hooks/package.json apps/mobile-user/components/massage/route.ts apps/mobile-user/app/category/filter.tsx
git commit -m "feat(mobile-user): wire massage tag filter through shared hooks"
```

## Task 6: 改造按摩 landing / 详情 UI 并移除旧 mock

**Files:**

- Create: `apps/mobile-user/components/massage/tag-entry-visuals.ts`
- Modify: `apps/mobile-user/components/massage/massage-landing-screen.tsx`
- Create: `apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx`
- Modify: `apps/mobile-user/app/servicePersonnel/[id].tsx`
- Delete: `apps/mobile-user/components/massage/mock.ts`
- Delete: `apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx`
- Test: `pnpm --filter mobile-user type-check`

- [ ] **Step 1: 改造 landing 页数据接入方式，但严格复用当前 JSX 结构，并补 Suspense 骨架屏**

```ts
// apps/mobile-user/components/massage/tag-entry-visuals.ts
export const MASSAGE_TAG_VISUALS = {
    health: {
        titleColor: '#234f95',
        description: '放松身心\n缓解疲劳',
        backgroundColor: '#eef6ff',
        imageSource: require('@/assets/images/massage-personnel-white.png'),
    },
    conditioning: {
        titleColor: '#704600',
        description: '放松身心\n缓解疲劳',
        backgroundColor: '#fff4e7',
        imageSource: require('@/assets/images/massage-personnel-blue.png'),
    },
} as const;
```

```tsx
// apps/mobile-user/components/massage/massage-landing-screen.tsx
function MassageLandingScreenContent() {
    const landingQuery = useMassageLanding(
        resolvedCoords
            ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
            : {},
    );

    // 保留当前 MassageLandingScreen 的 ScrollView / banner / entryBar /
    // coupons / category scroll / newcomer / merchants 结构不变，
    // 只把 MASSAGE_PAGE_MOCK 中对应的数据替换成接口数据。
    const categoryCards = landingQuery.data.tagEntries.map((tag) => {
        const visual =
            MASSAGE_TAG_VISUALS[
                tag.tagSlug as keyof typeof MASSAGE_TAG_VISUALS
            ];

        return {
            id: tag.tagId,
            title: tag.tagName,
            description: visual.description,
            titleColor: visual.titleColor,
            descriptionColor: visual.descriptionColor,
            gradientFrom: visual.gradientFrom,
            gradientTo: visual.gradientTo,
            imageSource: visual.imageSource,
            imageClassName: visual.imageClassName,
            maskSource: visual.maskSource,
            maskClassName: visual.maskClassName,
            onPress: () =>
                router.push({
                    pathname: '/category/filter',
                    params: createMassageTagFilterRouteParams({
                        tagId: tag.tagId,
                        tagName: tag.tagName,
                        tagDomain: tag.domain,
                    }),
                }),
        };
    });

    return (
        <View>
            {/* 此处保留现有页面树，只把 categoryCards / banner / newcomerCards / merchants 数据源改成真实接口 */}
        </View>
    );
}

function MassageLandingSkeleton() {
    return (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="relative h-[130px]" />
            <View className="-mt-[37px] px-4">
                <Skeleton className="h-[121px] rounded-[12px]" />
                <Skeleton className="mt-3 h-[55px] rounded-[10px]" />
                <View className="mt-3 rounded-[10px] bg-white px-4 pb-[11px] pt-3">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <View className="mt-2 flex-row justify-between">
                        <Skeleton className="h-[78px] w-[65px] rounded-[12px]" />
                        <Skeleton className="h-[78px] w-[65px] rounded-[12px]" />
                        <Skeleton className="h-[78px] w-[65px] rounded-[12px]" />
                        <Skeleton className="h-[78px] w-[65px] rounded-[12px]" />
                    </View>
                </View>
                <View className="mt-3 flex-row gap-[13px]">
                    <Skeleton className="h-[102px] w-[184px] rounded-[10px]" />
                    <Skeleton className="h-[102px] w-[184px] rounded-[10px]" />
                </View>
                <View className="mt-3 rounded-[10px] bg-white px-4 pb-4 pt-3">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <View className="mt-3 flex-row justify-between">
                        <Skeleton className="h-[72px] w-[53px] rounded-[8px]" />
                        <Skeleton className="h-[72px] w-[53px] rounded-[8px]" />
                        <Skeleton className="h-[72px] w-[53px] rounded-[8px]" />
                        <Skeleton className="h-[72px] w-[53px] rounded-[8px]" />
                    </View>
                </View>
                <View className="mt-3 rounded-[8px] bg-white px-4 pb-1 pt-4">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <View className="mt-4">
                        <Skeleton className="h-[92px] w-full rounded-[8px]" />
                        <Skeleton className="mt-4 h-[92px] w-full rounded-[8px]" />
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

// export function MassageLandingScreen()
<Suspense fallback={<MassageLandingSkeleton />}>
    <MassageLandingScreenContent />
</Suspense>
```

约束：

- 必须保留当前 [massage-landing-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/massage/massage-landing-screen.tsx) 的区块顺序、容器层级、间距和组件拆分
- 只允许把 `MASSAGE_PAGE_MOCK` 中的 landing 数据替换成真实数据或本地视觉映射结果
- 骨架屏尺寸、圆角、区块顺序必须对齐现有页面结构
- 不允许借接入真实数据调整现有布局

- [ ] **Step 2: 把按摩详情页切到真实接口，但严格复用当前 mock 详情组件的布局结构**

```tsx
// apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx
function MassageServicePersonnelScreenContent() {
    const detailQuery = useMassagePersonnelDetail(
        routeParams.id,
        {
            serviceId: routeParams.serviceId,
            pricingId: routeParams.pricingId,
        },
    );

    // 直接以 mock-service-personnel-screen.tsx 当前组件树为底稿复制到新文件：
    // 1. 保留 hero 区、头像区、收藏按钮、统计区、保障区、项目区、评价区的 JSX 顺序
    // 2. 把 getMassageServicePersonnelDetail(personnelId) 替换成 detailQuery.data
    // 3. 把 heroImageSource/avatarImageSource 替换成 galleryImages[0] / avatarUrl
    // 4. 把 reviews / services / guaranteeItems / stats / reviewSummary 都映射到现有 UI 字段
    const detail = detailQuery.data;
    const galleryImages = detail.galleryImages;
    const primaryGalleryImage = galleryImages[0] ?? null;
    const orderedServices = detail.services;
    const normalizedReviews = detail.topReviews;
}

function MassageServicePersonnelSkeleton() {
    return (
        <ScrollView className="flex-1">
            <Skeleton className="h-[384px] w-full rounded-none" />
            <View className="-mt-16 rounded-t-[24px] bg-white">
                <View className="px-4 pt-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-row">
                            <Skeleton className="h-16 w-16 rounded-[14px]" />
                            <View className="ml-4 pt-1">
                                <Skeleton className="h-6 w-28 rounded-md" />
                                <Skeleton className="mt-2 h-3 w-32 rounded" />
                            </View>
                        </View>
                        <Skeleton className="h-9 w-20 rounded-full" />
                    </View>
                    <View className="mt-4 flex-row justify-between">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                    </View>
                </View>
                <View className="px-4 pb-3 pt-2">
                    <Skeleton className="h-20 w-full rounded-[8px]" />
                    <Skeleton className="mt-3 h-4 w-full rounded" />
                    <Skeleton className="mt-2 h-4 w-3/4 rounded" />
                </View>
                <Skeleton className="h-[35px] w-full rounded-none" />
                <View className="h-4" />
                <Skeleton className="h-[50px] w-full rounded-none" />
                <Skeleton className="h-[128px] w-full rounded-none" />
                <Skeleton className="h-[128px] w-full rounded-none" />
            </View>
        </ScrollView>
    );
}

约束：

- 必须以 [mock-service-personnel-screen.tsx](/mnt/f/home_server/apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx) 为现有 UI 底稿
- 不允许新建抽象占位布局组件替代现有结构
- 只允许替换数据来源、图片来源、收藏状态和轮播数据
```

```tsx
// apps/mobile-user/components/massage/massage-landing-screen.tsx
{categoryCards.map((tag) => (
    <Pressable key={tag.id} onPress={tag.onPress}>
        <CategoryCard item={tag} />
    </Pressable>
))}
```

```tsx
// apps/mobile-user/app/servicePersonnel/[id].tsx
if (searchParams.mock === 'massage') {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ resetErrorBoundary }) => (
                        <ServiceDetailError
                            onRetry={resetErrorBoundary}
                            bottomInset={insets.bottom}
                        />
                    )}
                >
                    <MassageServicePersonnelScreen />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}
```

- [ ] **Step 3: 删除旧 mock 数据源并跑移动端类型检查**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，`mock.ts` 与 `mock-service-personnel-screen.tsx` 删除后，按摩页和详情页仍能通过类型检查，且骨架屏 / Suspense 类型无误。

- [ ] **Step 4: 提交 UI 切换**

```bash
git add apps/mobile-user/components/massage/tag-entry-visuals.ts apps/mobile-user/components/massage/massage-landing-screen.tsx apps/mobile-user/components/service-personnel/massage-service-personnel-screen.tsx apps/mobile-user/app/servicePersonnel/[id].tsx
git rm apps/mobile-user/components/massage/mock.ts apps/mobile-user/components/service-personnel/mock-service-personnel-screen.tsx
git commit -m "feat(mobile-user): switch massage screens to real tag-driven data"
```

## Task 7: 综合验证与收尾

**Files:**

- Review: `docs/superpowers/specs/2026-04-14-massage-real-data-design.md`
- Review: `docs/superpowers/plans/2026-04-14-massage-real-data-implementation.md`

- [ ] **Step 1: 跑后端关键测试**

Run: `pnpm --filter backend test -- src/modules/follow/follow.service.spec.ts src/modules/home/home.service.spec.ts src/modules/massage/massage.service.spec.ts --runInBand`

Expected: PASS，收藏读态、推荐列表 `serviceTagId` 透传、按摩 landing/detail 聚合都通过。

- [ ] **Step 2: 跑类型检查**

Run: `pnpm --filter backend type-check`

Expected: PASS，NestJS / Drizzle / `@repo/types` 一侧没有类型错误。

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，移动端按摩 landing、分类筛选页、按摩详情页都通过。

- [ ] **Step 3: 手工验证核心链路**

Run: `pnpm mobile-user:dev`

Expected:

- 进入按摩页时 banner 优先展示后端 `scene = 'massage'` 的 banner，没有再用默认图。
- 按摩 landing 与按摩详情在数据返回前都会展示与当前布局对齐的骨架屏。
- landing 标签入口来自真实 `service_tags`，点击“保健 / 调理”会进入 `/category/filter`。
- 进入筛选页后，推荐态和顶部服务 tabs 都只展示当前 `serviceTagId` 下的数据。
- 进入按摩详情页后，顶部轮播图来自真实 `galleryImages`。
- 页面布局、区块顺序、视觉层级与现有 UI 保持一致。

- [ ] **Step 4: 记录当前期边界**

```md
- 已实现：service_tags + services.service_tag_id、home_banners.scene、全局收藏读态、按摩 landing/tagEntries、按摩 detail/gallery、分类筛选页 serviceTagId、Suspense 骨架屏加载态
- 未实现：service_tags 管理端、服务绑定标签管理端、标签视觉元数据、收藏写接口、多标签归属
```

- [ ] **Step 5: 提交最终验证说明**

```bash
git add docs/superpowers/plans/2026-04-14-massage-real-data-implementation.md
git commit -m "docs(massage): rewrite implementation plan for service tags"
```
