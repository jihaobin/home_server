# 移动端用户搜索聚合链路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `apps/mobile-user` 落地“首页搜索入口 -> 搜索页 -> 结果页”的聚合搜索链路，支持历史记录、候选词联想、服务人员唯一命中以及相关服务人员列表。

**Architecture:** 后端继续以 `home` 模块承接用户端发现链路，新增 `GET /home/search/suggestions` 与 `GET /home/search` 两个接口；`home` 只做聚合编排，服务搜索能力由 `service` 模块提供，服务人员搜索能力由 `service-personnel` 模块提供。前端新增 `/search` 与 `/search/result` 两个 Expo Router 页面，历史记录落到 `MMKV`，结果页仅根据后端 `mode` 渲染，不自行猜意图。

**Tech Stack:** NestJS 11、Drizzle ORM、Zod v4、React Query v5、Expo Router 6、React Native MMKV、NativeWind

---

## File Map

- Modify: `packages/types/src/home.ts`
  新增搜索 query / suggestion / result 的 Zod schema 与 TypeScript 类型。
- Modify: `apps/backend/src/modules/home/home.controller.ts`
  暴露 `GET /home/search/suggestions` 与 `GET /home/search`。
- Modify: `apps/backend/src/modules/home/home.service.ts`
  编排搜索判定逻辑，返回 `personnel_services` 或 `personnel_list`。
- Modify: `apps/backend/src/modules/home/home.module.ts`
  注入 `ServicePersonnelModule`，让 `HomeService` 能调用服务人员搜索能力。
- Create: `apps/backend/src/modules/home/home.service.spec.ts`
  覆盖三条主路径：`personnelId`、`serviceId`、任意 `keyword`。
- Modify: `apps/backend/src/modules/service/service.service.ts`
  暴露轻量服务搜索方法，供 `home` 聚合使用。
- Modify: `apps/backend/src/modules/service/service.repository.ts`
  新增按关键词返回服务列表、按 ID 查询激活服务的方法。
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.ts`
  暴露人员候选、精确姓名命中、按服务 ID 搜索服务人员、按人员 ID 取服务列表等方法。
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.repository.ts`
  新增人员姓名候选、精确命中、按服务 ID 反查服务人员的仓库查询。
- Modify: `packages/hooks/src/api/home/index.ts`
  新增搜索页与结果页 hooks。
- Create: `apps/mobile-user/lib/search-history.ts`
  基于 `MMKV` 管理搜索历史的增删查清空。
- Create: `apps/mobile-user/app/search/index.tsx`
  搜索页，展示历史记录、候选词、支持直接提交。
- Create: `apps/mobile-user/app/search/result.tsx`
  结果页，根据 `mode` 渲染“人员服务列表”或“相关服务人员列表”。
- Create: `apps/mobile-user/components/search/SearchSuggestionList.tsx`
  搜索页候选词列表。
- Create: `apps/mobile-user/components/search/SearchHistorySection.tsx`
  搜索页历史记录区。
- Create: `apps/mobile-user/components/search/SearchPersonnelList.tsx`
  `personnel_list` 模式结果列表。
- Create: `apps/mobile-user/components/search/SearchPersonnelServices.tsx`
  `personnel_services` 模式结果列表。
- Modify: `apps/mobile-user/app/_layout.tsx`
  注册 `/search` 与 `/search/result` 路由。
- Modify: `apps/mobile-user/app/(tabs)/index.tsx`
  将首页静态搜索框改成跳转入口。

## Task 1: 定义搜索契约并锁定后端编排测试

**Files:**
- Modify: `packages/types/src/home.ts`
- Create: `apps/backend/src/modules/home/home.service.spec.ts`
- Modify: `apps/backend/src/modules/home/home.module.ts`
- Test: `apps/backend/src/modules/home/home.service.spec.ts`

- [ ] **Step 1: 先写 `HomeService` 的失败测试**

