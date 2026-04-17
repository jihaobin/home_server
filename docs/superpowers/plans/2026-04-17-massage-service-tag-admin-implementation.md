# 按摩服务标签管理端闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理端补齐 `massage` 域服务标签的 CRUD 与服务单标签绑定闭环，同时保持移动端与既有按摩聚合接口契约不变。

**Architecture:** 本次只在现有一期能力之上补 admin 闭环，不新增数据库迁移，也不重构服务管理结构。后端在现有 `AdminModule` 中新增 `service-tags` 资源；管理端新增 `/service-tags` 页面并沿用现有 SSR + React Query 模式；服务绑定继续复用 `service-categories` 页面中的 `ServiceFormDialog`，只补 `serviceTagId` 字段和“停用标签保留、不可新绑”的业务规则。

**Tech Stack:** NestJS 11、Drizzle ORM、Zod v4、Jest、Next.js App Router、TanStack Query v5、@tanstack/react-form、@repo/hooks、@repo/types、@repo/web-ui

---

## File Map

- Create: `apps/backend/src/modules/admin/admin-service-tags.controller.ts`
  管理端服务标签 CRUD 接口，挂载 `/admin/service-tags`。
- Create: `apps/backend/src/modules/admin/admin-service-tags.service.ts`
  标签增删改查业务规则，处理 `slug` 唯一、删除冲突、启停提示语义。
- Create: `apps/backend/src/modules/admin/admin-service-tags.repository.ts`
  查询 `service_tags` 与聚合 `serviceCount`，提供存在性/唯一性检查。
- Create: `apps/backend/src/modules/admin/admin-service-tags.service.spec.ts`
  覆盖 CRUD 主规则与删除/冲突分支。
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
  注册 controller / service / repository。
- Modify: `apps/backend/src/modules/service/service.service.ts`
  为服务创建/更新补充 `serviceTagId` 业务校验。
- Modify: `apps/backend/src/modules/service/service.repository.ts`
  提供读取标签状态、按 `id` 查询标签等校验查询。
- Create or Modify: `apps/backend/src/modules/service/service.service.spec.ts`
  覆盖服务绑定活跃标签、拒绝新绑停用标签、允许保留历史停用标签、允许解绑。
- Modify: `packages/types/src/admin.ts`
  新增 admin service tag 的 query / entity / create / update schema。
- Modify: `packages/types/src/index.ts`
  导出新增 admin schema。
- Create: `packages/hooks/src/api/ssr/admin-service-tags.ts`
  定义 SSR query options 与 CRUD mutation。
- Modify: `packages/hooks/src/api/ssr/index.ts`
  导出 service tag hooks。
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
  新增 `/service-tags` 页的预取器。
- Modify: `apps/admin-web/src/components/layout/nav-config.ts`
  在“运营管理”下新增“服务标签”入口。
- Create: `apps/admin-web/src/app/(management)/service-tags/page.tsx`
  页面入口，调用预取器并包裹 `HydrateClient`。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-section.tsx`
  按管理端现有模式组合 `Suspense`、`QueryErrorResetBoundary`、`ErrorBoundary`。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-content.tsx`
  主页面逻辑，包含筛选、表格、弹窗、删除确认。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-error.tsx`
  页面错误态。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table.tsx`
  列表表格。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table-skeleton.tsx`
  首屏 skeleton。
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tag-form-dialog.tsx`
  创建/编辑表单弹窗，使用 `@tanstack/react-form` + Zod。
- Create: `apps/admin-web/src/app/(management)/service-tags/_utils/query.ts`
  `searchParams` 规范化。
- Modify: `apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx`
  给 `ServiceFormDialog` 增加 `serviceTagId`，加载标签选项并支持停用回显。

## Task 1: 锁定 admin service-tag 契约

**Files:**
- Modify: `packages/types/src/admin.ts`
- Modify: `packages/types/src/index.ts`
- Test: `pnpm --filter @repo/types type-check`

- [ ] **Step 1: 先补 schema，明确 admin 标签资源的读写边界**

