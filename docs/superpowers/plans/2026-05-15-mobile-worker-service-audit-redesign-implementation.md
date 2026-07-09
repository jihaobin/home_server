# Mobile Worker Service Audit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-05-15-mobile-worker-service-audit-redesign.md` 重构服务人员端服务发布/审核流，让“我的服务 / 服务库 / 编辑服务”三页基于同一套后端派生状态展示和操作。

**Architecture:** 后端新增服务人员视角的聚合接口，统一计算 `derivedStatus`、草稿、主体和时间线，前端只消费该模型，不再各页自行推断审核状态。提交路径拆成“敏感字段走 draft 审核、非敏感字段直接更新主体、pending 可撤回、rejected 可复用同一 draft 重提”，移动端三页共享状态配置、徽章、进度条和卡片结构。

**Tech Stack:** NestJS 11 + Drizzle + Zod + pnpm workspace；React Query hooks in `packages/hooks`；Expo Router + React Native + NativeWind + `@repo/mobile-ui`。

---

## 执行前约束

- 当前工作区可能已有相关未提交改动。实施前必须运行 `git status --short` 和目标文件 `git diff`，只在现有改动上增量修改，不允许 revert 或覆盖非本任务改动。
- 本计划涉及 DB schema 和 migration，因为 spec 明确要求新增 `submitted_at` 和 `service_offering_audit_logs`。不要新增其它表，不要改无关 schema。
- 默认不要提交 git commit。每个任务末尾保留“提交检查点”命令，仅在用户明确要求提交时执行。
- 先读这两个文档：`docs/superpowers/specs/2026-05-15-mobile-worker-service-audit-redesign.md` 和 `docs/superpowers/specs/2026-05-13-service-offering-review-takedown-design.md`。

## File Structure

- Modify: `apps/backend/src/common/database/schema/server.ts`
  - 给 `service_personnel_offering_drafts` 增加 `submittedAt`。
  - 新增 `service_offering_audit_logs` 表、enum 和 relations。
- Create: `apps/backend/drizzle/0075_service_offering_audit_logs.sql`
  - 手写或由 Drizzle 生成后核对；包含字段、索引、历史回填。
- Modify/Create: `apps/backend/drizzle/meta/_journal.json` and latest snapshot
  - 如果使用 `pnpm --filter backend db:generate`，保留生成结果并核对无额外漂移。
- Modify: `packages/types/src/work-skill.ts`
  - 增加 worker 服务聚合模型、服务库 `isAdded` 扩展、撤回响应、非敏感字段更新请求。
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
  - 查询主体、draft、audit logs，写 draft、撤回、重提、非敏感更新、audit log。
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
  - 统一业务规则：derived status、敏感/非敏感提交路径、撤回校验。
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`
  - 暴露移动端接口：`GET /workSkill/worker/services`、`PUT /workSkill/worker/services/:serviceId`、`DELETE /workSkill/worker/services/:serviceId/draft`。
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`
  - 覆盖聚合状态、撤回、重提、敏感/非敏感路径。
- Modify: `packages/hooks/src/api/work-skill/index.ts`
  - 新增 `useMyWorkerServices`、`useSubmitServiceUpdate`、`useUpdateServiceNonSensitiveFields`、`useWithdrawServiceDraft`。
- Modify: `apps/mobile-worker/app/profile/service-settings-redesign.tsx`
  - “我的服务”改为 Tab + 4 主状态列表，使用聚合接口。
- Modify: `apps/mobile-worker/app/profile/service-settings-manage-redesign.tsx`
  - 服务库只显示平台目录和 `isAdded`，不暴露审核/下架状态。
- Modify: `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx`
  - 5 种模式、脏检查、敏感字段判断、底部危险操作、撤回/重提/覆盖 draft。
- Create: `apps/mobile-worker/app/profile/service-settings-audit-model.ts`
  - 移动端状态配置、Tab 分组、按钮文案、时间格式和脏检查 helper。

---

### Task 1: Schema and Shared Types(complete)

**Files:**
- Modify: `apps/backend/src/common/database/schema/server.ts`
- Create: `apps/backend/drizzle/0075_service_offering_audit_logs.sql`
- Modify: `packages/types/src/work-skill.ts`

- [ ] **Step 1: Inspect current diff before editing**

Run:

```bash
git status --short apps/backend/src/common/database/schema/server.ts packages/types/src/work-skill.ts apps/backend/drizzle
git diff -- apps/backend/src/common/database/schema/server.ts packages/types/src/work-skill.ts
```

Expected: shows existing user/worktree changes if any. Do not revert them.

- [ ] **Step 2: Add schema fields and audit log table**

In `apps/backend/src/common/database/schema/server.ts`, extend the existing service offering schema section with this shape. Keep local import/style order consistent with the file:

```ts
export const serviceOfferingAuditLogTypeEnum = pgEnum(
    'service_offering_audit_log_type',
    ['submitted', 'approved', 'rejected', 'takendown', 'restored'],
);

export const servicePersonnelOfferingDrafts = pgTable(
    'service_personnel_offering_drafts',
    {
        // keep existing fields
        submittedAt: timestamp('submitted_at', { withTimezone: true }),
    },
    (table) => [
        // keep existing indexes
    ],
);

export const serviceOfferingAuditLogs = pgTable(
    'service_offering_audit_logs',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId()),
        personnelUserId: varchar('personnel_user_id', { length: 255 })
            .notNull()
            .references(() => servicePersonnel.userId, { onDelete: 'cascade' }),
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'cascade' }),
        draftId: varchar('draft_id', { length: 255 }).references(
            () => servicePersonnelOfferingDrafts.id,
            { onDelete: 'set null' },
        ),
        type: serviceOfferingAuditLogTypeEnum('type').notNull(),
        occurredAt: timestamp('occurred_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        operatorId: varchar('operator_id', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        note: text('note'),
    },
    (table) => [
        index('idx_service_offering_audit_logs_personnel_service').on(
            table.personnelUserId,
            table.serviceId,
            table.occurredAt,
        ),
        index('idx_service_offering_audit_logs_draft').on(table.draftId),
    ],
);
```

Add relations:

```ts
export const serviceOfferingAuditLogsRelations = relations(
    serviceOfferingAuditLogs,
    ({ one }) => ({
        personnel: one(servicePersonnel, {
            fields: [serviceOfferingAuditLogs.personnelUserId],
            references: [servicePersonnel.userId],
        }),
        service: one(services, {
            fields: [serviceOfferingAuditLogs.serviceId],
            references: [services.id],
        }),
        draft: one(servicePersonnelOfferingDrafts, {
            fields: [serviceOfferingAuditLogs.draftId],
            references: [servicePersonnelOfferingDrafts.id],
        }),
        operator: one(users, {
            fields: [serviceOfferingAuditLogs.operatorId],
            references: [users.id],
        }),
    }),
);
```

- [ ] **Step 3: Create migration**

Prefer generator first:

```bash
pnpm --filter backend db:generate
```

Expected: creates a new migration and snapshot. Rename generated SQL to the next repo sequence if needed. If generator fails because local DB/tooling is unavailable, manually create `apps/backend/drizzle/0075_service_offering_audit_logs.sql` with:

```sql
CREATE TYPE "public"."service_offering_audit_log_type" AS ENUM(
    'submitted',
    'approved',
    'rejected',
    'takendown',
    'restored'
);

ALTER TABLE "service_personnel_offering_drafts"
    ADD COLUMN "submitted_at" timestamp with time zone;

UPDATE "service_personnel_offering_drafts"
SET "submitted_at" = COALESCE("reviewed_at", "updated_at", "created_at")
WHERE "submitted_at" IS NULL;

CREATE TABLE "service_offering_audit_logs" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "personnel_user_id" varchar(255) NOT NULL,
    "service_id" varchar(255) NOT NULL,
    "draft_id" varchar(255),
    "type" "service_offering_audit_log_type" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
    "operator_id" varchar(255),
    "note" text
);

ALTER TABLE "service_offering_audit_logs"
    ADD CONSTRAINT "service_offering_audit_logs_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id")
    ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_offering_audit_logs"
    ADD CONSTRAINT "service_offering_audit_logs_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_offering_audit_logs"
    ADD CONSTRAINT "service_offering_audit_logs_draft_id_service_personnel_offering_drafts_id_fk"
    FOREIGN KEY ("draft_id") REFERENCES "public"."service_personnel_offering_drafts"("id")
    ON DELETE set null ON UPDATE no action;

ALTER TABLE "service_offering_audit_logs"
    ADD CONSTRAINT "service_offering_audit_logs_operator_id_users_id_fk"
    FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;

CREATE INDEX "idx_service_offering_audit_logs_personnel_service"
    ON "service_offering_audit_logs" USING btree ("personnel_user_id", "service_id", "occurred_at");

CREATE INDEX "idx_service_offering_audit_logs_draft"
    ON "service_offering_audit_logs" USING btree ("draft_id");

INSERT INTO "service_offering_audit_logs" (
    "id",
    "personnel_user_id",
    "service_id",
    "draft_id",
    "type",
    "occurred_at",
    "operator_id",
    "note"
)
SELECT
    'audit_' || md5(random()::text || clock_timestamp()::text || d."id"),
    d."personnel_user_id",
    d."service_id",
    d."id",
    'submitted',
    COALESCE(d."submitted_at", d."created_at", now()),
    NULL,
    '历史数据迁移'
FROM "service_personnel_offering_drafts" d;

INSERT INTO "service_offering_audit_logs" (
    "id",
    "personnel_user_id",
    "service_id",
    "draft_id",
    "type",
    "occurred_at",
    "operator_id",
    "note"
)
SELECT
    'audit_' || md5(random()::text || clock_timestamp()::text || s."personnel_user_id" || s."service_id"),
    s."personnel_user_id",
    s."service_id",
    s."last_approved_draft_id",
    CASE
        WHEN s."publication_status" = 'taken_down' THEN 'takendown'
        ELSE 'approved'
    END,
    COALESCE(s."taken_down_at", s."last_approved_at", now()),
    s."taken_down_by",
    '历史数据迁移'
FROM "service_personnel_offering_statuses" s
WHERE s."last_approved_at" IS NOT NULL OR s."taken_down_at" IS NOT NULL;
```