```ts
// apps/backend/src/modules/home/home.service.spec.ts
import { HomeService } from './home.service';
import type { HomeRepository } from './home.repository';
import type { ServiceService } from '../service/service.service';
import type { ServicePersonnelService } from '../service-personnel/service-personnel.service';

type MockHomeRepository = jest.Mocked<Pick<HomeRepository, 'getOpsConfig'>>;
type MockServiceService = jest.Mocked<
    Pick<ServiceService, 'searchActiveServicesByKeyword' | 'findActiveServiceById'>
>;
type MockServicePersonnelService = jest.Mocked<
    Pick<
        ServicePersonnelService,
        | 'findSearchPersonnelSuggestions'
        | 'findExactPersonnelByName'
        | 'searchPersonnelByServiceIds'
        | 'getPersonnelServicesSummary'
    >
>;

describe('HomeService.search', () => {
    let service: HomeService;
    let homeRepository: MockHomeRepository;
    let serviceService: MockServiceService;
    let servicePersonnelService: MockServicePersonnelService;

    beforeEach(() => {
        homeRepository = { getOpsConfig: jest.fn() };
        serviceService = {
            searchActiveServicesByKeyword: jest.fn(),
            findActiveServiceById: jest.fn(),
        };
        servicePersonnelService = {
            findSearchPersonnelSuggestions: jest.fn(),
            findExactPersonnelByName: jest.fn(),
            searchPersonnelByServiceIds: jest.fn(),
            getPersonnelServicesSummary: jest.fn(),
        };

        service = new HomeService(
            homeRepository as unknown as HomeRepository,
            serviceService as unknown as ServiceService,
            servicePersonnelService as unknown as ServicePersonnelService,
        );
    });

    it('带 personnelId 时返回 personnel_services', async () => {
        servicePersonnelService.getPersonnelServicesSummary.mockResolvedValue({
            matchedPersonnel: {
                id: 'personnel_1',
                name: '王师傅',
                avatarUrl: null,
                avatarBlurhash: null,
            },
            services: [
                {
                    serviceId: 'svc_1',
                    serviceName: '肩颈按摩',
                    pricingId: 'price_1',
                    price: 168,
                    estimatedDurationMinutes: 60,
                    categoryId: 'cat_massage',
                },
            ],
        });

        const result = await service.search(undefined, {
            keyword: '王师傅',
            personnelId: 'personnel_1',
        });

        expect(result.mode).toBe('personnel_services');
        expect(servicePersonnelService.getPersonnelServicesSummary).toHaveBeenCalledWith(
            'personnel_1',
        );
    });

    it('serviceId 命中时返回 personnel_list', async () => {
        serviceService.findActiveServiceById.mockResolvedValue({
            id: 'svc_cleaning',
            name: '家庭保洁',
        } as any);
        servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
            personnel: [],
            page: 1,
            limit: 20,
            hasMore: false,
            nextPage: null,
        });

        const result = await service.search(undefined, {
            keyword: '家庭保洁',
            serviceId: 'svc_cleaning',
            page: 1,
            limit: 20,
        });

        expect(result.mode).toBe('personnel_list');
        expect(result.serviceHint?.serviceId).toBe('svc_cleaning');
    });

    it('关键词唯一命中人员姓名时返回 personnel_services', async () => {
        servicePersonnelService.findExactPersonnelByName.mockResolvedValue({
            id: 'personnel_2',
            name: '李阿姨',
        } as any);
        servicePersonnelService.getPersonnelServicesSummary.mockResolvedValue({
            matchedPersonnel: {
                id: 'personnel_2',
                name: '李阿姨',
                avatarUrl: null,
                avatarBlurhash: null,
            },
            services: [],
        });

        const result = await service.search(undefined, {
            keyword: '李阿姨',
        });

        expect(result.mode).toBe('personnel_services');
    });
});
```

- [ ] **Step 2: 跑测试确认当前确实失败**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`

Expected: FAIL，报出 `HomeService` 构造参数不匹配、`search` 方法不存在或相关依赖方法不存在。

- [ ] **Step 3: 补齐 shared schema 和 `HomeService` 的最小编排签名**

```ts
// packages/types/src/home.ts
export const HomeSearchSuggestionsQuerySchema = z.object({
    keyword: z.string().trim().min(1).max(64),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    limit: z.number().int().min(1).max(10).default(10),
});

export const HomeSearchSuggestionItemSchema = z.object({
    type: z.enum(['personnel', 'service']),
    label: z.string().min(1),
    subtitle: z.string().optional(),
    personnelId: z.string().max(255).optional(),
    serviceId: z.string().max(255).optional(),
});

export const HomeSearchQuerySchema = z.object({
    keyword: z.string().trim().min(1).max(64),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(20).default(20),
    personnelId: z.string().max(255).optional(),
    serviceId: z.string().max(255).optional(),
});

export const HomeSearchResponseSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('personnel_services'),
        keyword: z.string(),
        matchedPersonnel: z.object({
            id: z.string().max(255),
            name: z.string(),
            avatarUrl: z.string().url().nullable().optional(),
            avatarBlurhash: z.string().nullable().optional(),
        }),
        services: z.array(
            z.object({
                serviceId: z.string().max(255),
                serviceName: z.string(),
                pricingId: z.string().max(255).optional(),
                price: z.number().optional(),
                estimatedDurationMinutes: z.number().int().optional(),
                categoryId: z.string().max(255).optional(),
            }),
        ),
    }),
    z.object({
        mode: z.literal('personnel_list'),
        keyword: z.string(),
        serviceHint: z
            .object({
                serviceId: z.string().max(255).optional(),
                serviceName: z.string().optional(),
            })
            .optional(),
        personnel: z.array(HomeRecommendedPersonnelSchema.extend({
            serviceName: z.string().optional(),
        })),
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(20),
        hasMore: z.boolean(),
        nextPage: z.number().int().min(1).nullable(),
    }),
]);
```

```ts
// apps/backend/src/modules/home/home.module.ts
import { ServicePersonnelModule } from '../service-personnel/service-personnel.module';

@Module({
    imports: [FilesModule, ServiceModule, ServicePersonnelModule],
    controllers: [HomeController],
    providers: [HomeService, HomeRepository, GeoLocationService],
})
export class HomeModule {}
```

```ts
// apps/backend/src/modules/home/home.service.ts
async search(
    userId: string | undefined,
    query: HomeSearchQuery,
): Promise<HomeSearchResponse> {
    const { keyword, personnelId, serviceId, page = 1, limit = 20 } = query;

    if (personnelId) {
        const summary =
            await this.servicePersonnelService.getPersonnelServicesSummary(
                personnelId,
            );
        return {
            mode: 'personnel_services',
            keyword,
            ...summary,
        };
    }

    if (serviceId) {
        const service = await this.serviceService.findActiveServiceById(serviceId);
        const personnel = await this.servicePersonnelService.searchPersonnelByServiceIds({
            serviceIds: [serviceId],
            page,
            limit,
            lat: query.lat,
            lng: query.lng,
            excludePersonnelUserId: userId,
        });

        return {
            mode: 'personnel_list',
            keyword,
            serviceHint: service
                ? { serviceId: service.id, serviceName: service.name }
                : { serviceId },
            ...personnel,
        };
    }

    const exactPersonnel =
        await this.servicePersonnelService.findExactPersonnelByName(keyword);
    if (exactPersonnel) {
        const summary =
            await this.servicePersonnelService.getPersonnelServicesSummary(
                exactPersonnel.id,
            );
        return {
            mode: 'personnel_services',
            keyword,
            ...summary,
        };
    }

    return {
        mode: 'personnel_list',
        keyword,
        serviceHint: undefined,
        personnel: [],
        page,
        limit,
        hasMore: false,
        nextPage: null,
    };
}
```

- [ ] **Step 4: 重新跑 `HomeService` 单测，确认编排分支都可执行**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`