```ts
// packages/types/src/admin.ts
import { ServiceTagDomainEnum } from "./service-tag";

export const AdminServiceTagStatusSchema = z
    .enum(["all", "active", "inactive"])
    .describe("管理端服务标签状态筛选");

export const AdminServiceTagSchema = z
    .object({
        id: z.string().max(255).describe("标签 ID"),
        name: z.string().max(100).describe("标签名称"),
        slug: z.string().max(100).describe("标签 slug"),
        domain: ServiceTagDomainEnum.describe("业务域"),
        sortOrder: z.number().int().describe("排序值"),
        isActive: z.boolean().describe("是否启用"),
        description: z.string().nullable().describe("标签描述"),
        serviceCount: z.number().int().nonnegative().describe("已绑定服务数"),
    })
    .describe("管理端服务标签");

export const AdminServiceTagListQuerySchema = z
    .object({
        domain: ServiceTagDomainEnum.optional(),
        keyword: z.string().trim().optional(),
        status: AdminServiceTagStatusSchema.default("all"),
    })
    .describe("管理端服务标签列表查询参数");

export const AdminServiceTagListResponseSchema = z
    .object({
        items: z.array(AdminServiceTagSchema),
    })
    .describe("管理端服务标签列表响应");

export const CreateAdminServiceTagSchema = z
    .object({
        name: z.string().trim().min(1, "标签名称不能为空").max(100),
        slug: z.string().trim().min(1, "slug 不能为空").max(100),
        domain: ServiceTagDomainEnum,
        sortOrder: z.number().int(),
        description: z.string().trim().nullable().optional(),
        isActive: z.boolean(),
    })
    .describe("创建管理端服务标签请求");

export const UpdateAdminServiceTagSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
        slug: z.string().trim().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
        description: z.string().trim().nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .describe("更新管理端服务标签请求");

export type AdminServiceTag = z.infer<typeof AdminServiceTagSchema>;
export type AdminServiceTagListQuery = z.infer<typeof AdminServiceTagListQuerySchema>;
export type AdminServiceTagListResponse = z.infer<typeof AdminServiceTagListResponseSchema>;
export type CreateAdminServiceTagInput = z.infer<typeof CreateAdminServiceTagSchema>;
export type UpdateAdminServiceTagInput = z.infer<typeof UpdateAdminServiceTagSchema>;
```

- [ ] **Step 2: 汇总导出，避免后端和 hooks 各自定义重复类型**

```ts
// packages/types/src/index.ts
export * from "./admin";
```

- [ ] **Step 3: 运行类型检查，确认共享契约可被各端消费**

Run: `pnpm --filter @repo/types type-check`

Expected: PASS，`packages/types` 无新的类型错误。

- [ ] **Step 4: 提交共享契约变更**

```bash
git add packages/types/src/admin.ts packages/types/src/index.ts
git commit -m "feat(types): add admin service tag schemas"
```

## Task 2: 实现后端 admin 标签 CRUD 与服务绑定校验

**Files:**
- Create: `apps/backend/src/modules/admin/admin-service-tags.controller.ts`
- Create: `apps/backend/src/modules/admin/admin-service-tags.service.ts`
- Create: `apps/backend/src/modules/admin/admin-service-tags.repository.ts`
- Create: `apps/backend/src/modules/admin/admin-service-tags.service.spec.ts`
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
- Modify: `apps/backend/src/modules/service/service.service.ts`
- Modify: `apps/backend/src/modules/service/service.repository.ts`
- Create or Modify: `apps/backend/src/modules/service/service.service.spec.ts`
- Test: `apps/backend/src/modules/admin/admin-service-tags.service.spec.ts`
- Test: `apps/backend/src/modules/service/service.service.spec.ts`

- [ ] **Step 1: 先写 admin service tag 的失败测试，锁定关键业务规则**