- [ ] **Step 4: Add shared Zod types**

In `packages/types/src/work-skill.ts`, add below the existing offering status schemas:

```ts
export const WorkerServiceDerivedStatusSchema = z.enum([
    "pending",
    "active",
    "active_with_pending_update",
    "active_with_rejected_update",
    "rejected",
    "takendown",
]);

export const WorkerServiceTimelineTypeSchema = z.enum([
    "submitted",
    "reviewing",
    "approved",
    "rejected",
    "takendown",
    "updated",
]);

export const WorkerServiceTimelineItemSchema = z.object({
    type: WorkerServiceTimelineTypeSchema,
    at: z.date().nullable(),
    note: z.string().nullable().optional(),
});

export const WorkerServiceDraftSchema = z.object({
    id: z.string(),
    status: z.enum(["pending", "rejected"]),
    submittedSnapshot: ServiceOfferingSubmittedSnapshotSchema,
    submittedAt: z.date().nullable(),
    reviewedAt: z.date().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
});

export const WorkerServiceOfferingSchema = z.object({
    id: z.string(),
    name: z.string(),
    categoryId: z.string().nullable().optional(),
    categoryName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    galleryFileIds: z.array(z.string()).default([]),
    gallery: z.array(FileAccessInfoSchema).default([]),
    specifications: z.array(specificationSchema).default([]),
    publicationStatus: ServiceOfferingPublicationStatusSchema,
    takedownReason: z.string().nullable().optional(),
    takedownAt: z.date().nullable().optional(),
});

export const WorkerServiceItemSchema = z.object({
    offering: WorkerServiceOfferingSchema.nullable(),
    draft: WorkerServiceDraftSchema.nullable(),
    derivedStatus: WorkerServiceDerivedStatusSchema,
    timeline: z.array(WorkerServiceTimelineItemSchema).default([]),
});

export const WorkerServiceListResponseSchema = z.array(WorkerServiceItemSchema);

export const WithdrawServiceDraftResponseSchema = z.object({
    serviceId: z.string(),
    withdrawn: z.literal(true),
    message: z.string(),
});

export const UpdateServiceNonSensitiveFieldsRequestSchema = z.object({
    serviceId: z.string().min(1, "服务ID不能为空"),
    defaultSpecificationId: z.string().nullable().optional(),
});
```

Add exports:

```ts
export type WorkerServiceDerivedStatus = z.infer<
    typeof WorkerServiceDerivedStatusSchema
>;
export type WorkerServiceTimelineItem = z.infer<
    typeof WorkerServiceTimelineItemSchema
>;
export type WorkerServiceDraft = z.infer<typeof WorkerServiceDraftSchema>;
export type WorkerServiceOffering = z.infer<typeof WorkerServiceOfferingSchema>;
export type WorkerServiceItem = z.infer<typeof WorkerServiceItemSchema>;
export type WorkerServiceListResponse = z.infer<
    typeof WorkerServiceListResponseSchema
>;
export type WithdrawServiceDraftResponse = z.infer<
    typeof WithdrawServiceDraftResponseSchema
>;
export type UpdateServiceNonSensitiveFieldsRequest = z.infer<
    typeof UpdateServiceNonSensitiveFieldsRequestSchema
>;
```

- [ ] **Step 5: Run type check for shared types**

Run:

```bash
pnpm type-check
```

Expected: pass, or fail only with known pre-existing errors unrelated to these files. Capture exact errors if failed.

- [ ] **Step 6: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/backend/src/common/database/schema/server.ts apps/backend/drizzle packages/types/src/work-skill.ts
git commit -m "feat(worker): add service audit schema types"
```

---

### Task 2: Backend Aggregation and Draft Actions(complete)

**Files:**
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`

- [ ] **Step 1: Add failing service tests**

In `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`, add tests for these cases. Use existing mock setup style in the file:

```ts
describe('worker service audit aggregation', () => {
    it('returns active_with_pending_update when active offering has a pending draft', async () => {
        repository.listWorkerServices.mockResolvedValue([
            {
                offering: {
                    id: 'svc_1',
                    name: '深层按摩',
                    categoryId: 'cat_1',
                    categoryName: '按摩',
                    description: '线上版本',
                    icon: null,
                    galleryFileIds: [],
                    gallery: [],
                    specifications: [],
                    publicationStatus: 'active',
                    takedownReason: null,
                    takedownAt: null,
                },
                draft: {
                    id: 'draft_1',
                    status: 'pending',
                    submittedSnapshot: {
                        services: [
                            {
                                serviceId: 'svc_1',
                                description: '待审版本',
                                galleryFileIds: [],
                                specifications: [
                                    {
                                        name: '标准版',
                                        price: '199',
                                        currency: 'CNY',
                                        estimatedDurationMinutes: 60,
                                    },
                                ],
                            },
                        ],
                    },
                    submittedAt: new Date('2026-05-15T01:00:00.000Z'),
                    reviewedAt: null,
                    rejectionReason: null,
                },
                derivedStatus: 'active_with_pending_update',
                timeline: [],
            },
        ]);

        await expect(service.listWorkerServices('worker_1')).resolves.toEqual([
            expect.objectContaining({
                derivedStatus: 'active_with_pending_update',
                draft: expect.objectContaining({ id: 'draft_1' }),
            }),
        ]);
    });

    it('withdraws only pending drafts owned by current worker', async () => {
        repository.withdrawServiceDraft.mockResolvedValue({
            serviceId: 'svc_1',
            withdrawn: true,
            message: '已撤回提交',
        });

        await expect(
            service.withdrawServiceDraft('worker_1', 'svc_1'),
        ).resolves.toEqual({
            serviceId: 'svc_1',
            withdrawn: true,
            message: '已撤回提交',
        });

        expect(repository.withdrawServiceDraft).toHaveBeenCalledWith(
            'worker_1',
            'svc_1',
        );
    });

    it('updates non-sensitive fields without submitting a draft', async () => {
        repository.updateServiceNonSensitiveFields.mockResolvedValue({
            serviceId: 'svc_1',
            updated: true,
        });

        await expect(
            service.updateServiceNonSensitiveFields('worker_1', {
                serviceId: 'svc_1',
                defaultSpecificationId: 'pricing_1',
            }),
        ).resolves.toEqual({ serviceId: 'svc_1', updated: true });
    });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
```

Expected: fail with missing `listWorkerServices`, `withdrawServiceDraft`, or `updateServiceNonSensitiveFields`.

- [ ] **Step 3: Implement repository methods**

In `apps/backend/src/modules/work-skill/work-skill.repository.ts`, add methods with these signatures:

```ts
async listWorkerServices(personnelId: string): Promise<WorkerServiceItem[]> {
    const rows = await this.getPersonnelInfoById(personnelId, {
        publicOnly: false,
    });
    const services = rows?.services ?? [];
    const logs = await this.listServiceAuditLogs(personnelId);
    return services.map((service) =>
        this.toWorkerServiceItem(service, logs.get(service.serviceId) ?? []),
    );
}

async withdrawServiceDraft(
    personnelId: string,
    serviceId: string,
): Promise<WithdrawServiceDraftResponse> {
    const draft = await this.findLatestDraft(personnelId, serviceId);
    if (!draft || draft.status !== 'pending') {
        throw new BadRequestException('当前服务没有可撤回的审核提交');
    }

    await this.db.transaction(async (tx) => {
        await tx
            .delete(servicePersonnelOfferingDrafts)
            .where(eq(servicePersonnelOfferingDrafts.id, draft.id));
        await tx.insert(serviceOfferingAuditLogs).values({
            personnelUserId: personnelId,
            serviceId,
            draftId: draft.id,
            type: 'submitted',
            occurredAt: new Date(),
            note: '服务人员撤回提交',
        });
    });

    return {
        serviceId,
        withdrawn: true,
        message: '已撤回提交',
    };
}

async updateServiceNonSensitiveFields(
    personnelId: string,
    payload: UpdateServiceNonSensitiveFieldsRequest,
): Promise<{ serviceId: string; updated: true }> {
    if (payload.defaultSpecificationId) {
        await this.setDefaultPricing(
            personnelId,
            payload.serviceId,
            payload.defaultSpecificationId,
        );
    }

    return { serviceId: payload.serviceId, updated: true };
}
```

If helpers do not exist, add these focused private helpers in the same repository:

```ts
private async listServiceAuditLogs(
    personnelId: string,
): Promise<Map<string, WorkerServiceTimelineItem[]>> {
    const logs = await this.db.query.serviceOfferingAuditLogs.findMany({
        where: eq(serviceOfferingAuditLogs.personnelUserId, personnelId),
        orderBy: [asc(serviceOfferingAuditLogs.occurredAt)],
    });

    const result = new Map<string, WorkerServiceTimelineItem[]>();
    for (const log of logs) {
        const list = result.get(log.serviceId) ?? [];
        list.push({
            type: this.toTimelineType(log.type),
            at: log.occurredAt,
            note: log.note,
        });
        result.set(log.serviceId, list);
    }
    return result;
}

private toTimelineType(
    type: 'submitted' | 'approved' | 'rejected' | 'takendown' | 'restored',
): WorkerServiceTimelineItem['type'] {
    if (type === 'submitted') return 'submitted';
    if (type === 'approved') return 'approved';
    if (type === 'rejected') return 'rejected';
    if (type === 'takendown') return 'takendown';
    return 'updated';
}
```

For `toWorkerServiceItem`, implement exact derived-status rules:

```ts
private toWorkerServiceItem(
    service: ServicePersonnelProfile['services'][number],
    timeline: WorkerServiceTimelineItem[],
): WorkerServiceItem {
    const hasOffering = service.publicationStatus === 'active' ||
        service.publicationStatus === 'taken_down';
    const hasPendingDraft = service.reviewStatus === 'pending' ||
        Boolean(service.pendingDraftId);
    const hasRejectedDraft = service.reviewStatus === 'rejected' &&
        Boolean(service.rejectionReason);

    let derivedStatus: WorkerServiceDerivedStatus;
    if (service.publicationStatus === 'taken_down') {
        derivedStatus = 'takendown';
    } else if (hasOffering && hasPendingDraft) {
        derivedStatus = 'active_with_pending_update';
    } else if (hasOffering && hasRejectedDraft) {
        derivedStatus = 'active_with_rejected_update';
    } else if (!hasOffering && hasPendingDraft) {
        derivedStatus = 'pending';
    } else if (!hasOffering && hasRejectedDraft) {
        derivedStatus = 'rejected';
    } else {
        derivedStatus = 'active';
    }

    return {
        offering: hasOffering
            ? {
                  id: service.serviceId,
                  name: service.serviceName,
                  categoryId: service.categoryId ?? null,
                  categoryName: service.categoryName ?? null,
                  description: service.personnelDescription,
                  icon: null,
                  galleryFileIds: service.galleryFileIds,
                  gallery: service.gallery,
                  specifications: service.specifications,
                  publicationStatus: service.publicationStatus,
                  takedownReason: service.takeDownReason ?? null,
                  takedownAt: service.takenDownAt ?? null,
              }
            : null,
        draft: hasPendingDraft || hasRejectedDraft
            ? this.buildWorkerDraft(service)
            : null,
        derivedStatus,
        timeline,
    };
}
```

If current repository already exposes richer draft snapshot rows, use those rows for `draft.submittedSnapshot`. Do not fabricate sensitive fields from the active offering when a real draft snapshot exists.

- [ ] **Step 4: Update submit/rejected draft behavior**

Modify `submitServiceOfferingsForReview` path so rejected draft resubmission reuses the same draft row:

```ts
await tx
    .update(servicePersonnelOfferingDrafts)
    .set({
        status: 'pending',
        submittedSnapshot: payload,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        updatedAt: now,
    })
    .where(
        and(
            eq(servicePersonnelOfferingDrafts.personnelUserId, personnelId),
            eq(servicePersonnelOfferingDrafts.serviceId, serviceId),
            eq(servicePersonnelOfferingDrafts.status, 'rejected'),
        ),
    );
```

When inserting or updating any submitted draft, append:

```ts
await tx.insert(serviceOfferingAuditLogs).values({
    personnelUserId: personnelId,
    serviceId,
    draftId: draft.id,
    type: 'submitted',
    occurredAt: now,
    note: null,
});
```

- [ ] **Step 5: Implement service and controller APIs**

In `apps/backend/src/modules/work-skill/work-skill.service.ts`, add:

```ts
async listWorkerServices(personnelId: string): Promise<WorkerServiceItem[]> {
    return await this.workSkillRepository.listWorkerServices(personnelId);
}

async withdrawServiceDraft(
    personnelId: string,
    serviceId: string,
): Promise<WithdrawServiceDraftResponse> {
    return await this.workSkillRepository.withdrawServiceDraft(
        personnelId,
        serviceId,
    );
}

async updateServiceNonSensitiveFields(
    personnelId: string,
    payload: UpdateServiceNonSensitiveFieldsRequest,
) {
    return await this.workSkillRepository.updateServiceNonSensitiveFields(
        personnelId,
        payload,
    );
}
```

In `apps/backend/src/modules/work-skill/work-skill.controller.ts`, add authenticated routes:

```ts
@UseGuards(AuthGuard)
@Get('worker/services')
@ApiOperation({ summary: '获取服务人员服务审核聚合列表' })
@ApiSuccessResponse(WorkerServiceListResponseSchema)
async listWorkerServices(@Req() req: Request) {
    return await this.workSkillService.listWorkerServices(req.user.id);
}

@UseGuards(AuthGuard)
@Put('worker/services/:serviceId')
@UsePipes(new ZodValidationPipe(UpdateServiceNonSensitiveFieldsRequestSchema))
@ApiOperation({ summary: '更新服务人员服务非敏感字段' })
async updateWorkerServiceNonSensitiveFields(
    @Param('serviceId') serviceId: string,
    @Body() body: Omit<UpdateServiceNonSensitiveFieldsRequest, 'serviceId'>,
    @Req() req: Request,
) {
    return await this.workSkillService.updateServiceNonSensitiveFields(
        req.user.id,
        { ...body, serviceId },
    );
}

@UseGuards(AuthGuard)
@Delete('worker/services/:serviceId/draft')
@ApiOperation({ summary: '撤回服务审核草稿' })
@ApiSuccessResponse(WithdrawServiceDraftResponseSchema)
async withdrawWorkerServiceDraft(
    @Param('serviceId') serviceId: string,
    @Req() req: Request,
) {
    return await this.workSkillService.withdrawServiceDraft(
        req.user.id,
        serviceId,
    );
}
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm --filter backend test admin-service-offerings.service.spec.ts
pnpm --filter backend test admin-service-offerings.repository.spec.ts
```

Expected: pass. Admin tests must keep existing notification behavior:
`service_offering_review_approved`, `service_offering_review_rejected`, `service_offering_taken_down`.

- [ ] **Step 7: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/backend/src/modules/work-skill apps/backend/src/common/database/schema/server.ts apps/backend/drizzle packages/types/src/work-skill.ts
git commit -m "feat(worker): expose service audit actions"
```

---

### Task 3: React Query Hooks(complete)

**Files:**
- Modify: `packages/hooks/src/api/work-skill/index.ts`

- [ ] **Step 1: Add hooks**

Update imports:

```ts
import type {
    RemovePersonnelPricingRequest,
    ServiceOfferingSubmissionResult,
    UpdatePersonnelSkillsRequest,
    UpdateServiceNonSensitiveFieldsRequest,
    UpsertPersonnelPricingRequest,
    UpsertWorkInfoRequest,
    UpdateServiceOfferingsRequest,
    WithdrawServiceDraftResponse,
    WorkerServiceListResponse,
} from "@repo/types";
import {
    ServiceOfferingSubmissionResultSchema,
    WithdrawServiceDraftResponseSchema,
    WorkerServiceListResponseSchema,
} from "@repo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

Add query key helpers:

```ts
export const workSkillQueryKeys = {
    personnelProfile: ["service-personnel-profile"] as const,
    workerServices: ["worker-services"] as const,
};

const invalidateWorkerServices = (
    queryClient: ReturnType<typeof useQueryClient>,
) => {
    queryClient.invalidateQueries({
        queryKey: workSkillQueryKeys.personnelProfile,
    });
    queryClient.invalidateQueries({
        queryKey: workSkillQueryKeys.workerServices,
    });
};
```

Replace existing `invalidatePersonnelProfile` internals to use `workSkillQueryKeys.personnelProfile`.

Add hooks:

```ts
export const useMyWorkerServices = () => {
    return useQuery({
        queryKey: workSkillQueryKeys.workerServices,
        queryFn: async () => {
            const response =
                await apiClient.get<WorkerServiceListResponse>(
                    "/workSkill/worker/services",
                );
            return WorkerServiceListResponseSchema.parse(
                response.data.map((item) => ({
                    ...item,
                    draft: item.draft
                        ? {
                              ...item.draft,
                              submittedAt: item.draft.submittedAt
                                  ? new Date(item.draft.submittedAt)
                                  : null,
                              reviewedAt: item.draft.reviewedAt
                                  ? new Date(item.draft.reviewedAt)
                                  : null,
                          }
                        : null,
                    offering: item.offering
                        ? {
                              ...item.offering,
                              takedownAt: item.offering.takedownAt
                                  ? new Date(item.offering.takedownAt)
                                  : null,
                          }
                        : null,
                    timeline: item.timeline.map((event) => ({
                        ...event,
                        at: event.at ? new Date(event.at) : null,
                    })),
                })),
            );
        },
        meta: {
            errorMessage: "获取服务审核状态失败",
        },
    });
};

export const useSubmitServiceUpdate = () => {
    return useUpdateServiceOfferings();
};

export const useUpdateServiceNonSensitiveFields = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdateServiceNonSensitiveFieldsRequest) => {
            const response = await apiClient.put(
                `/workSkill/worker/services/${payload.serviceId}`,
                payload,
            );
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "保存服务设置失败",
        },
        scope: {
            id: "updateServiceNonSensitiveFields",
        },
    });
};

export const useWithdrawServiceDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (serviceId: string) => {
            const response =
                await apiClient.delete<WithdrawServiceDraftResponse>(
                    `/workSkill/worker/services/${serviceId}/draft`,
                );
            return WithdrawServiceDraftResponseSchema.parse(response.data);
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "撤回提交失败",
        },
        scope: {
            id: "withdrawServiceDraft",
        },
    });
};
```

- [ ] **Step 2: Run type check**

Run:

```bash
pnpm type-check
```

Expected: hooks compile. If backend types still fail from Task 2, fix before continuing.

- [ ] **Step 3: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add packages/hooks/src/api/work-skill/index.ts packages/types/src/work-skill.ts
git commit -m "feat(worker): add service audit hooks"
```

---

### Task 4: Mobile Shared Audit Model (complete)

**Files:**
- Create: `apps/mobile-worker/app/profile/service-settings-audit-model.ts`

- [ ] **Step 1: Create shared model file**

Add:

```ts
import type {
    WorkerServiceDerivedStatus,
    WorkerServiceItem,
    WorkerServiceTimelineItem,
} from "@repo/types";

export type WorkerServiceTabKey =
    | "active"
    | "pending"
    | "rejected"
    | "takendown";

export const WORKER_SERVICE_TABS: Array<{
    key: WorkerServiceTabKey;
    label: string;
}> = [
    { key: "active", label: "运营中" },
    { key: "pending", label: "审核中" },
    { key: "rejected", label: "审核未通过" },
    { key: "takendown", label: "已下架" },
];

export const getWorkerServiceTabKey = (
    status: WorkerServiceDerivedStatus,
): WorkerServiceTabKey => {
    if (
        status === "active" ||
        status === "active_with_pending_update" ||
        status === "active_with_rejected_update"
    ) {
        return "active";
    }
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";
    return "takendown";
};

export const getWorkerServiceStatusLabel = (
    status: WorkerServiceDerivedStatus,
) => {
    const labels: Record<WorkerServiceDerivedStatus, string> = {
        pending: "审核中",
        active: "运营中",
        active_with_pending_update: "运营中・有更新待审",
        active_with_rejected_update: "运营中・上次更新被驳回",
        rejected: "审核未通过",
        takendown: "已下架",
    };
    return labels[status];
};

export const getWorkerServiceStatusTone = (
    status: WorkerServiceDerivedStatus,
) => {
    if (status === "active") return "green";
    if (status === "pending" || status === "active_with_pending_update") {
        return "amber";
    }
    if (status === "rejected" || status === "active_with_rejected_update") {
        return "red";
    }
    return "slate";
};

export const groupWorkerServicesByTab = (items: WorkerServiceItem[]) => {
    return WORKER_SERVICE_TABS.reduce(
        (acc, tab) => {
            acc[tab.key] = items.filter(
                (item) => getWorkerServiceTabKey(item.derivedStatus) === tab.key,
            );
            return acc;
        },
        {} as Record<WorkerServiceTabKey, WorkerServiceItem[]>,
    );
};

export const getWorkerServiceTitle = (item: WorkerServiceItem) => {
    return (
        item.offering?.name ??
        item.draft?.submittedSnapshot.services[0]?.serviceId ??
        "未命名服务"
    );
};

export const getWorkerServiceReason = (item: WorkerServiceItem) => {
    if (item.derivedStatus === "takendown") {
        return item.offering?.takedownReason ?? "平台已下架该服务";
    }
    if (
        item.derivedStatus === "rejected" ||
        item.derivedStatus === "active_with_rejected_update"
    ) {
        return item.draft?.rejectionReason ?? "审核未通过";
    }
    return null;
};

export const formatAuditElapsed = (date: Date | null | undefined) => {
    if (!date) return "—";
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / 3_600_000));
    if (diffHours < 1) return "刚刚";
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
};

export const buildStepItems = (timeline: WorkerServiceTimelineItem[]) => {
    const submitted = timeline.find((item) => item.type === "submitted");
    const reviewed = timeline.find(
        (item) => item.type === "approved" || item.type === "rejected",
    );
    const takendown = timeline.find((item) => item.type === "takendown");
    return [
        { key: "submitted", label: "已提交", at: submitted?.at ?? null },
        { key: "reviewing", label: "审核中", at: reviewed?.at ?? null },
        {
            key: "result",
            label: takendown ? "已下架" : reviewed ? "已处理" : "等待结果",
            at: takendown?.at ?? reviewed?.at ?? null,
        },
    ];
};

export const hasSensitiveServiceChanges = (input: {
    originalDescription: string;
    nextDescription: string;
    originalGalleryIds: string[];
    nextGalleryIds: string[];
    originalSpecs: Array<{
        name: string;
        price: string;
        currency: string;
        estimatedDurationMinutes: number;
    }>;
    nextSpecs: Array<{
        name: string;
        price: string;
        currency: string;
        estimatedDurationMinutes: number;
    }>;
}) => {
    return (
        input.originalDescription.trim() !== input.nextDescription.trim() ||
        input.originalGalleryIds.join("|") !== input.nextGalleryIds.join("|") ||
        JSON.stringify(input.originalSpecs) !== JSON.stringify(input.nextSpecs)
    );
};
```

- [ ] **Step 2: Run type check**

Run:

```bash
pnpm type-check
```

Expected: new file compiles.

- [ ] **Step 3: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/mobile-worker/app/profile/service-settings-audit-model.ts
git commit -m "feat(worker): add service audit view model"
```

---

### Task 5: My Services Page (complete)

**Files:**
- Modify: `apps/mobile-worker/app/profile/service-settings-redesign.tsx`

- [ ] **Step 1: Replace profile-derived service list with worker service query**

Import:

```ts
import { useMyWorkerServices } from "@repo/hooks/api/work-skill";
import type { WorkerServiceItem } from "@repo/types";
import {
    WORKER_SERVICE_TABS,
    formatAuditElapsed,
    getWorkerServiceReason,
    getWorkerServiceStatusLabel,
    getWorkerServiceStatusTone,
    getWorkerServiceTitle,
    groupWorkerServicesByTab,
    type WorkerServiceTabKey,
} from "./service-settings-audit-model";
```

In component state:

```ts
const [activeTab, setActiveTab] = useState<WorkerServiceTabKey>("active");
const {
    data: workerServices = [],
    isFetching,
    refetch: refetchWorkerServices,
} = useMyWorkerServices();
const groupedServices = useMemo(
    () => groupWorkerServicesByTab(workerServices),
    [workerServices],
);
const visibleServices = groupedServices[activeTab] ?? [];
```

Refresh:

```ts
const { refreshing, onRefresh } = useGlobalPageRefresh({
    refetchActiveQueries: false,
    extraRefresh: () =>
        userId ? refetchWorkerServices().then(() => undefined) : Promise.resolve(),
});
```

- [ ] **Step 2: Add status tabs**

Render below page title:

```tsx
<View className="mt-5 flex-row rounded-2xl bg-white p-1">
    {WORKER_SERVICE_TABS.map((tab) => {
        const count = groupedServices[tab.key]?.length ?? 0;
        const isActive = activeTab === tab.key;
        return (
            <Pressable
                key={tab.key}
                className={`flex-1 items-center rounded-xl px-2 py-2 ${
                    isActive ? "bg-[#111827]" : "bg-transparent"
                }`}
                onPress={() => setActiveTab(tab.key)}
            >
                <Text
                    className={`text-[12px] font-semibold ${
                        isActive ? "text-white" : "text-[#6B7280]"
                    }`}
                >
                    {tab.label} {count}
                </Text>
            </Pressable>
        );
    })}
</View>
```

- [ ] **Step 3: Render audit service cards**

Replace old `ServiceCard` mapping with:

```tsx
<View className="mt-3 gap-3">
    {visibleServices.length > 0 ? (
        visibleServices.map((item) => (
            <AuditServiceCard
                key={`${item.offering?.id ?? item.draft?.id}-${item.derivedStatus}`}
                item={item}
                onPress={() => openServiceDetail(item)}
            />
        ))
    ) : (
        <View className="items-center rounded-2xl bg-white px-5 py-8">
            <Text className="text-[15px] font-semibold text-[#111827]">
                当前状态暂无服务
            </Text>
            <Text className="mt-2 text-center text-[13px] leading-[20px] text-[#6B7280]">
                点击右下角添加服务，提交后会进入审核流程
            </Text>
        </View>
    )}
</View>
```

Add `openServiceDetail`:

```ts
const openServiceDetail = (item: WorkerServiceItem) => {
    router.push({
        pathname: "/profile/service-settings-detail-redesign",
        params: {
            serviceId: item.offering?.id ?? item.draft?.submittedSnapshot.services[0]?.serviceId,
            mode: item.derivedStatus,
            draftId: item.draft?.id,
        },
    } as never);
};
```

Add card component:

```tsx
function AuditServiceCard(props: {
    item: WorkerServiceItem;
    onPress: () => void;
}) {
    const reason = getWorkerServiceReason(props.item);
    const tone = getWorkerServiceStatusTone(props.item.derivedStatus);
    const submittedAt = props.item.draft?.submittedAt;

    return (
        <Pressable
            className="rounded-2xl bg-white p-4 active:opacity-80"
            onPress={props.onPress}
        >
            <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                    <Text className="text-[16px] font-semibold text-[#111827]">
                        {getWorkerServiceTitle(props.item)}
                    </Text>
                    <Text className="mt-1 text-[13px] leading-[19px] text-[#6B7280]">
                        {props.item.offering?.categoryName ?? "平台服务"}
                    </Text>
                </View>
                <StatusBadge
                    label={getWorkerServiceStatusLabel(props.item.derivedStatus)}
                    tone={tone}
                />
            </View>

            {props.item.derivedStatus === "active_with_pending_update" ? (
                <View className="mt-3 rounded-xl bg-[#FFF7ED] px-3 py-2">
                    <Text className="text-[13px] text-[#9A3412]">
                        更新审核中，老版本继续运营。已提交 {formatAuditElapsed(submittedAt)}
                    </Text>
                </View>
            ) : null}

            {reason ? (
                <View className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2">
                    <Text className="text-[13px] leading-[19px] text-[#B91C1C]">
                        {reason}
                    </Text>
                </View>
            ) : null}
        </Pressable>
    );
}
```

- [ ] **Step 4: Verify page type checks**

Run:

```bash
pnpm type-check
```

Expected: page compiles with no stale `serviceCards` references.

- [ ] **Step 5: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/mobile-worker/app/profile/service-settings-redesign.tsx apps/mobile-worker/app/profile/service-settings-audit-model.ts
git commit -m "feat(worker): show service audit tabs"
```

---

### Task 6: Service Catalog Page (complete)

**Files:**
- Modify: `apps/mobile-worker/app/profile/service-settings-manage-redesign.tsx`

- [ ] **Step 1: Keep service library status-free**

Update `selectedServiceIds` to derive from `useMyWorkerServices` or existing profile services, but only use it to disable add button:

```ts
const {
    data: workerServices = [],
    refetch: refetchWorkerServices,
} = useMyWorkerServices();

const selectedServiceIds = useMemo(() => {
    return new Set(
        workerServices
            .map((item) => item.offering?.id ?? item.draft?.submittedSnapshot.services[0]?.serviceId)
            .filter((id): id is string => Boolean(id)),
    );
}, [workerServices]);
```

Remove visible audit/rejection/down text from service library cards. Card state should be only:

```tsx
<Pressable
    disabled={selectedServiceIds.has(service.id)}
    onPress={() => props.onServicePress({
        serviceId: service.id,
        categoryId: category.id,
        categoryName: category.name,
        serviceName: service.name,
        serviceDescription: service.description,
    })}
>
    <Text>{selectedServiceIds.has(service.id) ? "已添加" : "+ 添加"}</Text>
</Pressable>
```

- [ ] **Step 2: Route create mode explicitly**

When navigating to detail from service library:

```ts
router.push({
    pathname: "/profile/service-settings-detail-redesign",
    params: {
        mode: "create",
        serviceId: input.serviceId,
        categoryId: input.categoryId,
        categoryName: input.categoryName,
        serviceName: input.serviceName,
        serviceDescription: input.serviceDescription,
    },
} as never);
```

- [ ] **Step 3: Refresh both catalog and worker services**

Use:

```ts
const { refreshing, onRefresh } = useGlobalPageRefresh({
    refetchActiveQueries: false,
    extraRefresh: async () => {
        await Promise.all([
            refetchServiceList(),
            refetchWorkerServices(),
        ]);
    },
});
```

- [ ] **Step 4: Run type check**

Run:

```bash
pnpm type-check
```

Expected: no audit status text remains on service library page; TypeScript passes.

- [ ] **Step 5: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/mobile-worker/app/profile/service-settings-manage-redesign.tsx
git commit -m "feat(worker): simplify service catalog status"
```

---

### Task 7: Edit Service Page Modes and Actions (complete)

**Files:**
- Modify: `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx`

- [ ] **Step 1: Add route mode and hooks**

Import hooks/model:

```ts
import {
    useMyWorkerServices,
    useSubmitServiceUpdate,
    useUpdateServiceNonSensitiveFields,
    useWithdrawServiceDraft,
} from "@repo/hooks/api/work-skill";
import type { WorkerServiceDerivedStatus, WorkerServiceItem } from "@repo/types";
import {
    buildStepItems,
    formatAuditElapsed,
    getWorkerServiceReason,
    getWorkerServiceStatusLabel,
    hasSensitiveServiceChanges,
} from "./service-settings-audit-model";
```

Route params:

```ts
const params = useLocalSearchParams<{
    mode?: WorkerServiceDerivedStatus | "create";
    serviceId?: string;
    draftId?: string;
    categoryId?: string;
    categoryName?: string;
    serviceName?: string;
    serviceDescription?: string;
}>();
```

Load matching item:

```ts
const { data: workerServices = [], refetch: refetchWorkerServices } =
    useMyWorkerServices();
const currentAuditItem = useMemo(() => {
    return workerServices.find((item) => {
        const id =
            item.offering?.id ??
            item.draft?.submittedSnapshot.services[0]?.serviceId;
        return id === params.serviceId;
    });
}, [params.serviceId, workerServices]);
```

- [ ] **Step 2: Derive edit mode**

Add:

```ts
type EditMode =
    | "create"
    | "edit-active"
    | "edit-pending"
    | "edit-rejected"
    | "edit-takendown";

const resolveEditMode = (
    status: WorkerServiceDerivedStatus | "create" | undefined,
): EditMode => {
    if (status === "create") return "create";
    if (status === "pending") return "edit-pending";
    if (status === "rejected") return "edit-rejected";
    if (status === "takendown") return "edit-takendown";
    return "edit-active";
};

const editMode = resolveEditMode(params.mode);
const isReadonly = editMode === "edit-pending";
```

Disable inputs/buttons when `isReadonly`:

```tsx
<Textarea editable={!isReadonly} />
<Pressable disabled={isReadonly} />
<Switch disabled={isReadonly} />
```

- [ ] **Step 3: Load correct source data**

For `create`, use route service info.

For `edit-active`:

```ts
const shouldLoadPendingDraft =
    currentAuditItem?.derivedStatus === "active_with_pending_update" &&
    selectedPendingConflictChoice === "draft";

const sourceService = shouldLoadPendingDraft
    ? mapDraftSnapshotToEditableService(currentAuditItem.draft)
    : mapOfferingToEditableService(currentAuditItem.offering);
```

For `active_with_rejected_update`, always load active offering:

```ts
const sourceService =
    currentAuditItem?.derivedStatus === "active_with_rejected_update"
        ? mapOfferingToEditableService(currentAuditItem.offering)
        : existingSourceService;
```

Show conflict prompt once:

```ts
useEffect(() => {
    if (currentAuditItem?.derivedStatus !== "active_with_pending_update") {
        return;
    }
    Alert.alert(
        "有更新待审核",
        "你有一个待审核的更新尚未完成，是否在此基础上继续修改？",
        [
            { text: "放弃更新", onPress: () => setSelectedPendingConflictChoice("offering") },
            { text: "继续编辑", onPress: () => setSelectedPendingConflictChoice("draft") },
        ],
    );
}, [currentAuditItem?.derivedStatus]);
```

- [ ] **Step 4: Add header notices and progress**

Render top notice:

```tsx
{editMode !== "create" && currentAuditItem ? (
    <AuditHeaderNotice item={currentAuditItem} mode={editMode} />
) : null}
```

Add:

```tsx
function AuditHeaderNotice(props: {
    item: WorkerServiceItem;
    mode: EditMode;
}) {
    const reason = getWorkerServiceReason(props.item);
    const steps = buildStepItems(props.item.timeline);

    if (props.mode === "edit-rejected") {
        return (
            <View className="rounded-2xl bg-[#FEF2F2] p-4">
                <Text className="text-[16px] font-semibold text-[#B91C1C]">
                    审核未通过
                </Text>
                <Text className="mt-2 text-[13px] leading-[20px] text-[#991B1B]">
                    驳回原因：{reason ?? "资料不完整"}
                </Text>
                <AuditStepBar steps={steps} />
            </View>
        );
    }

    if (props.mode === "edit-takendown") {
        return (
            <View className="rounded-2xl bg-[#F3F4F6] p-4">
                <Text className="text-[16px] font-semibold text-[#374151]">
                    服务已下架
                </Text>
                <Text className="mt-2 text-[13px] leading-[20px] text-[#4B5563]">
                    下架原因：{reason ?? "平台已下架该服务"}
                </Text>
                <Pressable
                    className="mt-3 rounded-xl bg-[#E5E7EB] px-4 py-2"
                    onPress={() => toast.info("敬请期待")}
                >
                    <Text className="text-center text-[13px] font-semibold text-[#6B7280]">
                        申诉
                    </Text>
                </Pressable>
                <AuditStepBar steps={steps} />
            </View>
        );
    }

    return (
        <View className="rounded-2xl bg-white p-4">
            <Text className="text-[15px] font-semibold text-[#111827]">
                {getWorkerServiceStatusLabel(props.item.derivedStatus)}
            </Text>
            {props.item.derivedStatus === "active_with_pending_update" ? (
                <Text className="mt-2 text-[13px] text-[#9A3412]">
                    有一个待审核的更新，已提交 {formatAuditElapsed(props.item.draft?.submittedAt)}
                </Text>
            ) : null}
            <AuditStepBar steps={steps} />
        </View>
    );
}
```

- [ ] **Step 5: Implement submit button rules**

Use mutations:

```ts
const submitServiceUpdate = useSubmitServiceUpdate();
const updateNonSensitiveFields = useUpdateServiceNonSensitiveFields();
const withdrawDraft = useWithdrawServiceDraft();
```

Derive button label:

```ts
const primaryButtonLabel =
    editMode === "edit-pending"
        ? "撤回提交"
        : editMode === "edit-rejected" || editMode === "edit-takendown"
          ? "修改并重新提交"
          : hasSensitiveChanges
            ? "提交审核"
            : "保存修改";
```

Submit:

```ts
const onPrimaryPress = handleSubmitServiceForm(async (values) => {
    if (!editableService) return;

    if (editMode === "edit-pending") {
        Alert.alert("撤回提交", "撤回后该服务将回到上一状态，确定撤回？", [
            { text: "取消", style: "cancel" },
            {
                text: "撤回",
                style: "destructive",
                onPress: async () => {
                    await withdrawDraft.mutateAsync(editableService.serviceId);
                    await refetchWorkerServices();
                    router.back();
                },
            },
        ]);
        return;
    }

    const payload = buildUpdateServiceOfferingsPayload(values);
    if (hasSensitiveChanges || editMode !== "edit-active") {
        await submitServiceUpdate.mutateAsync(payload);
    } else {
        await updateNonSensitiveFields.mutateAsync({
            serviceId: editableService.serviceId,
            defaultSpecificationId: editableService.specs[0]?.id ?? null,
        });
    }

    await refetchWorkerServices();
    router.back();
});
```

- [ ] **Step 6: Move dangerous actions to bottom**

Remove top-right red delete button. At bottom render only for `edit-active` / `edit-rejected`:

```tsx
{editMode === "edit-active" || editMode === "edit-rejected" ? (
    <View className="mt-8 rounded-2xl bg-white p-4">
        <Text className="text-[15px] font-semibold text-[#991B1B]">
            危险操作
        </Text>
        <Pressable
            className="mt-4 rounded-xl border border-[#FCA5A5] px-4 py-3"
            onPress={confirmTakeDown}
        >
            <Text className="text-[14px] font-semibold text-[#B91C1C]">
                下架服务
            </Text>
            <Text className="mt-1 text-[12px] text-[#6B7280]">
                仅自己不再提供该服务
            </Text>
        </Pressable>
        <Pressable
            className="mt-3 rounded-xl border border-[#FCA5A5] px-4 py-3"
            onPress={confirmDeleteByServiceName}
        >
            <Text className="text-[14px] font-semibold text-[#B91C1C]">
                删除服务
            </Text>
            <Text className="mt-1 text-[12px] text-[#6B7280]">
                彻底删除，无法恢复
            </Text>
        </Pressable>
    </View>
) : null}
```

Delete confirmation must require typed service name:

```ts
const confirmDeleteByServiceName = () => {
    Alert.prompt(
        "删除服务",
        `请输入“${editableService?.name ?? ""}”确认删除`,
        async (text) => {
            if (text !== editableService?.name) {
                Alert.alert("服务名称不匹配");
                return;
            }
            await removePersonnelPricing.mutateAsync(editableService.serviceId);
            router.back();
        },
    );
};
```

If `Alert.prompt` is not available on Android in this app, implement the same validation with the existing `BottomSheetModal` pattern in the file.

- [ ] **Step 7: Unsaved-change guard**

Add before back:

```ts
const hasDirtyChanges = serviceFormState.isDirty || imageUploadDirty;

const confirmLeave = () => {
    if (!hasDirtyChanges) {
        router.back();
        return;
    }
    Alert.alert("放弃修改？", "未保存的修改将丢失，确定离开？", [
        { text: "取消", style: "cancel" },
        { text: "离开", style: "destructive", onPress: () => router.back() },
    ]);
};
```

Wire header back button to `confirmLeave`.

- [ ] **Step 8: Run type check**

Run:

```bash
pnpm type-check
```

Expected: detail page compiles; no writable controls remain enabled in `edit-pending`.

- [ ] **Step 9: Submission checkpoint**

Do not commit unless user explicitly asks. If committing is allowed:

```bash
git add apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx apps/mobile-worker/app/profile/service-settings-audit-model.ts
git commit -m "feat(worker): support service edit audit modes"
```

---

### Task 8: Full Verification (complete)

**Files:**
- No code files unless fixes are needed.

- [ ] **Step 1: Backend test suite for touched module**

Run:

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm --filter backend test admin-service-offerings.service.spec.ts
pnpm --filter backend test admin-service-offerings.repository.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Workspace type check**

Run:

```bash
pnpm type-check
```

Expected: pass. If it fails due to pre-existing unrelated WSL/native issues, record exact error and prove touched files are not the cause.

- [ ] **Step 3: Manual mobile acceptance**

Run mobile worker dev server:

```bash
pnpm mobile-worker:dev
```

Manual checks:

```text
1. 我的服务页显示 4 个 Tab：运营中 / 审核中 / 审核未通过 / 已下架。
2. 运营中 Tab 包含 active、active_with_pending_update、active_with_rejected_update 三类。
3. 已下架服务不出现在运营中 Tab。
4. 服务库中已添加服务只显示“已添加”，不显示审核/下架原因。
5. create 模式提交后进入审核中。
6. edit-pending 全部字段只读，主按钮撤回提交，撤回后列表状态正确。
7. active_with_pending_update 进入编辑时弹出继续编辑/放弃更新。
8. active_with_rejected_update 进入编辑加载线上主体，不加载 rejected draft 快照。
9. edit-rejected 显示驳回原因，可修改并重新提交。
10. edit-takendown 显示下架原因，申诉 disabled 且提示“敬请期待”。
11. 仅非敏感字段修改时按钮为“保存修改”，不创建 draft。
12. 敏感字段修改时按钮为“提交审核”，老版本继续可见。
13. 删除服务在底部危险操作区，需要输入服务名确认。
```