Expected: PASS，至少通过 `personnelId`、`serviceId`、唯一人员姓名命中这 3 个断言。

- [ ] **Step 5: 提交契约与编排骨架**

```bash
git add packages/types/src/home.ts apps/backend/src/modules/home/home.module.ts apps/backend/src/modules/home/home.service.ts apps/backend/src/modules/home/home.service.spec.ts
git commit -m "feat(search): add home search contracts and orchestration"
```

## Task 2: 实现后端搜索接口与仓库检索能力

**Files:**
- Modify: `apps/backend/src/modules/home/home.controller.ts`
- Modify: `apps/backend/src/modules/home/home.service.ts`
- Modify: `apps/backend/src/modules/service/service.service.ts`
- Modify: `apps/backend/src/modules/service/service.repository.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.repository.ts`
- Test: `apps/backend/src/modules/home/home.service.spec.ts`

- [ ] **Step 1: 扩充失败测试，覆盖 suggestions 与关键词降级到服务搜索**

```ts
it('候选词接口同时返回人员与服务候选', async () => {
    servicePersonnelService.findSearchPersonnelSuggestions.mockResolvedValue([
        { id: 'personnel_1', name: '王师傅' } as any,
    ]);
    serviceService.searchActiveServicesByKeyword.mockResolvedValue([
        { id: 'svc_1', name: '肩颈按摩' } as any,
    ]);

    const result = await service.searchSuggestions({
        keyword: '按摩',
        limit: 10,
    });

    expect(result.suggestions).toEqual([
        {
            type: 'personnel',
            label: '王师傅',
            personnelId: 'personnel_1',
        },
        {
            type: 'service',
            label: '肩颈按摩',
            serviceId: 'svc_1',
        },
    ]);
});

it('关键词未命中唯一人员时根据服务结果返回 personnel_list', async () => {
    servicePersonnelService.findExactPersonnelByName.mockResolvedValue(null);
    serviceService.searchActiveServicesByKeyword.mockResolvedValue([
        { id: 'svc_cleaning', name: '家庭保洁' } as any,
    ]);
    servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
        personnel: [
            {
                personnelId: 'worker_1',
                name: '陈阿姨',
                tag: '家庭保洁',
                minPrice: 129,
                distanceKm: 1.2,
                addressText: '浦东新区',
                workDays: '12345',
                workStartTime: '09:00:00',
                workEndTime: '18:00:00',
                reviewCount: 5,
                goodRatePercentage: 100,
                ratingValue: 5,
                avatarUrl: null,
            },
        ],
        page: 1,
        limit: 20,
        hasMore: false,
        nextPage: null,
    });

    const result = await service.search(undefined, {
        keyword: '保洁',
        page: 1,
        limit: 20,
    });

    expect(result.mode).toBe('personnel_list');
    expect(result.personnel).toHaveLength(1);
    expect(servicePersonnelService.searchPersonnelByServiceIds).toHaveBeenCalledWith(
        expect.objectContaining({
            serviceIds: ['svc_cleaning'],
        }),
    );
});
```

- [ ] **Step 2: 跑测试确认 suggestions 与服务降级逻辑仍然失败**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`

Expected: FAIL，报出 `searchSuggestions`、`searchActiveServicesByKeyword`、`findSearchPersonnelSuggestions`、`searchPersonnelByServiceIds` 未实现。

- [ ] **Step 3: 实现 service / service-personnel / home 的仓库与接口**

```ts
// apps/backend/src/modules/service/service.repository.ts
async searchActiveServicesByKeyword(keyword: string, limit = 10) {
    const normalized = keyword.trim();
    if (!normalized) return [];

    return await this.db
        .select({
            id: services.id,
            name: services.name,
            categoryId: services.categoryId,
        })
        .from(services)
        .where(
            and(
                eq(services.isActive, true),
                sql`${services.name} &@~ ${normalized} OR ${services.description} &@~ ${normalized}`,
            ),
        )
        .orderBy(asc(services.name))
        .limit(limit);
}

async findActiveServiceById(serviceId: string) {
    const [row] = await this.db
        .select({ id: services.id, name: services.name, categoryId: services.categoryId })
        .from(services)
        .where(and(eq(services.id, serviceId), eq(services.isActive, true)))
        .limit(1);

    return row ?? null;
}
```

```ts
// apps/backend/src/modules/service-personnel/service-personnel.repository.ts
async findSearchPersonnelSuggestions(keyword: string, limit = 5) {
    const normalized = keyword.trim();
    if (!normalized) return [];

    return await this.db
        .select({
            id: servicePersonnel.userId,
            name: servicePersonnel.name,
        })
        .from(servicePersonnel)
        .where(
            and(
                eq(servicePersonnel.isAvailable, true),
                like(servicePersonnel.name, `%${normalized}%`),
            ),
        )
        .orderBy(asc(servicePersonnel.name), asc(servicePersonnel.userId))
        .limit(limit);
}