```ts
// apps/backend/src/modules/admin/admin-service-tags.service.spec.ts
describe("AdminServiceTagsService", () => {
    it("同域 slug 冲突时拒绝创建", async () => {
        repository.findByDomainAndSlug.mockResolvedValue({
            id: "tag_existing",
            slug: "relax",
            domain: "massage",
        } as any);

        await expect(
            service.createTag({
                name: "放松",
                slug: "relax",
                domain: "massage",
                sortOrder: 10,
                isActive: true,
                description: null,
            }),
        ).rejects.toThrow("该 slug 已在当前业务域中使用");
    });

    it("已被服务引用时拒绝删除", async () => {
        repository.findById.mockResolvedValue({
            id: "tag_used",
            domain: "massage",
        } as any);
        repository.countReferencedServices.mockResolvedValue(2);

        await expect(service.deleteTag("tag_used")).rejects.toThrow(
            "该标签已被服务引用，无法删除；如需下线请先停用",
        );
    });
});
```

```ts
// apps/backend/src/modules/service/service.service.spec.ts
describe("ServiceService.updateService", () => {
    it("禁止把服务改绑到停用标签", async () => {
        serviceRepository.getServiceById.mockResolvedValue({
            id: "srv_1",
            serviceTagId: "tag_old",
        } as any);
        serviceRepository.findServiceTagById.mockResolvedValue({
            id: "tag_inactive",
            isActive: false,
        } as any);

        await expect(
            service.updateService("srv_1", {
                serviceTagId: "tag_inactive",
            }),
        ).rejects.toThrow("停用标签不能作为新的绑定目标");
    });

    it("允许保留历史停用标签并修改其他字段", async () => {
        serviceRepository.getServiceById.mockResolvedValue({
            id: "srv_1",
            serviceTagId: "tag_inactive",
        } as any);
        serviceRepository.updateService.mockResolvedValue({
            id: "srv_1",
        } as any);

        await expect(
            service.updateService("srv_1", {
                name: "肩颈调理",
                serviceTagId: "tag_inactive",
            }),
        ).resolves.toBeTruthy();
    });
});
```

- [ ] **Step 2: 跑测试确认规则尚未完全实现**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-tags.service.spec.ts src/modules/service/service.service.spec.ts --runInBand`

Expected: FAIL，报 `AdminServiceTagsService` / `findByDomainAndSlug` / `findServiceTagById` / 业务报错文案未实现。

- [ ] **Step 3: 写 repository，集中处理标签列表聚合和引用检查**

```ts
// apps/backend/src/modules/admin/admin-service-tags.repository.ts
@Injectable()
export class AdminServiceTagsRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async findAll(params: {
        domain?: ServiceTagDomain;
        keyword?: string;
        status?: "all" | "active" | "inactive";
    }) {
        const conditions: SQL[] = [];

        if (params.domain) {
            conditions.push(eq(serviceTags.domain, params.domain));
        }
        if (params.keyword) {
            conditions.push(
                sql`${serviceTags.name} ILIKE ${`%${params.keyword}%`} OR ${serviceTags.slug} ILIKE ${`%${params.keyword}%`}`,
            );
        }
        if (params.status === "active") {
            conditions.push(eq(serviceTags.isActive, true));
        }
        if (params.status === "inactive") {
            conditions.push(eq(serviceTags.isActive, false));
        }

        return await this.db
            .select({
                id: serviceTags.id,
                name: serviceTags.name,
                slug: serviceTags.slug,
                domain: serviceTags.domain,
                sortOrder: serviceTags.sortOrder,
                isActive: serviceTags.isActive,
                description: serviceTags.description,
                serviceCount: count(services.id),
            })
            .from(serviceTags)
            .leftJoin(services, eq(services.serviceTagId, serviceTags.id))
            .where(conditions.length ? and(...conditions) : undefined)
            .groupBy(serviceTags.id)
            .orderBy(asc(serviceTags.sortOrder), asc(serviceTags.id));
    }

    async findById(id: string) {
        const [row] = await this.db
            .select()
            .from(serviceTags)
            .where(eq(serviceTags.id, id))
            .limit(1);
        return row ?? null;
    }

    async findByDomainAndSlug(domain: ServiceTagDomain, slug: string) {
        const [row] = await this.db
            .select()
            .from(serviceTags)
            .where(and(eq(serviceTags.domain, domain), eq(serviceTags.slug, slug)))
            .limit(1);
        return row ?? null;
    }

    async countReferencedServices(id: string) {
        const [row] = await this.db
            .select({ value: count(services.id) })
            .from(services)
            .where(eq(services.serviceTagId, id));
        return Number(row?.value ?? 0);
    }
}
```

- [ ] **Step 4: 写 service/controller，并把资源挂到 `AdminModule`**

```ts
// apps/backend/src/modules/admin/admin-service-tags.service.ts
@Injectable()
export class AdminServiceTagsService {
    constructor(private readonly repository: AdminServiceTagsRepository) {}