- [ ] **Step 4: Final diff review**

Run:

```bash
git diff --stat
git diff -- docs/superpowers/specs/2026-05-15-mobile-worker-service-audit-redesign.md docs/superpowers/plans/2026-05-15-mobile-worker-service-audit-redesign-implementation.md
```

Expected: spec untouched unless user requested changes; plan remains implementation-only.

- [ ] **Step 5: Completion report**

Report:

```text
- 后端：列出新增接口、migration、测试结果。
- 移动端：列出三页变化和 5 种编辑模式。
- 验证：贴 `pnpm --filter backend test ...` 和 `pnpm type-check` 结果。
- 风险：如果 migration 由手写完成，提醒执行 `pnpm --filter backend db:generate` 后核对 snapshot。
```

---

## Plan Patches (post-review additions)

以下 5 个 task 是 Plan 1–8 写完后审查发现的缺口补丁。**Task 0 必须最先执行**（修敏感字段误分类问题，否则 Task 7 的前后端语义会错位）。其它按顺序在 Task 7 之前执行。

### Task 0: Fix sensitive-field misclassification (BLOCKER, run before Task 7) (complete)

**背景:** Task 2 中 `UpdateServiceNonSensitiveFieldsRequestSchema` 把 `description` 和 `galleryFileIds` 当作非敏感字段直接写库，这违反了 spec §4「敏感字段定义」 — 这两个字段必须经审核。本任务把它们从非敏感通道移除，让前端只能通过 `useSubmitServiceUpdate` 提交。

**Files:**
- Modify: `packages/types/src/work-skill.ts` (lines 619-637 附近 `UpdateServiceNonSensitiveFieldsRequestSchema`)
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts` (`updateServiceNonSensitiveFields`)
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts` (相关测试)

- [ ] **Step 1: Inventory existing fields on service_personnel + offering_statuses**

读 `apps/backend/src/common/database/schema/server.ts` 中 `servicePersonnel`、`servicePersonnelSkills`、`servicePersonnelOfferingStatuses` 三张表的全部字段，对照 spec §4 的非敏感字段列表（服务区域 / 可预约时段 / 默认规格选择）核查：

```bash
sed -n '1,260p' apps/backend/src/common/database/schema/server.ts
```

判断规则：
- 若表中已有"区域 / 时段 / 默认规格"语义的字段（不限名字，看注释和类型），把这些字段加入新的 `UpdateServiceNonSensitiveFieldsRequestSchema`。
- 若全无 → 按 Step 2 的"硬下线"模式实现（refine 永远 fail），等后续会话补 schema 时再放开。

把判断结论（"找到 X 个非敏感字段：a/b/c" 或 "暂无可直改字段"）记到 `/tmp/non-sensitive-fields.md`，Step 2 / 3 / 4 都按结论分支执行。

- [ ] **Step 2: Strip sensitive fields from non-sensitive schema**

In `packages/types/src/work-skill.ts`, replace `UpdateServiceNonSensitiveFieldsRequestSchema` with：

```ts
export const UpdateServiceNonSensitiveFieldsRequestSchema = z
    .object({
        serviceId: z.string().min(1, "服务ID不能为空"),
    })
    .strict()
    .refine(() => false, {
        message: "暂无可直接保存的非敏感字段，请使用提交审核",
        path: ["serviceId"],
    });
```

Note: refine 永远 fail，让任何 PUT `/workSkill/worker/services/:serviceId` 请求都返回 400。

**同时改 controller**（`apps/backend/src/modules/work-skill/work-skill.controller.ts` 现有 line 110-128 附近的 `updateWorkerServiceNonSensitiveFields`）：把 `@Body() body: Omit<UpdateServiceNonSensitiveFieldsRequest, 'serviceId'>` 改成 `@Body() body: Record<string, never>`，因为 schema 推断后已无 serviceId 之外字段，旧 Omit 会推断成 `{}`，TS 校验在 strict 模式下报错。最终 controller 形如：

```ts
@UseGuards(AuthGuard)
@Put('worker/services/:serviceId')
@UsePipes(new ZodValidationPipe(UpdateServiceNonSensitiveFieldsRequestSchema))
async updateWorkerServiceNonSensitiveFields(
    @Param('serviceId') serviceId: string,
    @Body() _body: Record<string, never>,
    @Req() req: Request,
) {
    return await this.workSkillService.updateServiceNonSensitiveFields(
        req.user.id,
        { serviceId },
    );
}
```

ZodValidationPipe 会先把整个 body（含 serviceId 拼装结果）跑一遍 schema，refine 永远拒，所以 service 层根本到不了。

- [ ] **Step 3: Update repository to reject all calls**

In `apps/backend/src/modules/work-skill/work-skill.repository.ts`, replace `updateServiceNonSensitiveFields` body with:

```ts
async updateServiceNonSensitiveFields(
    _personnelId: string,
    _payload: UpdateServiceNonSensitiveFieldsRequest,
): Promise<{ serviceId: string; updated: true }> {
    throw new BadRequestException(
        '暂无可直接保存的非敏感字段，请使用提交审核',
    );
}
```

- [ ] **Step 4: Adjust spec test**

In `work-skill.service.spec.ts`，把 `updates non-sensitive fields without submitting a draft` 测试改为：

```ts
it('rejects non-sensitive update calls until eligible fields exist', async () => {
    await expect(
        service.updateServiceNonSensitiveFields('worker_1', {
            serviceId: 'svc_1',
        }),
    ).rejects.toThrow('暂无可直接保存的非敏感字段，请使用提交审核');
});
```

- [ ] **Step 5: Run backend tests + type-check**

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm type-check
```

Expected: 通过。

- [ ] **Step 6: Submission checkpoint** — do not commit unless asked.

---

### Task 0b: Add `withdrawn` audit log type (complete)

**背景:** Task 2 撤回时写的 audit log type 是 `'submitted'`，语义错。timeline 渲染时会显示成"已提交"。需要新增 enum 值。

**Files:**
- Modify: `apps/backend/src/common/database/schema/server.ts`
- Create: `apps/backend/drizzle/<next-seq>_audit_log_withdrawn_type.sql`
- Modify: `packages/types/src/work-skill.ts` (`WorkerServiceAuditLogTypeSchema`)
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts` (`withdrawServiceDraft` + `toTimelineType`)

- [ ] **Step 1: Extend pg enum**

In `server.ts`:

```ts
export const serviceOfferingAuditLogTypeEnum = pgEnum(
    'service_offering_audit_log_type',
    ['submitted', 'approved', 'rejected', 'takendown', 'restored', 'withdrawn'],
);
```

- [ ] **Step 2: Generate migration**

```bash
pnpm --filter backend db:generate
```

Or manually create the next-numbered SQL file with:

```sql
ALTER TYPE "public"."service_offering_audit_log_type" ADD VALUE IF NOT EXISTS 'withdrawn';
```

- [ ] **Step 3: Update Zod enum**

In `packages/types/src/work-skill.ts`, add `'withdrawn'` to `WorkerServiceAuditLogTypeSchema`.

- [ ] **Step 4: Use it in withdraw repository + extend timeline type**

In `withdrawServiceDraft` (line 615 area), change `type: 'submitted'` to `type: 'withdrawn'`.

In `packages/types/src/work-skill.ts` 的 `WorkerServiceTimelineTypeSchema` 和 `WorkerServiceAuditLogTypeSchema` 中都加入 `'withdrawn'`：

```ts
export const WorkerServiceAuditLogTypeSchema = z.enum([
    "submitted",
    "approved",
    "rejected",
    "takendown",
    "restored",
    "withdrawn",
]);
```

In `toTimelineType` helper (repository) 加分支：

```ts
if (type === 'withdrawn') return 'withdrawn';
```

前端 Task 4 的 `buildStepItems` 后续会按 `withdrawn` 事件渲染步骤条颜色，因此独立类型必须保留，不可降级为 `'updated'`。

- [ ] **Step 5: Run tests + type-check**

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm type-check
```

- [ ] **Step 6: Submission checkpoint** — do not commit unless asked.

---

### Task 4.5: StatusBadge & AuditStepBar components (run before Task 5) (complete)

**背景:** Task 5/7 直接 `<StatusBadge .../>` 和 `<AuditStepBar steps={...}/>`，但 plan 缺创建任务。spec §3 要求统一组件。

**Files:**
- Create: `packages/mobile-ui/src/components/StatusBadge.tsx`
- Create: `packages/mobile-ui/src/components/AuditStepBar.tsx`

- [ ] **Step 1: StatusBadge component**

```tsx
import { Text } from "@repo/mobile-ui/components/ui/text";
import { View } from "react-native";

