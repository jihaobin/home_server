# 服务人员发布服务审核与下架功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为服务人员发布服务增加待审核版本、管理员审核、管理员下架、用户端过滤、服务人员端原因展示、管理端三层表格。

**Architecture:** 新增审核稿表保存服务人员提交快照，审核通过后再事务性写入现有线上表；新增服务项状态表保存已通过服务的上下架状态和下架原因。管理端通过新 admin API 按“服务人员 -> 服务 -> 规格”三层读取和操作，用户端所有服务发现查询统一过滤未通过或已下架服务。

**Tech Stack:** NestJS 11、Drizzle、PostgreSQL、Zod、React Query、Next.js App Router、TanStack Table、Expo Router、NativeWind。

---

## Implementation Notes

- 不要提交 git commit；完成后交给用户审核。
- 遵循 TDD：每个后端行为先写失败测试，再实现。
- 先读设计文档：`docs/superpowers/specs/2026-05-13-service-offering-review-takedown-design.md`。
- 现有保存入口：`apps/backend/src/modules/work-skill/work-skill.controller.ts`、`apps/backend/src/modules/work-skill/work-skill.service.ts`、`apps/backend/src/modules/work-skill/work-skill.repository.ts`。
- 现有用户端查询入口：`apps/backend/src/modules/service-personnel/service-personnel.repository.ts`。
- 现有管理端页面模式：`apps/admin-web/src/app/(management)/merchant-join-requests/`。

## Task 1: 数据库 Schema 与共享类型

**Files:**
- Modify: `apps/backend/src/common/database/schema/server.ts`
- Modify: `packages/types/src/database-entity.ts`
- Modify: `packages/types/src/work-skill.ts`
- Modify: `packages/types/src/admin.ts`
- Create: `apps/backend/drizzle/0073_service_offering_review_takedown.sql`

- [ ] **Step 1: 在 schema 中新增服务审核枚举和状态表**

在 `apps/backend/src/common/database/schema/server.ts` 引入需要的 pg-core 类型后新增：

```ts
export const serviceOfferingDraftStatusEnum = pgEnum(
    'service_offering_draft_status',
    ['pending', 'approved', 'rejected'],
);

export const serviceOfferingPublicationStatusEnum = pgEnum(
    'service_offering_publication_status',
    ['active', 'taken_down'],
);

export const servicePersonnelOfferingDrafts = pgTable(
    'service_personnel_offering_drafts',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        personnelUserId: varchar('personnel_user_id', { length: 255 })
            .notNull()
            .references(() => servicePersonnel.userId, { onDelete: 'cascade' }),
        status: serviceOfferingDraftStatusEnum('status')
            .notNull()
            .default('pending'),
        submittedSnapshot: jsonb('submitted_snapshot').notNull(),
        rejectionReason: text('rejection_reason'),
        reviewedBy: varchar('reviewed_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        index('idx_service_offering_drafts_personnel_status').on(
            table.personnelUserId,
            table.status,
            table.updatedAt.desc(),
        ),
        uniqueIndex('uniq_service_offering_drafts_pending_personnel')
            .on(table.personnelUserId)
            .where(sql`status = 'pending'`),
    ],
);

export const servicePersonnelOfferingStatuses = pgTable(
    'service_personnel_offering_statuses',
    {
        personnelUserId: varchar('personnel_user_id', { length: 255 })
            .notNull()
            .references(() => servicePersonnel.userId, { onDelete: 'cascade' }),
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'cascade' }),
        publicationStatus: serviceOfferingPublicationStatusEnum(
            'publication_status',
        )
            .notNull()
            .default('active'),
        reviewStatus: serviceOfferingDraftStatusEnum('review_status')
            .notNull()
            .default('approved'),
        takeDownReason: text('take_down_reason'),
        takenDownBy: varchar('taken_down_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        takenDownAt: timestamp('taken_down_at', { withTimezone: true }),
        lastApprovedDraftId: varchar('last_approved_draft_id', {
            length: 255,
        }).references(() => servicePersonnelOfferingDrafts.id, {
            onDelete: 'set null',
        }),
        lastApprovedAt: timestamp('last_approved_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        primaryKey({
            columns: [table.personnelUserId, table.serviceId],
            name: 'service_personnel_offering_statuses_pkey',
        }),
        index('idx_service_offering_status_active').on(
            table.serviceId,
            table.publicationStatus,
        ),
        index('idx_service_offering_status_personnel').on(
            table.personnelUserId,
            table.publicationStatus,
        ),
    ],
);
```