async findExactPersonnelByName(keyword: string) {
    const normalized = keyword.trim();
    const rows = await this.db
        .select({
            id: servicePersonnel.userId,
            name: servicePersonnel.name,
        })
        .from(servicePersonnel)
        .where(eq(servicePersonnel.name, normalized))
        .limit(2);

    return rows.length === 1 ? rows[0] : null;
}

async searchPersonnelByServiceIds({
    serviceIds,
    page,
    limit,
    lat,
    lng,
    excludePersonnelUserId,
}: {
    serviceIds: string[];
    page: number;
    limit: number;
    lat?: number;
    lng?: number;
    excludePersonnelUserId?: string;
}) {
    const normalizedServiceIds = Array.from(new Set(serviceIds.filter(Boolean)));
    if (!normalizedServiceIds.length) {
        return {
            personnel: [],
            page,
            limit,
            hasMore: false,
            nextPage: null,
        };
    }

    const offset = (page - 1) * limit;
    const locationSelect =
        lat !== undefined && lng !== undefined
            ? this.geoService.createDistanceSelect(
                  sql`${servicePersonnel.geom}`,
                  this.geoService.createUserPoint(lng, lat),
              )
            : sql<number>`0`.as('distance_km');

    const rows = await this.db
        .select({
            personnelId: servicePersonnel.userId,
            name: servicePersonnel.name,
            avatarUrl: servicePersonnel.avatar,
            serviceId: services.id,
            serviceName: services.name,
            pricingId: servicePersonnelPricing.id,
            minPrice: sql<number>`CAST(${servicePersonnelPricing.price} AS DECIMAL(18,2))`.as(
                'min_price',
            ),
            distanceKm: locationSelect,
            addressText: servicePersonnel.detailedAddress,
            workDays: servicePersonnel.workDays,
            workStartTime: servicePersonnel.workStartTime,
            workEndTime: servicePersonnel.workEndTime,
            reviewCount: sql<number>`COALESCE(${reviewStats.totalCount}, 0)`.as(
                'review_count',
            ),
            goodRatePercentage:
                sql<number>`COALESCE(${reviewStats.goodRatePercentage}, 0)`.as(
                    'good_rate_percentage',
                ),
            ratingValue: sql<number>`COALESCE(${reviewStats.averageRating}, 0)`.as(
                'rating_value',
            ),
        })
        .from(servicePersonnelPricing)
        .innerJoin(
            servicePersonnel,
            eq(servicePersonnel.userId, servicePersonnelPricing.userId),
        )
        .innerJoin(services, eq(services.id, servicePersonnelPricing.serviceId))
        .leftJoin(
            reviewStats,
            and(
                eq(reviewStats.targetId, servicePersonnel.userId),
                sql`${reviewStats.targetType} = 'personnel'`,
                eq(reviewStats.serviceId, services.id),
            ),
        )
        .where(
            and(
                inArray(servicePersonnelPricing.serviceId, normalizedServiceIds),
                eq(servicePersonnelPricing.isActive, true),
                eq(servicePersonnel.isAvailable, true),
                ...(excludePersonnelUserId
                    ? [ne(servicePersonnel.userId, excludePersonnelUserId)]
                    : []),
            ),
        )
        .orderBy(asc(locationSelect), asc(servicePersonnel.userId))
        .limit(limit + 1)
        .offset(offset);

    const hasMore = rows.length > limit;
    return {
        personnel: rows.slice(0, limit),
        page,
        limit,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
    };
}
```

```ts
// apps/backend/src/modules/home/home.controller.ts
@Get('search/suggestions')
@AuthOptional()
@UsePipes(new ZodValidationPipe(HomeSearchSuggestionsQuerySchema))
async getHomeSearchSuggestions(
    @Query() query: HomeSearchSuggestionsQuery,
) {
    return await this.homeService.searchSuggestions(query);
}

@Get('search')
@AuthOptional()
@UsePipes(new ZodValidationPipe(HomeSearchQuerySchema))
async searchHome(
    @Query() query: HomeSearchQuery,
    @Req() req: Request,
) {
    return await this.homeService.search(req.user?.id, query);
}
```

```ts
// apps/backend/src/modules/home/home.service.ts
async searchSuggestions(query: HomeSearchSuggestionsQuery) {
    const [personnelSuggestions, serviceSuggestions] = await Promise.all([
        this.servicePersonnelService.findSearchPersonnelSuggestions(
            query.keyword,
            Math.min(query.limit, 5),
        ),
        this.serviceService.searchActiveServicesByKeyword(
            query.keyword,
            Math.min(query.limit, 5),
        ),
    ]);

    return {
        suggestions: [
            ...personnelSuggestions.map((item) => ({
                type: 'personnel' as const,
                label: item.name,
                personnelId: item.id,
            })),
            ...serviceSuggestions.map((item) => ({
                type: 'service' as const,
                label: item.name,
                serviceId: item.id,
            })),
        ].slice(0, query.limit),
    };
}
```

- [ ] **Step 4: 跑后端单测与类型检查**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`

Expected: PASS，搜索建议与服务降级逻辑全部通过。