    async listTags(query: AdminServiceTagListQuery): Promise<AdminServiceTagListResponse> {
        return {
            items: await this.repository.findAll(query),
        };
    }

    async createTag(payload: CreateAdminServiceTagInput): Promise<AdminServiceTag> {
        const duplicated = await this.repository.findByDomainAndSlug(
            payload.domain,
            payload.slug,
        );

        if (duplicated) {
            throw new BadRequestException("该 slug 已在当前业务域中使用");
        }

        return await this.repository.create({
            ...payload,
            description: normalizeNullableText(payload.description),
        });
    }

    async updateTag(id: string, payload: UpdateAdminServiceTagInput): Promise<AdminServiceTag> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new NotFoundException("服务标签不存在");
        }

        if (payload.slug && payload.slug !== existing.slug) {
            const duplicated = await this.repository.findByDomainAndSlug(
                existing.domain,
                payload.slug,
            );
            if (duplicated && duplicated.id !== id) {
                throw new BadRequestException("该 slug 已在当前业务域中使用");
            }
        }

        return await this.repository.update(id, {
            ...payload,
            description:
                payload.description === undefined
                    ? undefined
                    : normalizeNullableText(payload.description),
        });
    }

    async deleteTag(id: string) {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new NotFoundException("服务标签不存在");
        }

        const serviceCount = await this.repository.countReferencedServices(id);
        if (serviceCount > 0) {
            throw new ConflictException("该标签已被服务引用，无法删除；如需下线请先停用");
        }

        await this.repository.delete(id);
        return { success: true };
    }
}
```

```ts
// apps/backend/src/modules/admin/admin-service-tags.controller.ts
@ApiTags("管理员-服务标签")
@Controller("admin/service-tags")
export class AdminServiceTagsController {
    constructor(private readonly service: AdminServiceTagsService) {}

    @Get()
    @UsePipes(new ZodValidationPipe(AdminServiceTagListQuerySchema))
    async listTags(@Query() query: AdminServiceTagListQuery) {
        return this.service.listTags(query);
    }

    @Post()
    @UsePipes(new ZodValidationPipe(CreateAdminServiceTagSchema))
    async createTag(@Body() body: CreateAdminServiceTagInput) {
        return this.service.createTag(body);
    }

    @Patch(":id")
    @UsePipes(createMultiZodPipe({
        params: z.string().min(1).max(255),
        body: UpdateAdminServiceTagSchema,
    }))
    async updateTag(@Param("id") id: string, @Body() body: UpdateAdminServiceTagInput) {
        return this.service.updateTag(id, body);
    }

    @Delete(":id")
    async deleteTag(@Param("id") id: string) {
        return this.service.deleteTag(id);
    }
}
```

```ts
// apps/backend/src/modules/admin/admin.module.ts
controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminOrdersController,
    AdminServiceCategoriesController,
    AdminServiceTagsController,
    AdminHomeConfigController,
    AdminServiceCategoryCommissionStrategyController,
],
providers: [
    AdminAuthService,
    AdminSeedService,
    AdminDashboardService,
    AdminDashboardRepository,
    AdminUsersService,
    AdminUsersRepository,
    AdminOrdersService,
    AdminOrdersRepository,
    AdminServiceCategoriesService,
    AdminServiceCategoriesRepository,
    AdminServiceTagsService,
    AdminServiceTagsRepository,
    AdminHomeConfigService,
    AdminHomeConfigRepository,
    AdminServiceCategoryCommissionStrategyService,
    AdminServiceCategoryCommissionStrategyRepository,
],
```

- [ ] **Step 5: 在服务更新链路补 `serviceTagId` 校验，不新开专用接口**

```ts
// apps/backend/src/modules/service/service.service.ts
private async validateServiceTagBinding(
    currentServiceTagId: string | null | undefined,
    nextServiceTagId: string | null | undefined,
) {
    if (nextServiceTagId === undefined) {
        return;
    }

    if (nextServiceTagId === null) {
        return;
    }

    const tag = await this.serviceRepository.findServiceTagById(nextServiceTagId);
    if (!tag) {
        throw new BadRequestException("服务标签不存在");
    }

    const isKeepingExistingInactiveTag =
        currentServiceTagId === nextServiceTagId && tag.isActive === false;

    if (!tag.isActive && !isKeepingExistingInactiveTag) {
        throw new BadRequestException("停用标签不能作为新的绑定目标");
    }
}