export type StatusBadgeTone = "green" | "amber" | "red" | "slate";

const TONE_CLASSES: Record<StatusBadgeTone, { bg: string; text: string; border: string }> = {
    green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    slate: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300" },
};

export function StatusBadge(props: { label: string; tone: StatusBadgeTone }) {
    const cls = TONE_CLASSES[props.tone];
    return (
        <View className={`rounded-md border px-2 py-1 ${cls.bg} ${cls.border}`}>
            <Text className={`text-[12px] font-medium ${cls.text}`}>{props.label}</Text>
        </View>
    );
}
```

- [ ] **Step 2: AuditStepBar component**

```tsx
import { Text } from "@repo/mobile-ui/components/ui/text";
import { View } from "react-native";

export type AuditStep = {
    key: string;
    label: string;
    at: Date | null;
};

export function AuditStepBar(props: { steps: AuditStep[]; tone?: "amber" | "red" | "slate" }) {
    const tone = props.tone ?? "amber";
    const dotActive = tone === "red" ? "bg-red-500" : tone === "slate" ? "bg-gray-400" : "bg-amber-500";
    return (
        <View className="mt-3 flex-row items-center justify-between">
            {props.steps.map((step, idx) => {
                const reached = step.at !== null;
                return (
                    <View key={step.key} className="flex-1 items-center">
                        <View className="h-3 w-3 items-center justify-center">
                            <View
                                className={`h-2.5 w-2.5 rounded-full ${
                                    reached ? dotActive : "border border-gray-300 bg-white"
                                }`}
                            />
                        </View>
                        <Text className="mt-1 text-[11px] text-gray-600">{step.label}</Text>
                        {step.at ? (
                            <Text className="text-[10px] text-gray-400">
                                {step.at.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}
```

- [ ] **Step 3: Re-export**

In `packages/mobile-ui/src/index.ts` (or current barrel file), add:

```ts
export { StatusBadge, type StatusBadgeTone } from "./components/StatusBadge";
export { AuditStepBar, type AuditStep } from "./components/AuditStepBar";
```

If the package has no barrel, import directly from each file path in Task 5/7.

- [ ] **Step 4: Type-check** — `pnpm type-check`

- [ ] **Step 5: Submission checkpoint** — do not commit unless asked.

---

### Task 4.6: useTakedownService & useDeleteService hooks (run before Task 7) (complete)

**背景:** Task 7 的 `confirmTakeDown` 没对应 mutation；`removePersonnelPricing` 删的是规格不是整个服务，作为"删除服务"语义错。本任务补两个 mutation。

**Files:**
- Modify: `packages/hooks/src/api/work-skill/index.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts` (新路由)
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`

- [ ] **Step 1: Add backend self-takedown route**

服务人员主动下架（`POST /workSkill/worker/services/:serviceId/takedown`），写入 `service_personnel_offering_statuses` 把 publication_status 设为 `taken_down`，并写一条 audit_log type=`takendown`，operator_id = 服务人员自己。区别于管理端：take_down_reason 设为"服务人员主动下架"，taken_down_by 仍记录人员 ID。

- [ ] **Step 2: Add backend delete route**

`DELETE /workSkill/worker/services/:serviceId` — 事务里：删除该服务的所有 draft、所有 pricing、status 行、skill 行；audit_logs 通过 `ON DELETE cascade` 自动清。要求请求体 `{ confirmName: string }`，与服务 name 必须匹配，否则 400。

- [ ] **Step 3: Add hooks**

```ts
export const useTakedownService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (serviceId: string) => {
            const response = await apiClient.post(
                `/workSkill/worker/services/${serviceId}/takedown`,
            );
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: { errorMessage: "下架服务失败" },
        scope: { id: "takedownService" },
    });
};

export const useDeleteService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { serviceId: string; confirmName: string }) => {
            const response = await apiClient.delete(
                `/workSkill/worker/services/${payload.serviceId}`,
                { data: { confirmName: payload.confirmName } },
            );
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: { errorMessage: "删除服务失败" },
        scope: { id: "deleteService" },
    });
};
```

- [ ] **Step 4: Add backend tests for both routes**

In `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`，追加：

```ts
describe('worker self takedown / delete', () => {
    it('marks own offering as taken_down on self-takedown', async () => {
        repository.selfTakedownService.mockResolvedValue({
            serviceId: 'svc_1',
            takenDown: true,
        });

        await expect(
            service.selfTakedownService('worker_1', 'svc_1'),
        ).resolves.toEqual({ serviceId: 'svc_1', takenDown: true });

        expect(repository.selfTakedownService).toHaveBeenCalledWith(
            'worker_1',
            'svc_1',
        );
    });

    it('rejects delete when confirmName does not match service name', async () => {
        repository.deleteWorkerService.mockImplementation(
            async (_personnelId, _serviceId, confirmName) => {
                if (confirmName !== '深层按摩') {
                    throw new BadRequestException('服务名称不匹配');
                }
                return { serviceId: 'svc_1', deleted: true };
            },
        );

        await expect(
            service.deleteWorkerService('worker_1', 'svc_1', '错误名称'),
        ).rejects.toThrow('服务名称不匹配');
    });

    it('deletes service when confirmName matches', async () => {
        repository.deleteWorkerService.mockResolvedValue({
            serviceId: 'svc_1',
            deleted: true,
        });

        await expect(
            service.deleteWorkerService('worker_1', 'svc_1', '深层按摩'),
        ).resolves.toEqual({ serviceId: 'svc_1', deleted: true });
    });
});
```

在 `work-skill.repository.spec.ts`（如果存在 / 否则跳过此追加）加一条集成测试验证 `ON DELETE CASCADE` 真把 audit_logs 一起清掉。

- [ ] **Step 5: Run tests + type-check**

```bash
pnpm --filter backend test work-skill.service.spec.ts
pnpm type-check
```

- [ ] **Step 6: Submission checkpoint** — do not commit unless asked.

---

### Task 7-pre: Document inherited helpers from current detail page (complete)

**背景:** Task 7 引用 `mapDraftSnapshotToEditableService` / `mapOfferingToEditableService` / `buildUpdateServiceOfferingsPayload` / `serviceFormState` / `imageUploadDirty` / `handleSubmitServiceForm` / `removePersonnelPricing` / `editableService` 等符号，这些来自现有 `service-settings-detail-redesign.tsx`。本任务在 Task 7 开始前先确认它们存在；不存在的需要先实现。

**Files:** Read-only inspection.

- [ ] **Step 1: Verify symbols**

```bash
grep -nE "(mapDraftSnapshotToEditableService|mapOfferingToEditableService|buildUpdateServiceOfferingsPayload|imageUploadDirty|handleSubmitServiceForm|editableService|removePersonnelPricing)" apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx
```

For any symbol that does NOT appear:

- 若是数据 mapper（如 `mapOfferingToEditableService`），在 Task 7 Step 3 前用一段 plan 补丁先创建该 helper（typed input/output 必须基于 `WorkerServiceCurrent` / `WorkerServiceDraftSnapshot` 类型）。
- 若是 `serviceFormState.isDirty` / `imageUploadDirty`，确认现有 form state hook 是否暴露 dirty 标志；没有就用 `useReducer` 或 ref 做最简 dirty tracking。
- `removePersonnelPricing` 替换为 Task 4.6 新加的 `useDeleteService`，并按需保留旧 hook 用于规格删除场景。

- [ ] **Step 2: Output anchor report to /tmp**

把 Step 1 的结果写入 `/tmp/task7-helpers.md`，格式：

```markdown
# Task 7 inherited helpers report

| Symbol | Found | Action for Task 7 |
|---|---|---|
| editableService | yes (line 234) | reuse |
| serviceFormState | yes (line 178) | reuse |
| handleSubmitServiceForm | yes (line 412) | reuse |
| imageUploadDirty | NO | create with useRef in Task 7 step 7 |
| mapOfferingToEditableService | NO | new helper, type `WorkerServiceCurrent → EditableService` |
| mapDraftSnapshotToEditableService | NO | new helper, type `WorkerServiceDraftSnapshot → EditableService` |
| buildUpdateServiceOfferingsPayload | yes (line 567) | reuse |
| removePersonnelPricing | yes (line 89) | DO NOT use for service deletion; replaced by `useDeleteService` from Task 4.6 |
```

Task 7 实施时，agent 必须先读这个临时文件，再执行 Task 7 步骤。**不要让 agent 直接修改 plan 文档本身。**

---