Run: `pnpm --filter backend type-check`

Expected: PASS，无 `HomeSearch*` 类型或依赖注入错误。

- [ ] **Step 5: 提交后端搜索接口**

```bash
git add apps/backend/src/modules/home/home.controller.ts apps/backend/src/modules/home/home.service.ts apps/backend/src/modules/service/service.service.ts apps/backend/src/modules/service/service.repository.ts apps/backend/src/modules/service-personnel/service-personnel.service.ts apps/backend/src/modules/service-personnel/service-personnel.repository.ts apps/backend/src/modules/home/home.service.spec.ts
git commit -m "feat(search): add backend home search endpoints"
```

## Task 3: 增加 React Query hooks 与本地搜索历史

**Files:**
- Modify: `packages/hooks/src/api/home/index.ts`
- Create: `apps/mobile-user/lib/search-history.ts`
- Test: `apps/backend/src/modules/home/home.service.spec.ts`

- [ ] **Step 1: 先写一个纯函数历史记录用例草稿，并确认当前没有实现**

```ts
// 作为实现前验收标准，直接放在任务说明里执行同名函数调用
const history = ['保洁', '按摩'];
const next = upsertSearchHistory(history, '  保洁 ');
expect(next).toEqual(['保洁', '按摩']);
expect(upsertSearchHistory(next, '李阿姨')).toEqual(['李阿姨', '保洁', '按摩']);
```

Run: `pnpm --filter mobile-user type-check`

Expected: FAIL，报出 `useHomeSearchSuggestions`、`useHomeSearchResult`、`upsertSearchHistory` 尚不存在。

- [ ] **Step 2: 为 hooks 和历史工具补最小实现**

```ts
// packages/hooks/src/api/home/index.ts
import type {
    HomeSearchQuery,
    HomeSearchResponse,
    HomeSearchSuggestionsQuery,
    HomeSearchSuggestionResponse,
} from '@repo/types';

export const useHomeSearchSuggestions = (
    params: Partial<HomeSearchSuggestionsQuery>,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: ['home-search-suggestions', params],
        enabled: options.enabled,
        queryFn: async () => {
            const response = await apiClient.get<HomeSearchSuggestionResponse>(
                '/home/search/suggestions',
                {
                    query: {
                        ...(params.keyword ? { keyword: params.keyword } : {}),
                        ...(params.lat !== undefined ? { lat: params.lat.toString() } : {}),
                        ...(params.lng !== undefined ? { lng: params.lng.toString() } : {}),
                        ...(params.limit !== undefined ? { limit: params.limit.toString() } : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: '搜索候选词获取失败',
        },
    });

export const useHomeSearchResult = (
    params: Partial<HomeSearchQuery>,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: ['home-search-result', params],
        enabled: options.enabled,
        queryFn: async () => {
            const response = await apiClient.get<HomeSearchResponse>(
                '/home/search',
                {
                    query: {
                        ...(params.keyword ? { keyword: params.keyword } : {}),
                        ...(params.personnelId ? { personnelId: params.personnelId } : {}),
                        ...(params.serviceId ? { serviceId: params.serviceId } : {}),
                        ...(params.page !== undefined ? { page: params.page.toString() } : {}),
                        ...(params.limit !== undefined ? { limit: params.limit.toString() } : {}),
                        ...(params.lat !== undefined ? { lat: params.lat.toString() } : {}),
                        ...(params.lng !== undefined ? { lng: params.lng.toString() } : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: '搜索结果获取失败',
        },
    });
```

```ts
// apps/mobile-user/lib/search-history.ts
import { MMKV } from 'react-native-mmkv';

const SEARCH_HISTORY_STORAGE = new MMKV({ id: 'mobile-user-search-history' });
const SEARCH_HISTORY_KEY = 'keyword-history';
const MAX_HISTORY_COUNT = 10;

export function normalizeSearchKeyword(keyword: string) {
    return keyword.trim().replace(/\s+/g, ' ');
}

export function upsertSearchHistory(history: string[], keyword: string) {
    const normalized = normalizeSearchKeyword(keyword);
    if (!normalized) return history;

    const next = history.filter((item) => item !== normalized);
    next.unshift(normalized);
    return next.slice(0, MAX_HISTORY_COUNT);
}

export function getSearchHistory() {
    const raw = SEARCH_HISTORY_STORAGE.getString(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        SEARCH_HISTORY_STORAGE.delete(SEARCH_HISTORY_KEY);
        return [];
    }
}

export function saveSearchHistory(history: string[]) {
    SEARCH_HISTORY_STORAGE.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function recordSearchKeyword(keyword: string) {
    const next = upsertSearchHistory(getSearchHistory(), keyword);
    saveSearchHistory(next);
    return next;
}
```

- [ ] **Step 3: 再跑移动端类型检查，确认 hooks 与历史工具签名稳定**

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，`@repo/hooks/api/home` 与 `apps/mobile-user/lib/search-history.ts` 能被 TS 正确解析。

- [ ] **Step 4: 检查历史工具导出与使用点已接通**

Run: `rg -n "normalizeSearchKeyword|upsertSearchHistory|recordSearchKeyword|getSearchHistory|useHomeSearchSuggestions|useHomeSearchResult" apps/mobile-user packages/hooks/src/api/home/index.ts`

Expected: 输出同时包含 `apps/mobile-user/lib/search-history.ts` 与 `packages/hooks/src/api/home/index.ts` 中的导出定义，供后续页面直接引用。