async createService(data: CreateService): Promise<ServiceDetail> {
    await this.validateServiceTagBinding(null, data.serviceTagId);
    const created = await this.serviceRepository.createService(data);
    return (await this.getServiceById(created.id)) ?? created;
}

async updateService(id: string, data: Partial<UpdateService>): Promise<ServiceDetail | null> {
    const existing = await this.serviceRepository.getServiceById(id);
    if (!existing) {
        throw new BadRequestException("服务项目不存在");
    }

    await this.validateServiceTagBinding(existing.serviceTagId, data.serviceTagId);

    const updated = await this.serviceRepository.updateService(id, data);
    if (!updated) {
        return null;
    }
    return await this.getServiceById(id);
}
```

```ts
// apps/backend/src/modules/service/service.repository.ts
async findServiceTagById(id: string) {
    const [tag] = await this.db
        .select({
            id: serviceTags.id,
            isActive: serviceTags.isActive,
            domain: serviceTags.domain,
        })
        .from(serviceTags)
        .where(eq(serviceTags.id, id))
        .limit(1);

    return tag ?? null;
}
```

- [ ] **Step 6: 跑后端测试，确认 CRUD 与绑定规则通过**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-tags.service.spec.ts src/modules/service/service.service.spec.ts --runInBand`

Expected: PASS，至少覆盖 `slug` 冲突、删除冲突、停用标签绑定限制、保留历史停用标签四类规则。

- [ ] **Step 7: 提交后端实现**

```bash
git add apps/backend/src/modules/admin apps/backend/src/modules/service
git commit -m "feat(backend): add admin service tag management"
```

## Task 3: 实现 SSR hooks 与 `/service-tags` 管理页

**Files:**
- Create: `packages/hooks/src/api/ssr/admin-service-tags.ts`
- Modify: `packages/hooks/src/api/ssr/index.ts`
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
- Modify: `apps/admin-web/src/components/layout/nav-config.ts`
- Create: `apps/admin-web/src/app/(management)/service-tags/page.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-section.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-content.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-error.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tags-table-skeleton.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_components/service-tag-form-dialog.tsx`
- Create: `apps/admin-web/src/app/(management)/service-tags/_utils/query.ts`
- Test: `pnpm --filter admin-web type-check`

- [ ] **Step 1: 先写 SSR hook，保证页面和预取器使用同一套 query key**

```ts
// packages/hooks/src/api/ssr/admin-service-tags.ts
export const adminServiceTagsQueryKey = (params: AdminServiceTagListQuery = {}) =>
    ["admin-service-tags", params] as const;

export const adminServiceTagsQueryOptions = (
    params: AdminServiceTagListQuery = {},
) =>
    queryOptions<AdminServiceTagListResponse>({
        queryKey: adminServiceTagsQueryKey(params),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminServiceTagListResponse>(
                "/admin/service-tags",
                {
                    query: params,
                    schema: AdminServiceTagListResponseSchema,
                },
            );

            if (!response.data) {
                throw new Error("服务标签数据为空");
            }

            return response.data;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        meta: {
            errorMessage: "服务标签获取失败",
        },
    });
```

```ts
// packages/hooks/src/api/ssr/index.ts
export {
    adminServiceTagsQueryOptions,
    adminServiceTagsQueryKey,
    useAdminServiceTags,
    useCreateAdminServiceTag,
    useUpdateAdminServiceTag,
    useDeleteAdminServiceTag,
} from "./admin-service-tags";
```