- [ ] **Step 2: 写迁移 SQL**

Create `apps/backend/drizzle/0073_service_offering_review_takedown.sql`:

```sql
CREATE TYPE "service_offering_draft_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "service_offering_publication_status" AS ENUM ('active', 'taken_down');

CREATE TABLE "service_personnel_offering_drafts" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "personnel_user_id" varchar(255) NOT NULL,
    "status" "service_offering_draft_status" DEFAULT 'pending' NOT NULL,
    "submitted_snapshot" jsonb NOT NULL,
    "rejection_reason" text,
    "reviewed_by" varchar(255),
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "service_personnel_offering_drafts_id_unique" UNIQUE("id")
);

CREATE TABLE "service_personnel_offering_statuses" (
    "personnel_user_id" varchar(255) NOT NULL,
    "service_id" varchar(255) NOT NULL,
    "publication_status" "service_offering_publication_status" DEFAULT 'active' NOT NULL,
    "review_status" "service_offering_draft_status" DEFAULT 'approved' NOT NULL,
    "take_down_reason" text,
    "taken_down_by" varchar(255),
    "taken_down_at" timestamp with time zone,
    "last_approved_draft_id" varchar(255),
    "last_approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "service_personnel_offering_statuses_pkey" PRIMARY KEY("personnel_user_id","service_id")
);

ALTER TABLE "service_personnel_offering_drafts"
    ADD CONSTRAINT "service_personnel_offering_drafts_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_drafts"
    ADD CONSTRAINT "service_personnel_offering_drafts_reviewed_by_user_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_taken_down_by_user_id_fk"
    FOREIGN KEY ("taken_down_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "service_personnel_offering_statuses"
    ADD CONSTRAINT "service_personnel_offering_statuses_last_approved_draft_id_fk"
    FOREIGN KEY ("last_approved_draft_id") REFERENCES "public"."service_personnel_offering_drafts"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "idx_service_offering_drafts_personnel_status"
    ON "service_personnel_offering_drafts" USING btree ("personnel_user_id","status","updated_at");

CREATE UNIQUE INDEX "uniq_service_offering_drafts_pending_personnel"
    ON "service_personnel_offering_drafts" USING btree ("personnel_user_id")
    WHERE status = 'pending';

CREATE INDEX "idx_service_offering_status_active"
    ON "service_personnel_offering_statuses" USING btree ("service_id","publication_status");

CREATE INDEX "idx_service_offering_status_personnel"
    ON "service_personnel_offering_statuses" USING btree ("personnel_user_id","publication_status");

INSERT INTO "service_personnel_offering_statuses" (
    "personnel_user_id",
    "service_id",
    "publication_status",
    "review_status",
    "last_approved_at",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    "user_id",
    "service_id",
    'active',
    'approved',
    now(),
    now(),
    now()
FROM "service_personnel_skills";
```

- [ ] **Step 3: 扩展共享类型**

在 `packages/types/src/work-skill.ts` 增加：

```ts
export const ServiceOfferingDraftStatusSchema = z.enum([
    'pending',
    'approved',
    'rejected',
]);

export const ServiceOfferingPublicationStatusSchema = z.enum([
    'active',
    'taken_down',
]);

export const ServiceOfferingSubmittedSnapshotSchema =
    UpdateServiceOfferingsRequestSchema;

export const ServiceOfferingSubmissionResultSchema = z.object({
    draftId: z.string(),
    status: ServiceOfferingDraftStatusSchema,
    submittedAt: z.date(),
    message: z.string(),
});
```

在 `packages/types/src/admin.ts` 增加管理端列表与操作 schema：

```ts
export const AdminServiceOfferingListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    keyword: z.string().trim().optional(),
    reviewStatus: z
        .enum(['all', 'pending', 'approved', 'rejected'])
        .default('all'),
    publicationStatus: z.enum(['all', 'active', 'taken_down']).default('all'),
});

export const AdminServiceOfferingReasonSchema = z.object({
    reason: z.string().trim().min(1, '原因不能为空').max(500, '原因不能超过 500 个字符'),
});
```

- [ ] **Step 4: 验证类型编译**

Run:

```bash
pnpm type-check
```

Expected: 可能因后续代码未接入而失败；记录第一个与新增类型相关的错误，下一任务修复。

## Task 2: 后端待审核草稿写入