- [ ] **Step 5: 提交 hooks 与历史工具**

```bash
git add packages/hooks/src/api/home/index.ts apps/mobile-user/lib/search-history.ts
git commit -m "feat(search): add mobile search hooks and local history"
```

## Task 4: 实现搜索页 `/search`

**Files:**
- Create: `apps/mobile-user/app/search/index.tsx`
- Create: `apps/mobile-user/components/search/SearchHistorySection.tsx`
- Create: `apps/mobile-user/components/search/SearchSuggestionList.tsx`
- Modify: `apps/mobile-user/app/_layout.tsx`

- [ ] **Step 1: 先搭失败页面，确认路由未注册**

```tsx
// apps/mobile-user/app/search/index.tsx
export default function SearchScreen() {
    return null;
}
```

Run: `pnpm --filter mobile-user type-check`

Expected: FAIL 或 Expo 路由未展示；同时 `_layout.tsx` 里还没有 `search/index` screen 配置。

- [ ] **Step 2: 注册路由与页面骨架**

```tsx
// apps/mobile-user/app/_layout.tsx
<Stack.Screen
    name="search/index"
    options={{
        title: '搜索',
        headerShown: true,
    }}
/>
```

```tsx
// apps/mobile-user/app/search/index.tsx
import { Input } from '@repo/mobile-ui/components/ui/input';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { useHomeSearchSuggestions } from '@repo/hooks/api/home';
import { useDebounce } from '@repo/hooks/useDebounceThrottle';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useEffect, useState } from 'react';
import {
    getSearchHistory,
    recordSearchKeyword,
    normalizeSearchKeyword,
} from '@/lib/search-history';
import { SearchHistorySection } from '@/components/search/SearchHistorySection';
import { SearchSuggestionList } from '@/components/search/SearchSuggestionList';

export default function SearchScreen() {
    const [keyword, setKeyword] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const debouncedKeyword = useDebounce(keyword, 300);
    const normalizedKeyword = normalizeSearchKeyword(debouncedKeyword);

    useEffect(() => {
        setHistory(getSearchHistory());
    }, []);

    const suggestionQuery = useHomeSearchSuggestions(
        { keyword: normalizedKeyword, limit: 10 },
        { enabled: Boolean(normalizedKeyword) },
    );

    const submitKeyword = (rawKeyword: string, extra?: { personnelId?: string; serviceId?: string }) => {
        const nextKeyword = normalizeSearchKeyword(rawKeyword);
        if (!nextKeyword) return;
        const nextHistory = recordSearchKeyword(nextKeyword);
        setHistory(nextHistory);
        router.push({
            pathname: '/search/result',
            params: {
                keyword: nextKeyword,
                ...(extra?.personnelId ? { personnelId: extra.personnelId } : {}),
                ...(extra?.serviceId ? { serviceId: extra.serviceId } : {}),
            },
        });
    };

    return (
        <View className="flex-1 bg-background">
            <View className="bg-card px-4 py-3">
                <Input
                    placeholder="搜索服务或服务人员"
                    value={keyword}
                    onChangeText={setKeyword}
                    onSubmitEditing={() => submitKeyword(keyword)}
                    returnKeyType="search"
                    className="rounded-xl border-border bg-muted/30"
                />
            </View>

            {normalizedKeyword ? (
                <SearchSuggestionList
                    suggestions={suggestionQuery.data?.suggestions ?? []}
                    isLoading={suggestionQuery.isLoading}
                    onSelectSuggestion={(item) =>
                        submitKeyword(item.label, {
                            personnelId: item.personnelId,
                            serviceId: item.serviceId,
                        })
                    }
                />
            ) : (
                <SearchHistorySection
                    history={history}
                    onPressKeyword={(item) => submitKeyword(item)}
                    onClearAll={() => {
                        setHistory([]);
                    }}
                />
            )}
        </View>
    );
}
```

- [ ] **Step 3: 落两个页面组件，保持页面文件聚焦**

```tsx
// apps/mobile-user/components/search/SearchHistorySection.tsx
import { Pressable, View } from 'react-native';
import { Text } from '@repo/mobile-ui/components/ui/text';

export function SearchHistorySection({
    history,
    onPressKeyword,
    onClearAll,
}: {
    history: string[];
    onPressKeyword: (keyword: string) => void;
    onClearAll: () => void;
}) {
    return (
        <View className="px-4 py-4">
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base text-foreground font-puhui-medium">
                    搜索历史
                </Text>
                <Pressable onPress={onClearAll}>
                    <Text className="text-sm text-muted-foreground font-puhui-regular">
                        清空
                    </Text>
                </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
                {history.map((item) => (
                    <Pressable
                        key={item}
                        className="rounded-full bg-card px-3 py-2"
                        onPress={() => onPressKeyword(item)}
                    >
                        <Text className="text-sm text-foreground font-puhui-regular">
                            {item}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
```