- [ ] **Step 2: 补预取器与侧边栏入口**

```ts
// apps/admin-web/src/lib/prefetchers.ts
export async function preloadServiceTagsPageState(
    query: AdminServiceTagListQuery = { domain: "massage", status: "all" },
) {
    ensureSsrApiClient();

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminServiceTagsQueryOptions(query));
        });
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login");
        }
        throw error;
    }
}
```

```ts
// apps/admin-web/src/components/layout/nav-config.ts
{
    label: "服务标签",
    href: "/service-tags",
    icon: Tags,
    description: "按摩标签维护与启停",
},
```

- [ ] **Step 3: 按现有管理页装配模式创建页面骨架**

```tsx
// apps/admin-web/src/app/(management)/service-tags/page.tsx
import { HydrateClient } from "@/components/hydrate-client";
import { preloadServiceTagsPageState } from "@/lib/prefetchers";
import { normalizeServiceTagsQuery } from "./_utils/query";
import { ServiceTagsPageSection } from "./_components/service-tags-page-section";

export default async function ServiceTagsPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const initialQuery = normalizeServiceTagsQuery(await searchParams);
    const dehydratedState = await preloadServiceTagsPageState(initialQuery);

    return (
        <HydrateClient state={dehydratedState}>
            <ServiceTagsPageSection initialQuery={initialQuery} />
        </HydrateClient>
    );
}
```

```tsx
// apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-section.tsx
export function ServiceTagsPageSection({
    initialQuery,
}: {
    initialQuery: AdminServiceTagListQuery;
}) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ resetErrorBoundary }) => (
                        <ServiceTagsPageError onRetry={resetErrorBoundary} />
                    )}
                >
                    <Suspense fallback={<ServiceTagsTableSkeleton />}>
                        <ServiceTagsPageContent initialQuery={initialQuery} />
                    </Suspense>
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}
```

- [ ] **Step 4: 实现列表页主交互，只开放 `massage` 域**

```tsx
// apps/admin-web/src/app/(management)/service-tags/_components/service-tags-page-content.tsx
export function ServiceTagsPageContent({
    initialQuery,
}: {
    initialQuery: AdminServiceTagListQuery;
}) {
    const [query, setQuery] = useState<AdminServiceTagListQuery>({
        domain: "massage",
        status: initialQuery.status ?? "all",
        keyword: initialQuery.keyword ?? "",
    });

    const { data, refetch, isFetching } = useAdminServiceTags(query);
    const createMutation = useCreateAdminServiceTag();
    const updateMutation = useUpdateAdminServiceTag();
    const deleteMutation = useDeleteAdminServiceTag();

    return (
        <div className="space-y-6">
            <PageHeader
                title="服务标签"
                description="维护按摩频道服务标签，并为服务编辑提供可绑定选项。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/service-tags" },
                    { label: "服务标签" },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>当前业务域：上门按摩（massage）</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Input
                        value={query.keyword ?? ""}
                        placeholder="搜索标签名称或 slug"
                        onChange={(event) =>
                            setQuery((prev) => ({
                                ...prev,
                                keyword: event.target.value,
                            }))
                        }
                    />
                    <Select
                        value={query.status ?? "all"}
                        onValueChange={(status) =>
                            setQuery((prev) => ({ ...prev, status: status as any }))
                        }
                    >
                        <SelectTrigger className="w-40" />
                        <SelectContent>
                            <SelectItem value="all">全部状态</SelectItem>
                            <SelectItem value="active">仅启用</SelectItem>
                            <SelectItem value="inactive">仅停用</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                        刷新
                    </Button>
                </CardContent>
            </Card>

            <ServiceTagsTable
                items={data.items}
                onEdit={(tag) => setEditingTag(tag)}
                onToggle={(tag) =>
                    updateMutation.mutate({
                        id: tag.id,
                        data: { isActive: !tag.isActive },
                    })
                }
                onDelete={(tag) => setDeletingTag(tag)}
            />
        </div>
    );
}
```

- [ ] **Step 5: 表单弹窗只允许创建 `massage` 域标签，并明确删除/停用提示**