**Files:**
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`

- [ ] **Step 1: 写失败测试：保存服务只创建待审核稿**

在 `work-skill.service.spec.ts` 增加测试：

```ts
it('提交服务信息时创建待审核稿而不是直接发布', async () => {
    repository.findServicesByIds.mockResolvedValue([
        {
            id: 'svc_clean_1',
            categoryId: 'cat_clean',
            categoryName: '保洁',
        },
    ]);
    repository.submitServiceOfferingsForReview = jest.fn().mockResolvedValue({
        id: 'draft_1',
        status: 'pending',
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
    });
    repository.updateServiceOfferings.mockResolvedValue(undefined);

    const result = await service.updateServiceOfferings('worker_1', {
        services: [
            {
                serviceId: 'svc_clean_1',
                description: '深度保洁',
                galleryFileIds: [],
                specifications: [
                    {
                        name: '标准版',
                        price: '99',
                        currency: 'CNY',
                        estimatedDurationMinutes: 60,
                    },
                ],
            },
        ],
        merchantQualificationFileId: null,
        vocationalQualificationFileId: null,
    });

    expect(repository.submitServiceOfferingsForReview).toHaveBeenCalledWith(
        'worker_1',
        expect.objectContaining({
            services: expect.arrayContaining([
                expect.objectContaining({ serviceId: 'svc_clean_1' }),
            ]),
        }),
    );
    expect(repository.updateServiceOfferings).not.toHaveBeenCalled();
    expect(result).toEqual({
        draftId: 'draft_1',
        status: 'pending',
        submittedAt: new Date('2026-05-13T00:00:00.000Z'),
        message: '已提交审核，等待管理员审核',
    });
});
```

- [ ] **Step 2: 跑失败测试**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
```

Expected: FAIL，提示 `submitServiceOfferingsForReview` 或返回结构不存在。

- [ ] **Step 3: 实现 repository 草稿 upsert**

在 `WorkSkillRepository` 增加：

```ts
async submitServiceOfferingsForReview(
    personnelId: string,
    payload: UpdateServiceOfferingsRequest,
) {
    if (!(await this.isServicePersonnelExists(personnelId))) {
        throw new BadRequestException('该服务人员不存在');
    }

    const now = new Date();
    const [existing] = await this.db
        .select({ id: servicePersonnelOfferingDrafts.id })
        .from(servicePersonnelOfferingDrafts)
        .where(
            and(
                eq(servicePersonnelOfferingDrafts.personnelUserId, personnelId),
                eq(servicePersonnelOfferingDrafts.status, 'pending'),
            ),
        )
        .limit(1);

    if (existing) {
        const [updated] = await this.db
            .update(servicePersonnelOfferingDrafts)
            .set({
                submittedSnapshot: payload,
                updatedAt: now,
            })
            .where(eq(servicePersonnelOfferingDrafts.id, existing.id))
            .returning();
        return updated;
    }

    const [created] = await this.db
        .insert(servicePersonnelOfferingDrafts)
        .values({
            personnelUserId: personnelId,
            status: 'pending',
            submittedSnapshot: payload,
        })
        .returning();

    return created;
}
```

- [ ] **Step 4: 改 service 保存语义**

在 `WorkSkillService.updateServiceOfferings` 保留现有服务 ID 和资质校验，然后改为调用 `submitServiceOfferingsForReview`：

```ts
const draft = await this.workSkillRepository.submitServiceOfferingsForReview(
    personnelId,
    payload,
);

return {
    draftId: draft.id,
    status: draft.status,
    submittedAt: draft.createdAt ?? new Date(),
    message: '已提交审核，等待管理员审核',
};
```

- [ ] **Step 5: 更新 controller 响应 schema**

将 `PUT /workSkill/service-offerings` 成功响应改为 `ServiceOfferingSubmissionResultSchema`。

- [ ] **Step 6: 跑测试**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
```

Expected: PASS。

## Task 3: 管理端后端审核与下架 API

**Files:**
- Create: `apps/backend/src/modules/work-skill/admin-service-offerings.controller.ts`
- Create: `apps/backend/src/modules/work-skill/admin-service-offerings.service.ts`
- Create: `apps/backend/src/modules/work-skill/admin-service-offerings.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.module.ts`
- Create: `apps/backend/src/modules/work-skill/admin-service-offerings.service.spec.ts`

- [ ] **Step 1: 写失败测试：拒绝和下架必须有原因**

Create `admin-service-offerings.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { AdminServiceOfferingsService } from './admin-service-offerings.service';