```tsx
// apps/mobile-user/components/search/SearchSuggestionList.tsx
import { Pressable, View } from 'react-native';
import { Text } from '@repo/mobile-ui/components/ui/text';
import type { HomeSearchSuggestionResponse } from '@repo/types';

export function SearchSuggestionList({
    suggestions,
    isLoading,
    onSelectSuggestion,
}: {
    suggestions: HomeSearchSuggestionResponse['suggestions'];
    isLoading: boolean;
    onSelectSuggestion: (item: HomeSearchSuggestionResponse['suggestions'][number]) => void;
}) {
    if (isLoading) {
        return (
            <View className="px-4 py-4">
                <Text className="text-sm text-muted-foreground font-puhui-regular">
                    搜索中...
                </Text>
            </View>
        );
    }

    return (
        <View className="px-4 py-2">
            {suggestions.map((item) => (
                <Pressable
                    key={`${item.type}-${item.personnelId ?? item.serviceId ?? item.label}`}
                    className="border-b border-border py-3"
                    onPress={() => onSelectSuggestion(item)}
                >
                    <Text className="text-sm text-foreground font-puhui-regular">
                        {item.label}
                    </Text>
                    {item.subtitle ? (
                        <Text className="mt-1 text-xs text-muted-foreground font-puhui-regular">
                            {item.subtitle}
                        </Text>
                    ) : null}
                </Pressable>
            ))}
        </View>
    );
}
```

- [ ] **Step 4: 跑移动端 lint 与类型检查**

Run: `pnpm --filter mobile-user lint`

Expected: PASS，无 Expo Router 路由或未使用变量错误。

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，`/search` 页可通过类型检查。

- [ ] **Step 5: 提交搜索页**

```bash
git add apps/mobile-user/app/search/index.tsx apps/mobile-user/components/search/SearchHistorySection.tsx apps/mobile-user/components/search/SearchSuggestionList.tsx apps/mobile-user/app/_layout.tsx
git commit -m "feat(search): add mobile search page"
```

## Task 5: 实现结果页 `/search/result` 与首页入口跳转

**Files:**
- Create: `apps/mobile-user/app/search/result.tsx`
- Create: `apps/mobile-user/components/search/SearchPersonnelList.tsx`
- Create: `apps/mobile-user/components/search/SearchPersonnelServices.tsx`
- Modify: `apps/mobile-user/app/_layout.tsx`
- Modify: `apps/mobile-user/app/(tabs)/index.tsx`

- [ ] **Step 1: 先让首页入口跳转到搜索页**

```tsx
// apps/mobile-user/app/(tabs)/index.tsx
<Pressable
    className="mx-4 mt-3 h-10 w-[343px] flex-row items-center rounded-full bg-card"
    onPress={() => router.push('/search')}
>
    <Text className="ml-3 flex-1 text-sm text-muted-foreground font-puhui-regular">
        搜索你想要的服务
    </Text>
    <View className="mr-0.5 h-9 w-[60px] items-center justify-center rounded-full bg-primary">
        <Text className="text-sm text-foreground font-puhui-regular">
            搜索
        </Text>
    </View>
</Pressable>
```

Run: `pnpm --filter mobile-user type-check`

Expected: PASS，首页入口不再是静态占位。

- [ ] **Step 2: 注册结果页路由并搭建数据请求骨架**

```tsx
// apps/mobile-user/app/_layout.tsx
<Stack.Screen
    name="search/result"
    options={{
        title: '搜索结果',
        headerShown: true,
    }}
/>
```

```tsx
// apps/mobile-user/app/search/result.tsx
import { useHomeSearchResult } from '@repo/hooks/api/home';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { View } from 'react-native';
import { SearchPersonnelList } from '@/components/search/SearchPersonnelList';
import { SearchPersonnelServices } from '@/components/search/SearchPersonnelServices';

export default function SearchResultScreen() {
    const params = useLocalSearchParams<{
        keyword?: string;
        personnelId?: string;
        serviceId?: string;
    }>();

    const keyword = params.keyword ? String(params.keyword) : '';
    const personnelId = params.personnelId ? String(params.personnelId) : undefined;
    const serviceId = params.serviceId ? String(params.serviceId) : undefined;

    const query = useHomeSearchResult(
        {
            keyword,
            personnelId,
            serviceId,
            page: 1,
            limit: 20,
        },
        { enabled: Boolean(keyword) },
    );

    if (query.isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-sm text-muted-foreground font-puhui-regular">
                    加载中...
                </Text>
            </View>
        );
    }

    if (!query.data) {
        return null;
    }

    return query.data.mode === 'personnel_services' ? (
        <SearchPersonnelServices data={query.data} />
    ) : (
        <SearchPersonnelList data={query.data} />
    );
}
```

- [ ] **Step 3: 落结果页两个分支组件**

```tsx
// apps/mobile-user/components/search/SearchPersonnelServices.tsx
import type { HomeSearchResponse } from '@repo/types';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@repo/mobile-ui/components/ui/text';

export function SearchPersonnelServices({
    data,
}: {
    data: Extract<HomeSearchResponse, { mode: 'personnel_services' }>;
}) {
    return (
        <ScrollView className="flex-1 bg-background">
            <View className="px-4 py-4">
                <Text className="text-lg text-foreground font-puhui-medium">
                    {data.matchedPersonnel.name}
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground font-puhui-regular">
                    可预约服务
                </Text>
            </View>

            {data.services.map((item) => (
                <Pressable
                    key={item.pricingId ?? item.serviceId}
                    className="mx-4 mb-3 rounded-xl bg-card p-4"
                    onPress={() =>
                        router.push({
                            pathname: '/servicePersonnel/[id]',
                            params: {
                                id: data.matchedPersonnel.id,
                                serviceId: item.serviceId,
                                ...(item.pricingId ? { pricingId: item.pricingId } : {}),
                                serviceName: item.serviceName,
                            },
                        })
                    }
                >
                    <Text className="text-base text-foreground font-puhui-medium">
                        {item.serviceName}
                    </Text>
                    <Text className="mt-2 text-sm text-destructive font-din-alt-bold">
                        {item.price ? `￥${item.price} 起` : '查看详情'}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}
```