```tsx
// apps/admin-web/src/app/(management)/service-tags/_components/service-tag-form-dialog.tsx
const ServiceTagFormSchema = z.object({
    name: z.string().trim().min(1, "请输入标签名称"),
    slug: z.string().trim().min(1, "请输入 slug"),
    sortOrder: z.string().trim().min(1, "请输入排序值"),
    description: z.string().optional(),
    isActive: z.boolean(),
});

const submitPayload = {
    name: values.name.trim(),
    slug: values.slug.trim(),
    domain: "massage" as const,
    sortOrder: Number(values.sortOrder),
    description: values.description?.trim() ? values.description.trim() : null,
    isActive: values.isActive,
};
```

- [ ] **Step 6: 运行管理端类型检查，确认 SSR 和页面装配无误**

Run: `pnpm --filter admin-web type-check`

Expected: PASS，`/service-tags` 页面及 SSR hooks 无类型错误。

- [ ] **Step 7: 提交 hooks 与页面实现**

```bash
git add packages/hooks/src/api/ssr apps/admin-web/src/lib apps/admin-web/src/components/layout/nav-config.ts 'apps/admin-web/src/app/(management)/service-tags'
git commit -m "feat(admin-web): add service tags management page"
```

## Task 4: 在服务编辑弹窗补标签绑定与停用回显

**Files:**
- Modify: `apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx`
- Test: `pnpm --filter admin-web type-check`

- [ ] **Step 1: 先扩展服务表单值，给服务编辑增加 `serviceTagId`**

```ts
// apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx
type ServiceFormValues = {
    name: string;
    description: string;
    categoryId: string;
    serviceTagId: string;
    isActive: boolean;
    image: UploadValue | null;
};
```

- [ ] **Step 2: 在页面层加载标签列表，并派生“可选项 + 当前停用回显项”**

```ts
const { data: serviceTagsResponse } = useAdminServiceTags({
    domain: "massage",
    status: "all",
});

const serviceTagOptions = useMemo(
    () => serviceTagsResponse.items.filter((tag) => tag.isActive),
    [serviceTagsResponse.items],
);

function buildServiceTagSelectOptions(
    currentServiceTagId: string | null | undefined,
) {
    const activeOptions = serviceTagOptions.map((tag) => ({
        value: tag.id,
        label: tag.name,
        inactive: false,
    }));

    const currentInactive = serviceTagsResponse.items.find(
        (tag) => tag.id === currentServiceTagId && !tag.isActive,
    );

    return currentInactive
        ? [
              ...activeOptions,
              {
                  value: currentInactive.id,
                  label: `${currentInactive.name}（已停用）`,
                  inactive: true,
              },
          ]
        : activeOptions;
}
```

- [ ] **Step 3: 更新创建/编辑提交 payload，支持绑定、改绑和解绑**

```ts
await createServiceMutation.mutateAsync({
    name: values.name.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    categoryId: values.categoryId,
    serviceTagId: values.serviceTagId || null,
    imageFileId: values.image?.id ?? null,
    isActive: values.isActive,
});

await updateServiceMutation.mutateAsync({
    id: serviceId,
    data: {
        name: values.name.trim(),
        description: values.description.trim() ? values.description.trim() : null,
        categoryId: values.categoryId,
        serviceTagId: values.serviceTagId || null,
        imageFileId: values.image?.id ?? null,
        isActive: values.isActive,
    },
});
```

- [ ] **Step 4: 在 `ServiceFormDialog` 中渲染单选 `Select`，并提供“未设置标签”选项**

```tsx
<div className="space-y-2">
    <Label htmlFor="serviceTagId">服务标签</Label>
    <Select
        value={form.state.values.serviceTagId}
        onValueChange={(value) => form.setFieldValue("serviceTagId", value)}
    >
        <SelectTrigger id="serviceTagId">
            <SelectValue placeholder="请选择服务标签" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="">未设置标签</SelectItem>
            {serviceTagOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                    {option.label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">
        仅可新绑启用中的标签；若当前绑定标签已停用，会保留并显示“已停用”标记。
    </p>
</div>
```