describe('AdminServiceOfferingsService reason validation', () => {
    let service: AdminServiceOfferingsService;
    const repository = {
        rejectDraft: jest.fn(),
        takeDownOffering: jest.fn(),
    };
    const notificationPublisher = {
        publish: jest.fn(),
    };

    beforeEach(() => {
        service = new AdminServiceOfferingsService(
            repository as never,
            notificationPublisher as never,
        );
        jest.clearAllMocks();
    });

    it('拒绝审核稿时原因不能为空', async () => {
        await expect(
            service.rejectDraft('draft_1', 'admin_1', '   '),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.rejectDraft).not.toHaveBeenCalled();
    });

    it('下架服务时原因不能为空', async () => {
        await expect(
            service.takeDownOffering('worker_1', 'svc_1', 'admin_1', ''),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.takeDownOffering).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 跑失败测试**

Run:

```bash
pnpm --filter backend test admin-service-offerings.service.spec.ts
```

Expected: FAIL，service 文件不存在。

- [ ] **Step 3: 实现 service 操作**

`AdminServiceOfferingsService` 需要方法：

```ts
async list(query: AdminServiceOfferingListQuery) {
    return this.repository.list(query);
}

async approveDraft(draftId: string, adminUserId: string) {
    const result = await this.repository.approveDraft(draftId, adminUserId);
    await this.notificationPublisher.publish({
        event: 'service_offering_review_approved',
        payload: {
            event: 'service_offering_review_approved',
            userId: result.personnelUserId,
            personnelId: result.personnelUserId,
            draftId,
            action: 'approved',
        },
    });
    return result;
}

async rejectDraft(draftId: string, adminUserId: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
        throw new BadRequestException('拒绝原因不能为空');
    }
    const result = await this.repository.rejectDraft(
        draftId,
        adminUserId,
        normalizedReason,
    );
    await this.notificationPublisher.publish({
        event: 'service_offering_review_rejected',
        payload: {
            event: 'service_offering_review_rejected',
            userId: result.personnelUserId,
            personnelId: result.personnelUserId,
            draftId,
            action: 'rejected',
            reason: normalizedReason,
        },
    });
    return result;
}

async takeDownOffering(
    personnelId: string,
    serviceId: string,
    adminUserId: string,
    reason: string,
) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
        throw new BadRequestException('下架原因不能为空');
    }
    const result = await this.repository.takeDownOffering(
        personnelId,
        serviceId,
        adminUserId,
        normalizedReason,
    );
    await this.notificationPublisher.publish({
        event: 'service_offering_taken_down',
        payload: {
            event: 'service_offering_taken_down',
            userId: personnelId,
            personnelId,
            serviceId,
            action: 'taken_down',
            reason: normalizedReason,
        },
    });
    return result;
}
```

- [ ] **Step 4: 实现 repository approveDraft**

`approveDraft` 必须在一个事务中：

1. 锁定并读取 `pending` draft。
2. 解析 `submittedSnapshot` 为 `UpdateServiceOfferingsRequestSchema`。
3. 更新 `servicePersonnel` 资质字段。
4. 删除该人员现有 `servicePersonnelSkills` 和 `servicePersonnelPricing`。
5. 插入快照中的服务和规格。
6. upsert `servicePersonnelOfferingStatuses`，设为 `active` / `approved`，清空下架原因。
7. 将不在快照中的旧服务项标记为 `taken_down` 或保留历史但不再 active；推荐标记 `taken_down` 并 reason 为 `服务人员已移除此服务`。
8. 更新 draft 为 `approved`。

- [ ] **Step 5: 实现 repository rejectDraft / takeDownOffering / list**

`rejectDraft`：

- 只允许 `pending` draft。
- 更新 `status = rejected`、`rejectionReason`、`reviewedBy`、`reviewedAt`。

`takeDownOffering`：

- upsert `servicePersonnelOfferingStatuses` 为 `taken_down`。
- 写入 `takeDownReason`、`takenDownBy`、`takenDownAt`。

`list`：

- 分页查服务人员父行。
- 聚合待审核草稿、服务状态、服务信息、规格信息。
- 返回结构匹配 `AdminServiceOfferingListResponseSchema`。

- [ ] **Step 6: 实现 controller**

`AdminServiceOfferingsController`：

```ts
@ApiTags('管理端服务发布管理')
@Controller('admin/service-offerings')
@UseGuards(AuthGuard)
@Roles(['admin', 'super_admin'])
export class AdminServiceOfferingsController {
    constructor(private readonly service: AdminServiceOfferingsService) {}

    @Get()
    list(@Query(new ZodValidationPipe(AdminServiceOfferingListQuerySchema)) query) {
        return this.service.list(query);
    }

    @Post('drafts/:id/approve')
    approve(@Param('id') id: string, @Req() req: Request) {
        return this.service.approveDraft(id, req.user.id);
    }

    @Post('drafts/:id/reject')
    reject(
        @Param('id') id: string,
        @Body(new ZodValidationPipe(AdminServiceOfferingReasonSchema)) body,
        @Req() req: Request,
    ) {
        return this.service.rejectDraft(id, req.user.id, body.reason);
    }

    @Post(':personnelId/:serviceId/take-down')
    takeDown(
        @Param('personnelId') personnelId: string,
        @Param('serviceId') serviceId: string,
        @Body(new ZodValidationPipe(AdminServiceOfferingReasonSchema)) body,
        @Req() req: Request,
    ) {
        return this.service.takeDownOffering(
            personnelId,
            serviceId,
            req.user.id,
            body.reason,
        );
    }
}
```

- [ ] **Step 7: 注册 module**

`WorkSkillModule` imports `NotificationModule`，providers 加 admin service/repository，controllers 加 admin controller。

- [ ] **Step 8: 跑测试**

Run:

```bash
pnpm --filter backend test admin-service-offerings.service.spec.ts
pnpm --filter backend test work-skill.service.spec.ts
```

Expected: PASS。

## Task 4: 用户端服务发现过滤下架服务

**Files:**
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 service personnel 查询测试中加入断言：`findMatchedPersonnel`、`searchPersonnelByServiceIds`、人员详情查询都必须 join `service_personnel_offering_statuses` 并过滤 `publication_status = active`。

如果现有测试难以断言 SQL，新增 repository helper 单元测试，测试 `buildActiveOfferingCondition` 返回包含 active 状态的条件。

- [ ] **Step 2: 跑失败测试**

Run:

```bash
pnpm --filter backend test service-personnel.service.spec.ts
```

Expected: FAIL，当前查询未过滤新状态。

- [ ] **Step 3: 更新查询**

在所有使用 `servicePersonnelPricing` + `servicePersonnelSkills` 的用户端查询中 join `servicePersonnelOfferingStatuses`：

```ts
.innerJoin(
    servicePersonnelOfferingStatuses,
    and(
        eq(
            servicePersonnelOfferingStatuses.personnelUserId,
            servicePersonnelPricing.userId,
        ),
        eq(
            servicePersonnelOfferingStatuses.serviceId,
            servicePersonnelPricing.serviceId,
        ),
        eq(servicePersonnelOfferingStatuses.publicationStatus, 'active'),
        eq(servicePersonnelOfferingStatuses.reviewStatus, 'approved'),
    ),
)
```

同时保留：

- `servicePersonnel.isAvailable = true`
- `services.isActive = true`
- `servicePersonnelPricing.isActive = true`

- [ ] **Step 4: 更新 work-skill 详情读取**

`getPersonnelInfo` 返回服务人员自己的服务设置时可以显示已下架服务和原因；用户端公开详情必须过滤。若同一方法被两类入口复用，拆出：

- `getPersonnelInfoForOwner`
- `getPublishedPersonnelInfo`

- [ ] **Step 5: 跑测试**

Run:

```bash
pnpm --filter backend test service-personnel.service.spec.ts
pnpm --filter backend test work-skill.service.spec.ts
```

Expected: PASS。

## Task 5: 管理端 hooks 与页面

**Files:**
- Create: `packages/hooks/src/api/ssr/admin-service-offerings.ts`
- Modify: `packages/hooks/src/api/ssr/index.ts`
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
- Modify: `apps/admin-web/src/components/layout/nav-config.ts`
- Create: `apps/admin-web/src/app/(management)/service-offerings/page.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_utils/query.ts`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-page-section.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-page-content.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-table.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-filter-bar.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offering-reason-dialog.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-table-skeleton.tsx`
- Create: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-page-error.tsx`

- [ ] **Step 1: 创建 SSR hooks**

按 `admin-merchant-join-requests.ts` 模式实现：

- `adminServiceOfferingsQueryOptions`
- `adminServiceOfferingsQueryKey`
- `normalizeAdminServiceOfferingsQuery`
- `useAdminServiceOfferings`
- `invalidateAdminServiceOfferingsQuery`
- `useApproveAdminServiceOfferingDraft`
- `useRejectAdminServiceOfferingDraft`
- `useTakeDownAdminServiceOffering`

- [ ] **Step 2: 导出 hooks**

在 `packages/hooks/src/api/ssr/index.ts` 导出新增 hooks 和类型。

- [ ] **Step 3: 添加预取**

在 `apps/admin-web/src/lib/prefetchers.ts` 增加 `preloadServiceOfferingsPageState(query)`，完全沿用 merchant join requests 的鉴权错误处理。

- [ ] **Step 4: 添加导航**

在 `apps/admin-web/src/components/layout/nav-config.ts` 的运营管理组加入：

```ts
{
    title: "服务发布管理",
    href: "/service-offerings",
    icon: ClipboardCheck,
}
```

- [ ] **Step 5: 实现 query utils**

`_utils/query.ts` 支持：

- `page`
- `limit`
- `keyword`
- `reviewStatus`
- `publicationStatus`

- [ ] **Step 6: 实现三层表格**

`service-offerings-table.tsx` 用 TanStack Table 展示：

- 父表格行：服务人员。
- 展开行渲染服务子表格。
- 服务行再展开渲染规格表格。

服务行按钮：

- `pending` 草稿：审核通过、审核拒绝。
- `active` 已上线：下架。
- `taken_down`：只展示原因，不显示恢复。

- [ ] **Step 7: 实现原因弹窗**

`service-offering-reason-dialog.tsx`：

- props: `open`、`title`、`description`、`confirmLabel`、`onConfirm(reason)`。
- Textarea 必填。
- trim 后为空时禁用提交。
- mutation 成功后关闭并 toast。

- [ ] **Step 8: 跑前端类型检查**

Run:

```bash
pnpm type-check
```

Expected: PASS，或只剩与本任务无关的既有环境错误。

## Task 6: 服务人员端状态展示

**Files:**
- Modify: `packages/hooks/src/api/work-skill/index.ts`
- Modify: `apps/mobile-worker/app/profile/service-settings-redesign.tsx`
- Modify: `apps/mobile-worker/app/profile/service-settings-manage-redesign.tsx`
- Modify: `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx`

- [ ] **Step 1: 更新 hook 返回类型**

保存服务信息 mutation 使用 `ServiceOfferingSubmissionResultSchema`。

- [ ] **Step 2: 更新保存文案**

移动端服务设置保存按钮文案改为：

```tsx
提交审核
```

保存成功 toast：

```ts
toast.success("已提交审核，等待管理员审核");
```

- [ ] **Step 3: 展示状态与原因**

在服务设置管理页顶部增加紧凑状态区：

- 有 pending 草稿：显示“待审核”。
- 最近 rejected 草稿：显示“审核未通过：{reason}”。
- 有 taken_down 服务：在对应服务卡片显示“已下架：{reason}”。

- [ ] **Step 4: 避免修改用户端 app**

本任务只改 `apps/mobile-worker`。用户端展示过滤由后端保证。

- [ ] **Step 5: 跑类型检查**

Run:

```bash
pnpm type-check
```

Expected: PASS，或只剩与本任务无关的既有环境错误。

## Task 7: 集成验证

**Files:**
- No code changes unless verification finds a bug.

- [ ] **Step 1: 后端测试**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm --filter backend test admin-service-offerings.service.spec.ts
pnpm --filter backend test service-personnel.service.spec.ts
```

Expected: PASS。

- [ ] **Step 2: 全仓类型检查**

Run:

```bash
pnpm type-check
```

Expected: PASS。

- [ ] **Step 3: 手工验收路径**

验证：

1. 服务人员新增服务后生成 pending draft，用户端不展示新增服务。
2. 服务人员修改已上线服务后，审核前用户端仍展示旧版本。
3. 管理员审核通过后，用户端展示新版本。
4. 管理员拒绝后，服务人员端展示拒绝原因并收到通知。
5. 管理员下架后，用户端列表、搜索、人员详情都不展示该服务。
6. 管理员下架原因展示在服务人员端并触发通知。
7. 管理端三层表格能展开到规格层。

## Self-Review

- Spec coverage: 覆盖待审核版本、审核通过、审核拒绝原因、管理员下架原因、用户端过滤、通知、三层表格。
- 占位内容检查：无未填项。
- Risk: `approveDraft` 会替换服务人员完整服务列表，必须保持事务；如果产品后续需要“单服务审核”，再拆草稿粒度。
- Verification: 以 backend targeted tests + `pnpm type-check` 为最低验收。