```tsx
// apps/mobile-user/components/search/SearchPersonnelList.tsx
import type { HomeSearchResponse } from '@repo/types';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@repo/mobile-ui/components/ui/text';

export function SearchPersonnelList({
    data,
}: {
    data: Extract<HomeSearchResponse, { mode: 'personnel_list' }>;
}) {
    return (
        <ScrollView className="flex-1 bg-background">
            <View className="px-4 py-4">
                <Text className="text-base text-foreground font-puhui-medium">
                    {data.serviceHint?.serviceName ?? data.keyword}
                </Text>
            </View>

            {data.personnel.map((item) => (
                <Pressable
                    key={`${item.personnelId}-${item.pricingId ?? item.serviceId ?? 'default'}`}
                    className="mx-4 mb-3 rounded-xl bg-card p-4"
                    onPress={() =>
                        router.push({
                            pathname: '/servicePersonnel/[id]',
                            params: {
                                id: item.personnelId,
                                ...(item.serviceId ? { serviceId: item.serviceId } : {}),
                                ...(item.pricingId ? { pricingId: item.pricingId } : {}),
                                ...(item.serviceName ? { serviceName: item.serviceName } : {}),
                            },
                        })
                    }
                >
                    <Text className="text-base text-foreground font-puhui-medium">
                        {item.name}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground font-puhui-regular">
                        {item.tag} {item.addressText ? `· ${item.addressText}` : ''}
                    </Text>
                    <Text className="mt-2 text-sm text-destructive font-din-alt-bold">
                        ￥{item.minPrice} 起
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}
```

- [ ] **Step 4: 跑前端静态检查并手动验收主流程**

Run: `pnpm --filter mobile-user lint`

Expected: PASS。

Run: `pnpm --filter mobile-user type-check`

Expected: PASS。

Run: `pnpm mobile-user:dev`

Expected: Expo 启动成功，手动验证：
- 首页点击搜索框可进入 `/search`；
- 输入后能看到候选词；
- 点击人员候选词进入“只展示该人员服务”的结果页；
- 直接输入服务词回车进入服务人员列表结果页。

- [ ] **Step 5: 提交结果页与首页入口**

```bash
git add apps/mobile-user/app/search/result.tsx apps/mobile-user/components/search/SearchPersonnelList.tsx apps/mobile-user/components/search/SearchPersonnelServices.tsx apps/mobile-user/app/_layout.tsx apps/mobile-user/app/(tabs)/index.tsx
git commit -m "feat(search): add mobile search result flow"
```

## Task 6: 全量验证与收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-mobile-user-search-design.md`
- Modify: `docs/superpowers/plans/2026-04-10-mobile-user-search-implementation.md`

- [ ] **Step 1: 跑后端与移动端关键命令**

Run: `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`

Expected: PASS。

Run: `pnpm --filter backend type-check`

Expected: PASS。

Run: `pnpm --filter mobile-user lint`

Expected: PASS。

Run: `pnpm --filter mobile-user type-check`

Expected: PASS。

- [ ] **Step 2: 补一次人工回归**

Run: `pnpm mobile-user:dev`

Expected: 按以下顺序人工验证：
- 首页点击搜索框能进入搜索页；
- 空输入时能看见历史记录；
- 输入时联想接口正常返回；
- 点击服务候选词进入 `personnel_list`；
- 点击服务人员候选词进入 `personnel_services`；
- 直接输入同名人员但命中多个时，结果降级为 `personnel_list`；
- 直接输入无结果关键词时，结果页展示空态。

- [ ] **Step 3: 更新文档中的验证结果**

```md
## 验证记录

- `pnpm --filter backend test -- src/modules/home/home.service.spec.ts --runInBand`
- `pnpm --filter backend type-check`
- `pnpm --filter mobile-user lint`
- `pnpm --filter mobile-user type-check`
- 手动验证：首页 -> 搜索页 -> 结果页两条分支均通过
```

- [ ] **Step 4: 最终提交**

```bash
git add docs/superpowers/specs/2026-04-10-mobile-user-search-design.md docs/superpowers/plans/2026-04-10-mobile-user-search-implementation.md
git commit -m "docs(search): record mobile search verification"
```

- [ ] **Step 5: 准备发起代码评审**

Run: `git status --short`

Expected: 工作区干净，或只剩用户明确保留的未跟踪文件。

## Self-Review

### Spec coverage

- 首页点击搜索框跳转搜索页：Task 5 Step 1。
- 搜索页历史记录与候选词：Task 3、Task 4。
- 点击候选词跳转结果页：Task 4 Step 2。
- 允许任意关键词直接提交：Task 4 Step 2。
- 人员唯一命中时只展示该人员服务：Task 1、Task 2、Task 5。
- 非唯一人员命中时展示相关服务人员：Task 2、Task 5。

### Placeholder scan

- 已检查，无 `TODO`、`TBD`、`后续补` 等占位描述。
- 每个任务都给出明确文件、命令、预期结果和关键代码片段。

### Type consistency

- 统一使用 `HomeSearchSuggestionsQuery`、`HomeSearchQuery`、`HomeSearchResponse`。
- 结果页只识别 `mode = personnel_services | personnel_list`。
- `personnelId / serviceId / keyword` 三条入口参数命名在前后端保持一致。