- [ ] **Step 5: 运行类型检查，确认 `service-categories` 页面无回归**

Run: `pnpm --filter admin-web type-check`

Expected: PASS，`ServiceCategoriesPageContent` 和 `ServiceFormDialog` 无类型错误。

- [ ] **Step 6: 提交服务编辑弹窗联动**

```bash
git add 'apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx'
git commit -m "feat(admin-web): support service tag binding in service dialog"
```

## Task 5: 回归验证与收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-04-17-massage-service-tag-admin-implementation.md`
- Test: `pnpm --filter backend test -- src/modules/admin/admin-service-tags.service.spec.ts src/modules/service/service.service.spec.ts --runInBand`
- Test: `pnpm --filter admin-web type-check`

- [ ] **Step 1: 跑后端测试，确认业务规则和异常分支稳定**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-tags.service.spec.ts src/modules/service/service.service.spec.ts --runInBand`

Expected: PASS，输出包含 `AdminServiceTagsService` 与 `ServiceService` 相关用例通过。

- [ ] **Step 2: 跑管理端类型检查，确认页面和 hooks 无回归**

Run: `pnpm --filter admin-web type-check`

Expected: PASS，Next.js 管理端无新增类型错误。

- [ ] **Step 3: 进行手工回归验证**

Run:

```bash
pnpm backend:dev
pnpm admin:dev
```

Expected:
- `/service-tags` 首屏能看到 skeleton，再进入列表。
- 创建 `massage` 标签后列表即时刷新。
- 已被服务引用的标签删除时报“该标签已被服务引用，无法删除；如需下线请先停用”。
- 停用标签后，服务编辑弹窗不再允许把其他服务绑定到该标签。
- 已经绑定停用标签的服务进入编辑弹窗时，仍能回显该标签，且保存其他字段成功。
- 选择“未设置标签”保存后，后端收到 `serviceTagId: null`，服务解绑成功。

- [ ] **Step 4: 提交验证完成的最终变更**

```bash
git add apps/backend apps/admin-web packages/hooks packages/types
git commit -m "feat(admin): complete massage service tag management loop"
```

---

## 执行记录（2026-04-17）

- Task 1-4 的代码实现已按顺序完成。
- Task 2 / Task 5 后端测试已通过：
  - `pnpm --filter backend test -- src/modules/admin/admin-service-tags.service.spec.ts src/modules/service/service.service.spec.ts --runInBand`
- `pnpm --filter admin-web type-check` 在当前仓库无对应 script，改用：
  - `pnpm --filter admin-web exec tsc --noEmit`
  - 结果被仓库既有类型错误阻塞（非本任务新增）。
- `pnpm backend:dev` / `pnpm admin:dev` 尝试启动时受 Turborepo 平台二进制下载阻塞，未继续展开环境排障。
- 所有 `git commit` 步骤按当前协作要求（“后续任务不要提交，由用户手动提交”）未执行。

## Self-Review

### Spec coverage

- 独立 `/service-tags` 页面：Task 3。
- 侧边栏新增入口：Task 3。
- 管理端标签 CRUD：Task 2 + Task 3。
- 固定 `domain = 'massage'`：Task 1 + Task 3。
- 不新增数据库迁移：本计划未涉及 schema / drizzle 文件。
- 服务编辑入口复用 `service-categories` Dialog：Task 4。
- 单标签绑定、允许解绑：Task 4。
- 删除规则 `serviceCount > 0 => 409`：Task 2。
- 停用标签不可新绑，但历史值可保留：Task 2 + Task 4。
- 前端 skeleton / 错误态 / 空态：Task 3。
- 回归验证按摩现有链路不受影响：Task 5。

### Placeholder scan

- 本计划未使用 `TODO` / `TBD` / “后续补充”。
- 每个代码步骤都给出明确文件路径、代码片段、运行命令和预期结果。

### Type consistency

- 统一使用 `AdminServiceTag*` 作为管理端类型前缀。
- 服务绑定字段统一为 `serviceTagId`。
- 列表查询状态统一为 `"all" | "active" | "inactive"`。

Plan complete and saved to `docs/superpowers/plans/2026-04-17-massage-service-tag-admin-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
