# Service Offering Appeal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement service-personnel appeal flow for admin-taken-down service offerings.

**Architecture:** Add an independent appeal table keyed by service personnel, service, and `takenDownAt` snapshot. Mobile worker submits appeals through the existing `workSkill` domain; admin handles pending appeals in the existing service offerings management page; approval restores the original published offering and rejection keeps the service taken down.

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL, Zod v4, React Query, Next.js App Router, Expo Router, NativeWind/mobile-ui, pnpm workspace.

---

## Constraints

- Do not submit git commits unless the user explicitly asks.
- Preserve unrelated dirty worktree changes.
- Do not edit generated `dist/` files.
- Add migration SQL if needed, but do not hand-edit Drizzle meta snapshots/journal unless the user explicitly asks.
- Keep public discovery filters unchanged: taken-down services remain hidden from user-facing public surfaces.
- Keep申诉 and整改审核 as independent paths: appeal approval restores the original online version only; it does not approve a pending draft.

## File Map

Create:

- `apps/backend/drizzle/0076_service_offering_appeals.sql` - SQL migration for appeal enum/table/indexes.

Modify:

- `apps/backend/src/common/database/schema/server.ts` - Drizzle enum/table/relations for appeals.
- `packages/types/src/work-skill.ts` - mobile worker appeal schemas and `WorkerServiceItem.latestAppeal`.
- `packages/types/src/admin.ts` - admin lifecycle filter and list item appeal schemas.
- `packages/hooks/src/api/work-skill/index.ts` - mobile submit appeal mutation and date normalization.
- `packages/hooks/src/api/ssr/admin-service-offerings.ts` - admin approve/reject appeal mutations.
- `apps/backend/src/modules/work-skill/work-skill.repository.ts` - submit appeal, expose latest current-takedown appeal, cancel pending appeal when整改审核通过.
- `apps/backend/src/modules/work-skill/work-skill.service.ts` - service-level validation wrapper for appeal submission.
- `apps/backend/src/modules/work-skill/work-skill.controller.ts` - mobile appeal route.
- `apps/backend/src/modules/work-skill/admin-service-offerings.repository.ts` - list `appeal_pending`, approve/reject/cancel appeal transaction logic.
- `apps/backend/src/modules/work-skill/admin-service-offerings.service.ts` - notifications for approve/reject.
- `apps/backend/src/modules/work-skill/admin-service-offerings.controller.ts` - admin appeal routes.
- `apps/backend/src/modules/work-skill/work-skill.service.spec.ts` - worker appeal behavior tests.
- `apps/backend/src/modules/work-skill/admin-service-offerings.repository.spec.ts` - admin repository appeal tests.
- `apps/backend/src/modules/work-skill/admin-service-offerings.service.spec.ts` - admin notification tests.
- `apps/admin-web/src/app/(management)/service-offerings/_utils/query.ts` - lifecycle query parsing for `appeal_pending`.
- `apps/admin-web/src/app/(management)/service-offerings/_components/service-offering-lifecycle-badge.tsx` - appeal badge label/style.
- `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-page-content.tsx` - admin appeal actions/dialog state.
- `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-table.tsx` - table buttons and summaries for pending appeals.
- `apps/admin-web/src/app/(management)/service-offerings/_components/service-offering-detail-sheet.tsx` - detail actions/display for pending appeals.
- `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx` - appeal button/modal/status UI.
- `apps/mobile-worker/app/profile/service-settings-audit-model.ts` - helper text/status logic if needed.

## Data Contracts

Use these shared names consistently:

```ts
export const ServiceOfferingAppealStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "canceled",
]);

export const ServiceOfferingAppealSummarySchema = z.object({
    id: z.string().min(1),
    status: ServiceOfferingAppealStatusSchema,
    appealReason: z.string(),
    reviewResultReason: z.string().nullable(),
    takenDownAtSnapshot: z.date(),
    takeDownReasonSnapshot: z.string().nullable(),
    createdAt: z.date(),
    reviewedAt: z.date().nullable(),
});

export const SubmitServiceOfferingAppealRequestSchema = z.object({
    appealReason: z.string().trim().min(10, "申诉说明至少 10 个字").max(500, "申诉说明不能超过 500 个字"),
});
```

Admin list should include an appeal block only when relevant:

```ts
appeal: z
    .object({
        id: z.string().min(1),
        status: ServiceOfferingAppealStatusSchema,
        appealReason: z.string(),
        reviewResultReason: z.string().nullable(),
        takeDownReasonSnapshot: z.string().nullable(),
        takenDownAtSnapshot: IsoDateTimeStringSchema,
        createdAt: IsoDateTimeStringSchema,
        reviewedAt: IsoDateTimeStringSchema.nullable(),
    })
    .nullable()
    .optional()
```

---

### Task 1: Shared Types And Database Schema

**Files:**

- Modify: `apps/backend/src/common/database/schema/server.ts`
- Create: `apps/backend/drizzle/0076_service_offering_appeals.sql`
- Modify: `packages/types/src/work-skill.ts`
- Modify: `packages/types/src/admin.ts`

- [ ] **Step 1: Confirm missing type surface before editing**

Run:

```bash
rg -n "ServiceOfferingAppealStatusSchema|SubmitServiceOfferingAppealRequestSchema|latestAppeal|appeal_pending" packages/types/src apps/backend/src apps/mobile-worker/app apps/admin-web/src
```

Expected: no existing appeal type or `appeal_pending` lifecycle implementation. `latestAppeal` should not exist before this task.

- [ ] **Step 2: Add Drizzle appeal enum/table**

In `apps/backend/src/common/database/schema/server.ts`, after `serviceOfferingPublicationStatusEnum`, add:

```ts
export const serviceOfferingAppealStatusEnum = pgEnum(
    'service_offering_appeal_status',
    ['pending', 'approved', 'rejected', 'canceled'],
);
```

After `servicePersonnelOfferingStatuses`, add:

```ts
export const servicePersonnelOfferingAppeals = pgTable(
    'service_personnel_offering_appeals',
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
        takenDownAtSnapshot: timestamp('taken_down_at_snapshot', {
            withTimezone: true,
        }).notNull(),
        takeDownReasonSnapshot: text('take_down_reason_snapshot'),
        appealReason: text('appeal_reason').notNull(),
        status: serviceOfferingAppealStatusEnum('status')
            .notNull()
            .default('pending'),
        reviewResultReason: text('review_result_reason'),
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
        index('idx_service_offering_appeals_personnel_service').on(
            table.personnelUserId,
            table.serviceId,
            table.takenDownAtSnapshot,
            table.createdAt.desc(),
        ),
        uniqueIndex('uniq_service_offering_appeals_pending_round')
            .on(table.personnelUserId, table.serviceId, table.takenDownAtSnapshot)
            .where(sql`status = 'pending'`),
    ],
);
```

Add relations near existing status/audit relations:

```ts
export const servicePersonnelOfferingAppealsRelations = relations(
    servicePersonnelOfferingAppeals,
    ({ one }) => ({
        personnel: one(servicePersonnel, {
            fields: [servicePersonnelOfferingAppeals.personnelUserId],
            references: [servicePersonnel.userId],
        }),
        service: one(services, {
            fields: [servicePersonnelOfferingAppeals.serviceId],
            references: [services.id],
        }),
        reviewer: one(users, {
            fields: [servicePersonnelOfferingAppeals.reviewedBy],
            references: [users.id],
        }),
    }),
);
```

- [ ] **Step 3: Add migration SQL**

Create `apps/backend/drizzle/0076_service_offering_appeals.sql`:

```sql
CREATE TYPE "public"."service_offering_appeal_status" AS ENUM ('pending', 'approved', 'rejected', 'canceled');

CREATE TABLE "service_personnel_offering_appeals" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "personnel_user_id" varchar(255) NOT NULL,
    "service_id" varchar(255) NOT NULL,
    "taken_down_at_snapshot" timestamp with time zone NOT NULL,
    "take_down_reason_snapshot" text,
    "appeal_reason" text NOT NULL,
    "status" "service_offering_appeal_status" DEFAULT 'pending' NOT NULL,
    "review_result_reason" text,
    "reviewed_by" varchar(255),
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_personnel_user_id_service_personnel_user_id_fk"
    FOREIGN KEY ("personnel_user_id") REFERENCES "public"."service_personnel"("user_id")
    ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE cascade ON UPDATE no action;

ALTER TABLE "service_personnel_offering_appeals"
    ADD CONSTRAINT "service_personnel_offering_appeals_reviewed_by_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;

CREATE INDEX "idx_service_offering_appeals_personnel_service"
    ON "service_personnel_offering_appeals"
    USING btree ("personnel_user_id", "service_id", "taken_down_at_snapshot", "created_at" DESC);

CREATE UNIQUE INDEX "uniq_service_offering_appeals_pending_round"
    ON "service_personnel_offering_appeals"
    USING btree ("personnel_user_id", "service_id", "taken_down_at_snapshot")
    WHERE status = 'pending';
```

- [ ] **Step 4: Extend worker types**

In `packages/types/src/work-skill.ts`, add appeal schemas after `ServiceOfferingSubmissionResultSchema`:

```ts
export const ServiceOfferingAppealStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "canceled",
]);

export type ServiceOfferingAppealStatus = z.infer<
    typeof ServiceOfferingAppealStatusSchema
>;

export const SubmitServiceOfferingAppealRequestSchema = z.object({
    appealReason: z
        .string()
        .trim()
        .min(10, "申诉说明至少 10 个字")
        .max(500, "申诉说明不能超过 500 个字"),
});

export type SubmitServiceOfferingAppealRequest = z.infer<
    typeof SubmitServiceOfferingAppealRequestSchema
>;

export const ServiceOfferingAppealSummarySchema = z.object({
    id: z.string().min(1, "申诉ID不能为空"),
    status: ServiceOfferingAppealStatusSchema,
    appealReason: z.string(),
    reviewResultReason: z.string().nullable(),
    takenDownAtSnapshot: z.date(),
    takeDownReasonSnapshot: z.string().nullable(),
    createdAt: z.date(),
    reviewedAt: z.date().nullable(),
});

export type ServiceOfferingAppealSummary = z.infer<
    typeof ServiceOfferingAppealSummarySchema
>;
```

Extend `WorkerServiceItemSchema`:

```ts
latestAppeal: ServiceOfferingAppealSummarySchema.nullable().optional(),
```

- [ ] **Step 5: Extend admin types**

In `packages/types/src/admin.ts`, import or use the worker appeal schema exports from the same package index if available. If circular local import is not convenient, define admin-local summary using the same enum names.

Change lifecycle enums:

```ts
export const ServiceOfferingLifecycleEnum = z
    .enum(["pending_review", "rejected", "active", "taken_down", "appeal_pending"])
    .describe("服务生命周期：待审核/已拒绝/已上架/已下架/申诉待处理");

export const ServiceOfferingLifecycleFilterEnum = z
    .enum(["all", "pending_review", "rejected", "active", "taken_down", "appeal_pending"])
    .describe("服务生命周期筛选");
```

Add admin appeal summary before `AdminServiceOfferingPublishedListItemSchema`:

```ts
export const AdminServiceOfferingAppealSummarySchema = z
    .object({
        id: z.string().min(1, "申诉ID不能为空"),
        status: z.enum(["pending", "approved", "rejected", "canceled"]),
        appealReason: z.string(),
        reviewResultReason: z.string().nullable(),
        takeDownReasonSnapshot: z.string().nullable(),
        takenDownAtSnapshot: IsoDateTimeStringSchema,
        createdAt: IsoDateTimeStringSchema,
        reviewedAt: IsoDateTimeStringSchema.nullable(),
    })
    .describe("服务下架申诉摘要");

export type AdminServiceOfferingAppealSummary = z.infer<
    typeof AdminServiceOfferingAppealSummarySchema
>;
```

Extend `AdminServiceOfferingPublishedListItemSchema`:

```ts
appeal: AdminServiceOfferingAppealSummarySchema.nullable()
    .optional()
    .describe("当前下架轮次的最新申诉"),
```

- [ ] **Step 6: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: type errors are acceptable at this stage only if they point to code not yet updated for new schema fields. Record exact first error and continue to Task 2.

---

### Task 2: Worker Appeal Submission Backend

**Files:**

- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`

- [ ] **Step 1: Add repository method**

In `work-skill.repository.ts`, import `servicePersonnelOfferingAppeals`. Add:

```ts
async submitServiceOfferingAppeal(
    personnelId: string,
    serviceId: string,
    appealReason: string,
): Promise<typeof servicePersonnelOfferingAppeals.$inferSelect> {
    const now = new Date();
    return await this.db.transaction(async (tx) => {
        const [status] = await tx
            .select({
                personnelUserId: servicePersonnelOfferingStatuses.personnelUserId,
                serviceId: servicePersonnelOfferingStatuses.serviceId,
                publicationStatus:
                    servicePersonnelOfferingStatuses.publicationStatus,
                reviewStatus: servicePersonnelOfferingStatuses.reviewStatus,
                takeDownReason: servicePersonnelOfferingStatuses.takeDownReason,
                takenDownAt: servicePersonnelOfferingStatuses.takenDownAt,
                takenDownBy: servicePersonnelOfferingStatuses.takenDownBy,
            })
            .from(servicePersonnelOfferingStatuses)
            .where(
                and(
                    eq(servicePersonnelOfferingStatuses.personnelUserId, personnelId),
                    eq(servicePersonnelOfferingStatuses.serviceId, serviceId),
                ),
            )
            .limit(1);

        if (!status) {
            throw new BadRequestException('服务不存在或尚未发布，无法申诉');
        }
        if (
            status.publicationStatus !== 'taken_down' ||
            status.reviewStatus !== 'approved' ||
            !status.takenDownAt
        ) {
            throw new BadRequestException('当前服务未处于可申诉的下架状态');
        }
        if (status.takenDownBy === personnelId) {
            throw new BadRequestException('服务人员主动下架不可申诉');
        }

        const [pendingAppeal] = await tx
            .select({ id: servicePersonnelOfferingAppeals.id })
            .from(servicePersonnelOfferingAppeals)
            .where(
                and(
                    eq(servicePersonnelOfferingAppeals.personnelUserId, personnelId),
                    eq(servicePersonnelOfferingAppeals.serviceId, serviceId),
                    eq(
                        servicePersonnelOfferingAppeals.takenDownAtSnapshot,
                        status.takenDownAt,
                    ),
                    eq(servicePersonnelOfferingAppeals.status, 'pending'),
                ),
            )
            .limit(1);

        if (pendingAppeal) {
            throw new BadRequestException('本次下架申诉已提交，请等待管理员处理');
        }

        const [appeal] = await tx
            .insert(servicePersonnelOfferingAppeals)
            .values({
                personnelUserId: personnelId,
                serviceId,
                takenDownAtSnapshot: status.takenDownAt,
                takeDownReasonSnapshot: status.takeDownReason,
                appealReason,
                status: 'pending',
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        await tx.insert(serviceOfferingAuditLogs).values({
            personnelUserId: personnelId,
            serviceId,
            type: 'submitted',
            operatorId: personnelId,
            occurredAt: now,
            note: `提交下架申诉：${appealReason}`,
        });

        return appeal;
    });
}
```

- [ ] **Step 2: Add service method**

In `work-skill.service.ts`, import `SubmitServiceOfferingAppealRequest` and `ServiceOfferingAppealSummary`. Add:

```ts
async submitServiceOfferingAppeal(
    personnelId: string,
    serviceId: string,
    payload: SubmitServiceOfferingAppealRequest,
): Promise<ServiceOfferingAppealSummary> {
    const appeal = await this.workSkillRepository.submitServiceOfferingAppeal(
        personnelId,
        serviceId,
        payload.appealReason.trim(),
    );

    return {
        id: appeal.id,
        status: appeal.status,
        appealReason: appeal.appealReason,
        reviewResultReason: appeal.reviewResultReason ?? null,
        takenDownAtSnapshot: appeal.takenDownAtSnapshot,
        takeDownReasonSnapshot: appeal.takeDownReasonSnapshot ?? null,
        createdAt: appeal.createdAt ?? new Date(),
        reviewedAt: appeal.reviewedAt ?? null,
    };
}
```

- [ ] **Step 3: Add controller route**

In `work-skill.controller.ts`, import:

```ts
SubmitServiceOfferingAppealRequestSchema,
ServiceOfferingAppealSummarySchema,
type SubmitServiceOfferingAppealRequest,
```

Add below `selfTakedownService`:

```ts
@UseGuards(AuthGuard)
@Post('worker/services/:serviceId/appeals')
@ApiOperation({
    summary: '提交服务下架申诉',
})
@ApiParam({
    name: 'serviceId',
    description: '服务ID',
    type: String,
})
@ApiBodies(SubmitServiceOfferingAppealRequestSchema)
@ApiSuccessResponse(ServiceOfferingAppealSummarySchema, {
    description: '成功提交服务下架申诉',
})
async submitServiceOfferingAppeal(
    @Param('serviceId') serviceId: string,
    @Body(new ZodValidationPipe(SubmitServiceOfferingAppealRequestSchema))
    body: SubmitServiceOfferingAppealRequest,
    @Req() req: Request,
) {
    return await this.workSkillService.submitServiceOfferingAppeal(
        req.user.id,
        serviceId,
        body,
    );
}
```

- [ ] **Step 4: Add focused backend tests**

In `work-skill.service.spec.ts`, add repository mock coverage or repository-oriented tests matching existing style:

```ts
it('管理员下架的服务可提交申诉', async () => {
    // Arrange: status publicationStatus taken_down, reviewStatus approved, takenDownBy admin, takenDownAt set.
    // Act: submitServiceOfferingAppeal(personnelId, serviceId, { appealReason: '下架原因与实际情况不符，请复核' })
    // Assert: appeal status pending and takenDownAtSnapshot equals current takenDownAt.
});

it('服务人员主动下架不可申诉', async () => {
    // Arrange: takenDownBy equals personnelId.
    // Act + Assert: reject with 当前服务未处于可申诉 or 主动下架不可申诉.
});

it('同一轮已有 pending 申诉时不可重复提交', async () => {
    // Arrange: pending appeal for same personnel/service/takenDownAt.
    // Act + Assert: reject with 本次下架申诉已提交.
});

it('同一轮 rejected 后允许再次提交申诉', async () => {
    // Arrange: rejected appeal exists, no pending appeal.
    // Act: submitServiceOfferingAppeal.
    // Assert: inserts a new pending appeal.
});
```

If the existing test file uses direct repository mocks rather than DB fixtures, mock `workSkillRepository.submitServiceOfferingAppeal` for service tests and add repository-specific behavior in Task 4.

- [ ] **Step 5: Run backend tests**

Run:

```bash
pnpm --filter backend test -- work-skill.service.spec.ts
```

Expected: service tests pass or only repository behavior gaps remain for Task 4.

---

### Task 3: Expose Latest Appeal To Worker Services

**Files:**

- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `packages/hooks/src/api/work-skill/index.ts`
- Modify: `packages/types/src/work-skill.ts`

- [ ] **Step 1: Add latest appeal loading**

In `work-skill.repository.ts`, add helper:

```ts
private async loadLatestAppealsForCurrentTakedown(
    personnelId: string,
): Promise<Map<string, ServiceOfferingAppealSummary>> {
    const rows = await this.db
        .select({
            serviceId: servicePersonnelOfferingAppeals.serviceId,
            id: servicePersonnelOfferingAppeals.id,
            status: servicePersonnelOfferingAppeals.status,
            appealReason: servicePersonnelOfferingAppeals.appealReason,
            reviewResultReason:
                servicePersonnelOfferingAppeals.reviewResultReason,
            takenDownAtSnapshot:
                servicePersonnelOfferingAppeals.takenDownAtSnapshot,
            takeDownReasonSnapshot:
                servicePersonnelOfferingAppeals.takeDownReasonSnapshot,
            createdAt: servicePersonnelOfferingAppeals.createdAt,
            reviewedAt: servicePersonnelOfferingAppeals.reviewedAt,
        })
        .from(servicePersonnelOfferingAppeals)
        .innerJoin(
            servicePersonnelOfferingStatuses,
            and(
                eq(
                    servicePersonnelOfferingStatuses.personnelUserId,
                    servicePersonnelOfferingAppeals.personnelUserId,
                ),
                eq(
                    servicePersonnelOfferingStatuses.serviceId,
                    servicePersonnelOfferingAppeals.serviceId,
                ),
                eq(
                    servicePersonnelOfferingStatuses.takenDownAt,
                    servicePersonnelOfferingAppeals.takenDownAtSnapshot,
                ),
            ),
        )
        .where(
            and(
                eq(servicePersonnelOfferingAppeals.personnelUserId, personnelId),
                eq(
                    servicePersonnelOfferingStatuses.publicationStatus,
                    'taken_down',
                ),
            ),
        )
        .orderBy(desc(servicePersonnelOfferingAppeals.createdAt));

    const map = new Map<string, ServiceOfferingAppealSummary>();
    for (const row of rows) {
        if (map.has(row.serviceId)) {
            continue;
        }
        map.set(row.serviceId, {
            id: row.id,
            status: row.status,
            appealReason: row.appealReason,
            reviewResultReason: row.reviewResultReason ?? null,
            takenDownAtSnapshot: row.takenDownAtSnapshot,
            takeDownReasonSnapshot: row.takeDownReasonSnapshot ?? null,
            createdAt: row.createdAt ?? new Date(),
            reviewedAt: row.reviewedAt ?? null,
        });
    }
    return map;
}
```

Import `ServiceOfferingAppealSummary` from `@repo/types`.

- [ ] **Step 2: Wire latestAppeal into listWorkerServices**

Find `listWorkerServices`. After loading audit logs, load appeals once:

```ts
const appeals = await this.loadLatestAppealsForCurrentTakedown(personnelId);
```

Change `toWorkerServiceItem(service, auditLogs)` signature to include:

```ts
private async toWorkerServiceItem(
    service: WorkerVisibleService,
    auditLogs: WorkerServiceAuditLog[],
    latestAppeal?: ServiceOfferingAppealSummary | null,
): Promise<WorkerServiceItem> {
```

Return:

```ts
latestAppeal: latestAppeal ?? null,
```

Call:

```ts
await this.toWorkerServiceItem(service, auditLogs.get(service.id) ?? [], appeals.get(service.id) ?? null)
```

- [ ] **Step 3: Normalize dates in hook**

In `packages/hooks/src/api/work-skill/index.ts`, extend `RawWorkerServiceItem` to treat `latestAppeal` dates as raw:

```ts
type RawWorkerServiceAppeal = Omit<
    NonNullable<WorkerServiceItem["latestAppeal"]>,
    "takenDownAtSnapshot" | "createdAt" | "reviewedAt"
> & {
    takenDownAtSnapshot?: RawDate;
    createdAt?: RawDate;
    reviewedAt?: RawDate;
};
```

Add `latestAppeal?: RawWorkerServiceAppeal | null;` to `RawWorkerServiceItem`.

In `normalizeWorkerServicesResponse`, add:

```ts
latestAppeal:
    service.latestAppeal === null || service.latestAppeal === undefined
        ? service.latestAppeal
        : {
              ...service.latestAppeal,
              takenDownAtSnapshot: toRequiredDate(
                  service.latestAppeal.takenDownAtSnapshot,
              ),
              createdAt: toRequiredDate(service.latestAppeal.createdAt),
              reviewedAt: toRequiredNullableDate(
                  service.latestAppeal.reviewedAt,
              ),
          },
```

- [ ] **Step 4: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: no type errors from worker service schema/date normalization.

---

### Task 4: Admin Appeal Repository And Notification Logic

**Files:**

- Modify: `apps/backend/src/modules/work-skill/admin-service-offerings.repository.ts`
- Modify: `apps/backend/src/modules/work-skill/admin-service-offerings.service.ts`
- Modify: `apps/backend/src/modules/work-skill/admin-service-offerings.controller.ts`
- Modify: `apps/backend/src/modules/work-skill/admin-service-offerings.repository.spec.ts`
- Modify: `apps/backend/src/modules/work-skill/admin-service-offerings.service.spec.ts`

- [ ] **Step 1: Add repository result types**

In `admin-service-offerings.repository.ts`, add:

```ts
export interface ServiceOfferingAppealReviewResult {
    appealId: string;
    personnelUserId: string;
    serviceId: string;
    status: 'approved' | 'rejected' | 'canceled';
    message: string;
}
```

- [ ] **Step 2: Extend list lifecycle helpers**

Update helper types:

```ts
type PublishedLifecycleSource = 'active' | 'taken_down' | 'appeal_pending';
```

Update includes:

```ts
function lifecycleIncludesPublished(lifecycle: ServiceOfferingLifecycleFilter) {
    return (
        lifecycle === 'all' ||
        lifecycle === 'active' ||
        lifecycle === 'taken_down' ||
        lifecycle === 'appeal_pending'
    );
}
```

When lifecycle is `appeal_pending`, list only published/taken-down rows joined to a pending appeal for the current `takenDownAt`.

- [ ] **Step 3: Add pending appeal join to admin list**

In the published list query, left join `servicePersonnelOfferingAppeals` on:

```ts
and(
    eq(servicePersonnelOfferingAppeals.personnelUserId, servicePersonnelOfferingStatuses.personnelUserId),
    eq(servicePersonnelOfferingAppeals.serviceId, servicePersonnelOfferingStatuses.serviceId),
    eq(servicePersonnelOfferingAppeals.takenDownAtSnapshot, servicePersonnelOfferingStatuses.takenDownAt),
    eq(servicePersonnelOfferingAppeals.status, 'pending'),
)
```

Select fields:

```ts
appealId: servicePersonnelOfferingAppeals.id,
appealStatus: servicePersonnelOfferingAppeals.status,
appealReason: servicePersonnelOfferingAppeals.appealReason,
appealReviewResultReason: servicePersonnelOfferingAppeals.reviewResultReason,
appealTakeDownReasonSnapshot:
    servicePersonnelOfferingAppeals.takeDownReasonSnapshot,
appealTakenDownAtSnapshot:
    servicePersonnelOfferingAppeals.takenDownAtSnapshot,
appealCreatedAt: servicePersonnelOfferingAppeals.createdAt,
appealReviewedAt: servicePersonnelOfferingAppeals.reviewedAt,
```

For `appeal_pending`, require `appealId IS NOT NULL`.

Map published item lifecycle:

```ts
const lifecycle =
    row.appealId && row.appealStatus === 'pending'
        ? 'appeal_pending'
        : derivePublishedLifecycle(row.publicationStatus);
```

Map item `appeal`:

```ts
appeal: row.appealId
    ? {
          id: row.appealId,
          status: row.appealStatus,
          appealReason: row.appealReason ?? '',
          reviewResultReason: row.appealReviewResultReason ?? null,
          takeDownReasonSnapshot: row.appealTakeDownReasonSnapshot ?? null,
          takenDownAtSnapshot: row.appealTakenDownAtSnapshot?.toISOString() ?? row.takenDownAt?.toISOString() ?? '',
          createdAt: row.appealCreatedAt?.toISOString() ?? row.updatedAt.toISOString(),
          reviewedAt: row.appealReviewedAt?.toISOString() ?? null,
      }
    : null,
```

- [ ] **Step 4: Add approveAppeal**

Add method:

```ts
async approveAppeal(
    appealId: string,
    adminUserId: string,
): Promise<ServiceOfferingAppealReviewResult> {
    const now = new Date();
    return await this.db.transaction(async (tx) => {
        const [appeal] = await tx
            .select()
            .from(servicePersonnelOfferingAppeals)
            .where(eq(servicePersonnelOfferingAppeals.id, appealId))
            .limit(1);

        if (!appeal || appeal.status !== 'pending') {
            throw new BadRequestException('申诉不存在或已处理');
        }

        const [status] = await tx
            .select()
            .from(servicePersonnelOfferingStatuses)
            .where(
                and(
                    eq(
                        servicePersonnelOfferingStatuses.personnelUserId,
                        appeal.personnelUserId,
                    ),
                    eq(servicePersonnelOfferingStatuses.serviceId, appeal.serviceId),
                ),
            )
            .limit(1);

        if (
            !status ||
            status.publicationStatus !== 'taken_down' ||
            !status.takenDownAt ||
            status.takenDownAt.getTime() !== appeal.takenDownAtSnapshot.getTime()
        ) {
            await tx
                .update(servicePersonnelOfferingAppeals)
                .set({
                    status: 'canceled',
                    reviewResultReason: '服务状态已变化，本次申诉已取消',
                    reviewedBy: adminUserId,
                    reviewedAt: now,
                    updatedAt: now,
                })
                .where(eq(servicePersonnelOfferingAppeals.id, appeal.id));
            return {
                appealId: appeal.id,
                personnelUserId: appeal.personnelUserId,
                serviceId: appeal.serviceId,
                status: 'canceled',
                message: '服务已恢复上线或进入新一轮下架，本次申诉已取消',
            };
        }

        await tx
            .update(servicePersonnelOfferingAppeals)
            .set({
                status: 'approved',
                reviewedBy: adminUserId,
                reviewedAt: now,
                updatedAt: now,
            })
            .where(eq(servicePersonnelOfferingAppeals.id, appeal.id));

        await tx
            .update(servicePersonnelOfferingStatuses)
            .set({
                publicationStatus: 'active',
                reviewStatus: 'approved',
                takeDownReason: null,
                takenDownBy: null,
                takenDownAt: null,
                updatedAt: now,
            })
            .where(
                and(
                    eq(
                        servicePersonnelOfferingStatuses.personnelUserId,
                        appeal.personnelUserId,
                    ),
                    eq(servicePersonnelOfferingStatuses.serviceId, appeal.serviceId),
                ),
            );

        await tx.insert(serviceOfferingAuditLogs).values({
            personnelUserId: appeal.personnelUserId,
            serviceId: appeal.serviceId,
            type: 'restored',
            operatorId: adminUserId,
            occurredAt: now,
            note: '申诉通过，服务恢复上线',
        });

        return {
            appealId: appeal.id,
            personnelUserId: appeal.personnelUserId,
            serviceId: appeal.serviceId,
            status: 'approved',
            message: '申诉已通过，服务已恢复上线',
        };
    });
}
```

- [ ] **Step 5: Add rejectAppeal**

Add:

```ts
async rejectAppeal(
    appealId: string,
    adminUserId: string,
    reason: string,
): Promise<ServiceOfferingAppealReviewResult> {
    const now = new Date();
    const [appeal] = await this.db
        .update(servicePersonnelOfferingAppeals)
        .set({
            status: 'rejected',
            reviewResultReason: reason,
            reviewedBy: adminUserId,
            reviewedAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(servicePersonnelOfferingAppeals.id, appealId),
                eq(servicePersonnelOfferingAppeals.status, 'pending'),
            ),
        )
        .returning();

    if (!appeal) {
        throw new BadRequestException('申诉不存在或已处理');
    }

    await this.db.insert(serviceOfferingAuditLogs).values({
        personnelUserId: appeal.personnelUserId,
        serviceId: appeal.serviceId,
        type: 'rejected',
        operatorId: adminUserId,
        occurredAt: now,
        note: `申诉驳回：${reason}`,
    });

    return {
        appealId: appeal.id,
        personnelUserId: appeal.personnelUserId,
        serviceId: appeal.serviceId,
        status: 'rejected',
        message: '申诉已驳回',
    };
}
```

- [ ] **Step 6: Cancel pending appeal when整改审核通过**

In `approveDraft`, before clearing status `takenDownAt`, capture existing current statuses for `targetServiceIds` where `publicationStatus = taken_down`. After restoring to active, update matching pending appeals:

```ts
await tx
    .update(servicePersonnelOfferingAppeals)
    .set({
        status: 'canceled',
        reviewResultReason: '整改审核已通过，服务已恢复上线，本次申诉自动取消',
        reviewedBy: adminUserId,
        reviewedAt: now,
        updatedAt: now,
    })
    .where(
        and(
            eq(servicePersonnelOfferingAppeals.personnelUserId, draft.personnelUserId),
            inArray(servicePersonnelOfferingAppeals.serviceId, targetServiceIds),
            eq(servicePersonnelOfferingAppeals.status, 'pending'),
        ),
    );
```

Before restoring each service, capture taken-down rows in a map:

```ts
const takenDownSnapshots = new Map<string, Date>();
const takenDownRows = await tx
    .select({
        serviceId: servicePersonnelOfferingStatuses.serviceId,
        takenDownAt: servicePersonnelOfferingStatuses.takenDownAt,
    })
    .from(servicePersonnelOfferingStatuses)
    .where(
        and(
            eq(
                servicePersonnelOfferingStatuses.personnelUserId,
                draft.personnelUserId,
            ),
            inArray(servicePersonnelOfferingStatuses.serviceId, targetServiceIds),
            eq(
                servicePersonnelOfferingStatuses.publicationStatus,
                'taken_down',
            ),
        ),
    );

for (const row of takenDownRows) {
    if (row.takenDownAt) {
        takenDownSnapshots.set(row.serviceId, row.takenDownAt);
    }
}
```

Then cancel pending appeals per service after restoring:

```ts
for (const [serviceId, takenDownAt] of takenDownSnapshots) {
    await tx
        .update(servicePersonnelOfferingAppeals)
        .set({
            status: 'canceled',
            reviewResultReason: '整改审核已通过，服务已恢复上线，本次申诉自动取消',
            reviewedBy: adminUserId,
            reviewedAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(
                    servicePersonnelOfferingAppeals.personnelUserId,
                    draft.personnelUserId,
                ),
                eq(servicePersonnelOfferingAppeals.serviceId, serviceId),
                eq(
                    servicePersonnelOfferingAppeals.takenDownAtSnapshot,
                    takenDownAt,
                ),
                eq(servicePersonnelOfferingAppeals.status, 'pending'),
            ),
        );
}
```

- [ ] **Step 7: Add service notifications**

In `admin-service-offerings.service.ts`, import `ServiceOfferingAppealReviewResult`. Add:

```ts
async approveAppeal(
    appealId: string,
    adminUserId: string,
): Promise<ServiceOfferingAppealReviewResult> {
    const result = await this.repository.approveAppeal(appealId, adminUserId);
    if (result.status === 'approved') {
        await this.publishServiceOfferingNotification(
            'service_offering_appeal_approved',
            result.personnelUserId,
            {
                title: '服务申诉已通过',
                message: '你的服务已恢复上线',
                personnelId: result.personnelUserId,
                serviceId: result.serviceId,
                appealId: result.appealId,
                action: 'appeal_approved',
                operatorId: adminUserId,
            },
        );
    }
    return result;
}

async rejectAppeal(
    appealId: string,
    adminUserId: string,
    reason: string,
): Promise<ServiceOfferingAppealReviewResult> {
    const normalizedReason = this.normalizeRequiredReason(reason);
    const result = await this.repository.rejectAppeal(
        appealId,
        adminUserId,
        normalizedReason,
    );
    await this.publishServiceOfferingNotification(
        'service_offering_appeal_rejected',
        result.personnelUserId,
        {
            title: '服务申诉已驳回',
            message: normalizedReason,
            personnelId: result.personnelUserId,
            serviceId: result.serviceId,
            appealId: result.appealId,
            action: 'appeal_rejected',
            reason: normalizedReason,
            operatorId: adminUserId,
        },
    );
    return result;
}
```

- [ ] **Step 8: Add controller routes**

In `admin-service-offerings.controller.ts`, add:

```ts
@Post('appeals/:id/approve')
@ApiOperation({ summary: '通过服务下架申诉' })
@ApiParam({ name: 'id', description: '申诉 ID' })
@ApiSuccessResponse(OperationResultSchema)
@ApiErrorResponses()
async approveAppeal(
    @Param('id', new ZodValidationPipe(IdParamSchema)) id: string,
    @Req() req: any,
) {
    await this.service.approveAppeal(id, req.user.id);
    return { success: true };
}

@Post('appeals/:id/reject')
@ApiOperation({ summary: '驳回服务下架申诉' })
@ApiParam({ name: 'id', description: '申诉 ID' })
@ApiSuccessResponse(OperationResultSchema)
@ApiErrorResponses()
async rejectAppeal(
    @Param('id', new ZodValidationPipe(IdParamSchema)) id: string,
    @Body(new ZodValidationPipe(AdminServiceOfferingReasonSchema))
    body: AdminServiceOfferingReason,
    @Req() req: any,
) {
    await this.service.rejectAppeal(id, req.user.id, body.reason);
    return { success: true };
}
```

- [ ] **Step 9: Add repository tests**

Add tests in `admin-service-offerings.repository.spec.ts`:

```ts
it('appeal_pending 只返回当前下架轮次的 pending 申诉', async () => {
    // Arrange active/taken_down rows plus pending/rejected appeals.
    // Act list({ lifecycle: 'appeal_pending' }).
    // Assert only taken_down with current takenDownAt matching pending appeal appears.
});

it('通过申诉恢复服务并清空当前下架字段', async () => {
    // Arrange pending appeal matching current takenDownAt.
    // Act approveAppeal.
    // Assert status active/approved, takeDownReason/takenDownBy/takenDownAt null.
});

it('驳回申诉保留下架态并记录原因', async () => {
    // Arrange pending appeal.
    // Act rejectAppeal.
    // Assert appeal rejected, status remains taken_down.
});

it('服务已通过整改上线时处理申诉会取消申诉', async () => {
    // Arrange pending appeal whose service is already active.
    // Act approveAppeal.
    // Assert appeal canceled and service remains active.
});
```

- [ ] **Step 10: Add service notification tests**

In `admin-service-offerings.service.spec.ts`, add:

```ts
it('通过申诉后通知服务人员', async () => {
    repository.approveAppeal.mockResolvedValue({
        appealId: 'appeal_1',
        personnelUserId: 'personnel_1',
        serviceId: 'service_1',
        status: 'approved',
        message: '申诉已通过，服务已恢复上线',
    });

    await service.approveAppeal('appeal_1', 'admin_1');

    expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
            event: 'service_offering_appeal_approved',
            payload: expect.objectContaining({
                userId: 'personnel_1',
                appealId: 'appeal_1',
                action: 'appeal_approved',
            }),
        }),
    );
});

it('驳回申诉后通知服务人员并包含原因', async () => {
    repository.rejectAppeal.mockResolvedValue({
        appealId: 'appeal_1',
        personnelUserId: 'personnel_1',
        serviceId: 'service_1',
        status: 'rejected',
        message: '申诉已驳回',
    });

    await service.rejectAppeal('appeal_1', 'admin_1', '材料仍不符合要求');

    expect(notificationPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
            event: 'service_offering_appeal_rejected',
            payload: expect.objectContaining({
                reason: '材料仍不符合要求',
                action: 'appeal_rejected',
            }),
        }),
    );
});
```

- [ ] **Step 11: Run backend tests**

Run:

```bash
pnpm --filter backend test -- admin-service-offerings.service.spec.ts admin-service-offerings.repository.spec.ts work-skill.service.spec.ts
```

Expected: all targeted tests pass.

---

### Task 5: Hooks For Worker And Admin

**Files:**

- Modify: `packages/hooks/src/api/work-skill/index.ts`
- Modify: `packages/hooks/src/api/ssr/admin-service-offerings.ts`

- [ ] **Step 1: Add worker submit appeal hook**

In `packages/hooks/src/api/work-skill/index.ts`, import:

```ts
ServiceOfferingAppealSummary,
ServiceOfferingAppealSummarySchema,
SubmitServiceOfferingAppealRequest,
```

Add:

```ts
export const useSubmitServiceOfferingAppeal = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            serviceId,
            appealReason,
        }: {
            serviceId: string;
            appealReason: SubmitServiceOfferingAppealRequest["appealReason"];
        }) => {
            const response = await apiClient.post<ServiceOfferingAppealSummary>(
                `/workSkill/worker/services/${serviceId}/appeals`,
                { appealReason },
            );
            return ServiceOfferingAppealSummarySchema.parse({
                ...response.data,
                takenDownAtSnapshot: new Date(response.data.takenDownAtSnapshot),
                createdAt: new Date(response.data.createdAt),
                reviewedAt: response.data.reviewedAt
                    ? new Date(response.data.reviewedAt)
                    : null,
            });
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "提交服务申诉失败",
        },
        scope: {
            id: "submitServiceOfferingAppeal",
        },
    });
};
```

- [ ] **Step 2: Add admin approve/reject hooks**

In `packages/hooks/src/api/ssr/admin-service-offerings.ts`, add:

```ts
export function useApproveServiceOfferingAppeal(
    query?: AdminServiceOfferingsQueryInput,
) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (appealId: string) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.post<z.infer<typeof operationResultSchema>>(
                `/admin/service-offerings/appeals/${appealId}/approve`,
                undefined,
                { schema: operationResultSchema },
            );

            if (!response.data?.success) {
                throw new Error("通过服务申诉失败");
            }

            return response.data;
        },
        onSuccess: () => {
            invalidateAdminServiceOfferingsQuery(queryClient, query);
        },
        meta: {
            errorMessage: "通过服务申诉失败",
        },
    });
}

export function useRejectServiceOfferingAppeal(
    query?: AdminServiceOfferingsQueryInput,
) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            appealId,
            reason,
        }: {
            appealId: string;
            reason: AdminServiceOfferingReason["reason"];
        }) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.post<z.infer<typeof operationResultSchema>>(
                `/admin/service-offerings/appeals/${appealId}/reject`,
                { reason },
                { schema: operationResultSchema },
            );

            if (!response.data?.success) {
                throw new Error("驳回服务申诉失败");
            }

            return response.data;
        },
        onSuccess: () => {
            invalidateAdminServiceOfferingsQuery(queryClient, query);
        },
        meta: {
            errorMessage: "驳回服务申诉失败",
        },
    });
}
```

- [ ] **Step 3: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: hooks compile.

---

### Task 6: Admin Web UI

**Files:**

- Modify: `apps/admin-web/src/app/(management)/service-offerings/_utils/query.ts`
- Modify: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offering-lifecycle-badge.tsx`
- Modify: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-page-content.tsx`
- Modify: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offerings-table.tsx`
- Modify: `apps/admin-web/src/app/(management)/service-offerings/_components/service-offering-detail-sheet.tsx`

- [ ] **Step 1: Add query lifecycle**

In `_utils/query.ts`, include `appeal_pending` in accepted lifecycle parsing and preserve fallback behavior:

```ts
const LIFECYCLE_VALUES = [
    "pending_review",
    "rejected",
    "active",
    "taken_down",
    "appeal_pending",
    "all",
] as const;
```

- [ ] **Step 2: Add tab and badge**

In `service-offerings-page-content.tsx`, add tab before `taken_down`:

```ts
{ value: "appeal_pending", label: "申诉待处理" },
```

In `service-offering-lifecycle-badge.tsx`, add:

```ts
appeal_pending: "申诉待处理",
```

and a distinct style:

```ts
appeal_pending: "bg-sky-100 text-sky-800",
```

- [ ] **Step 3: Add page mutations and reason dialog type**

In `service-offerings-page-content.tsx`, import:

```ts
useApproveServiceOfferingAppeal,
useRejectServiceOfferingAppeal,
```

Extend `ReasonDialogState`:

```ts
| { type: "rejectAppeal"; offering: PublishedItem }
```

Add:

```ts
const approveAppealMutation = useApproveServiceOfferingAppeal(requestQuery)
const rejectAppealMutation = useRejectServiceOfferingAppeal(requestQuery)
```

Extend `isActionPending`:

```ts
approveAppealMutation.isPending || rejectAppealMutation.isPending
```

Add handler:

```ts
const handleApproveAppeal = useCallback(
    async (offering: PublishedItem) => {
        if (!offering.appeal?.id) {
            toast.error("申诉记录不存在")
            return
        }
        await approveAppealMutation.mutateAsync(offering.appeal.id)
        toast.success("申诉已通过，服务已恢复上线")
        setDetailItem(null)
    },
    [approveAppealMutation],
)
```

In `handleConfirmReason`, add branch before takeDown:

```ts
if (reasonDialog.type === "rejectAppeal") {
    const appealId = reasonDialog.offering.appeal?.id
    if (!appealId) {
        toast.error("申诉记录不存在")
        return
    }
    await rejectAppealMutation.mutateAsync({ appealId, reason })
    toast.success("申诉已驳回")
    setReasonDialog(null)
    setDetailItem(null)
    return
}
```

- [ ] **Step 4: Pass appeal actions into table and detail sheet**

Add props:

```ts
onApproveAppeal: (offering: PublishedItem) => void
onRejectAppeal: (offering: PublishedItem) => void
```

Pass:

```tsx
onApproveAppeal={(offering) => {
    void handleApproveAppeal(offering)
}}
onRejectAppeal={(offering) =>
    setReasonDialog({ type: "rejectAppeal", offering })
}
```

- [ ] **Step 5: Render action buttons for appeal pending**

In `service-offerings-table.tsx`, extend props and `ActionButtons`.

Before active takedown branch:

```tsx
if (
    item.kind === "published" &&
    item.lifecycle === "appeal_pending" &&
    item.appeal?.status === "pending"
) {
    return (
        <>
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isActionPending}
                onClick={(event) => {
                    event.stopPropagation()
                    onRejectAppeal(item)
                }}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
                驳回申诉
            </Button>
            <Button
                type="button"
                size="sm"
                disabled={isActionPending}
                onClick={(event) => {
                    event.stopPropagation()
                    onApproveAppeal(item)
                }}
            >
                通过申诉
            </Button>
        </>
    )
}
```

In service cell or detail expansion, show appeal summary:

```tsx
{item.kind === "published" && item.appeal?.status === "pending" ? (
    <div className="mt-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
        申诉说明：{item.appeal.appealReason}
    </div>
) : null}
```

- [ ] **Step 6: Reuse reason dialog for appeal rejection**

In `ServiceOfferingReasonAlert`, set labels:

```tsx
title={
    reasonDialog?.type === "takeDown"
        ? "下架服务"
        : reasonDialog?.type === "rejectAppeal"
          ? "驳回申诉"
          : "拒绝审核"
}
description={
    reasonDialog?.type === "takeDown"
        ? "下架原因会发送给服务人员，并在相关页面展示。"
        : reasonDialog?.type === "rejectAppeal"
          ? "驳回原因会发送给服务人员，服务会继续保持下架。"
          : "拒绝原因会发送给服务人员，用于修改后重新提交。"
}
confirmLabel={
    reasonDialog?.type === "takeDown"
        ? "确认下架"
        : reasonDialog?.type === "rejectAppeal"
          ? "确认驳回"
          : "确认拒绝"
}
isPending={
    rejectMutation.isPending ||
    takeDownMutation.isPending ||
    rejectAppealMutation.isPending
}
```

- [ ] **Step 7: Run admin type-check**

Run:

```bash
pnpm type-check
```

Expected: admin-web compiles with new lifecycle value and props.

---

### Task 7: Mobile Worker UI

**Files:**

- Modify: `apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx`
- Modify: `apps/mobile-worker/app/profile/service-settings-audit-model.ts` if helper logic needs extraction.

- [ ] **Step 1: Import hook and schema type**

In `service-settings-detail-redesign.tsx`, import `useSubmitServiceOfferingAppeal` from `@repo/hooks/api/work-skill`.

Add local form type:

```ts
type AppealFormValues = {
    appealReason: string;
};
```

- [ ] **Step 2: Track appeal modal state**

Inside `ServiceSettingsDetailRedesignScreen`, add:

```ts
const [isAppealSheetOpen, setIsAppealSheetOpen] = useState(false);
const submitAppealMutation = useSubmitServiceOfferingAppeal();
const appealForm = useForm<AppealFormValues>({
    defaultValues: {
        appealReason: "",
    },
});
```

Add submit handler:

```ts
const handleSubmitAppeal = appealForm.handleSubmit(async (values) => {
    if (!currentAuditItem?.serviceId) {
        toast.error("服务信息不存在");
        return;
    }
    await submitAppealMutation.mutateAsync({
        serviceId: currentAuditItem.serviceId,
        appealReason: values.appealReason,
    });
    toast.success("申诉已提交");
    appealForm.reset({ appealReason: "" });
    setIsAppealSheetOpen(false);
});
```

Use `currentAuditItem`, which is already the `WorkerServiceItem` passed to `buildServiceAuditNotice`.

- [ ] **Step 3: Extend notice model**

Change `ServiceAuditNotice`:

```ts
type ServiceAuditNotice = {
    title: string;
    message: string;
    tone: ServiceAuditTone;
    icon: keyof typeof Ionicons.glyphMap;
    appealState?: "available" | "pending" | "rejected";
    appealRejectReason?: string | null;
    steps?: ReturnType<typeof buildStepItems>;
};
```

Update `buildServiceAuditNotice` taken-down branch:

```ts
const latestAppeal = item.latestAppeal;
if (item.derivedStatus === "takendown") {
    if (latestAppeal?.status === "pending") {
        return {
            title: "申诉处理中",
            message: "申诉已提交，等待管理员处理。",
            tone: "pending",
            icon: "time-outline",
            appealState: "pending",
            steps,
        };
    }
    if (latestAppeal?.status === "rejected") {
        return {
            title: "申诉已驳回",
            message: `驳回原因：${latestAppeal.reviewResultReason ?? "暂无原因"}`,
            tone: "taken_down",
            icon: "remove-circle-outline",
            appealState: "rejected",
            appealRejectReason: latestAppeal.reviewResultReason ?? null,
            steps,
        };
    }
    return {
        title: "服务已下架",
        message: `下架原因：${reason ?? "暂无原因"}`,
        tone: "taken_down",
        icon: "remove-circle-outline",
        appealState: "available",
        steps,
    };
}
```

- [ ] **Step 4: Replace disabled appeal button**

Change `ServiceAuditNoticeCard` props:

```ts
function ServiceAuditNoticeCard(props: {
    notice: ServiceAuditNotice;
    onAppealPress?: () => void;
}) {
```

Replace disabled button:

```tsx
{props.notice.appealState ? (
    <Pressable
        className={`items-center rounded-full py-2.5 ${
            props.notice.appealState === "pending"
                ? "bg-[#E5E7EB]"
                : "bg-[#111827]"
        }`}
        disabled={props.notice.appealState === "pending"}
        onPress={props.onAppealPress}
    >
        <Text
            className={`text-xs leading-[18px] ${
                props.notice.appealState === "pending"
                    ? "text-[#6A7282]"
                    : "text-white"
            }`}
        >
            {props.notice.appealState === "pending"
                ? "申诉处理中"
                : props.notice.appealState === "rejected"
                  ? "重新申诉"
                  : "申诉"}
        </Text>
    </Pressable>
) : null}
```

Where `ServiceAuditNoticeCard` is rendered, pass:

```tsx
onAppealPress={() => setIsAppealSheetOpen(true)}
```

- [ ] **Step 5: Add appeal bottom sheet**

Use existing `BottomSheetModal`, `Textarea`, and `Controller`:

```tsx
<BottomSheetModal
    visible={isAppealSheetOpen}
    onClose={() => {
        if (!submitAppealMutation.isPending) {
            setIsAppealSheetOpen(false);
        }
    }}
>
    <View className="gap-4 px-5 pb-6 pt-2">
        <View>
            <Text className="text-lg font-semibold text-[#111827]">提交申诉</Text>
            <Text className="mt-1 text-sm leading-5 text-[#6A7282]">
                请说明你认为本次下架需要复核的原因。申诉通过后会恢复原线上服务。
            </Text>
        </View>

        {currentAuditItem?.takenDownReason ? (
            <View className="rounded-2xl bg-[#F3F4F6] p-3">
                <Text className="text-xs text-[#6A7282]">下架原因</Text>
                <Text className="mt-1 text-sm leading-5 text-[#111827]">
                    {currentAuditItem.takenDownReason}
                </Text>
            </View>
        ) : null}

        <Controller
            control={appealForm.control}
            name="appealReason"
            rules={{
                required: "请填写申诉说明",
                minLength: {
                    value: 10,
                    message: "申诉说明至少 10 个字",
                },
                maxLength: {
                    value: 500,
                    message: "申诉说明不能超过 500 个字",
                },
            }}
            render={({ field, fieldState }) => (
                <View>
                    <Textarea
                        value={field.value}
                        onChangeText={field.onChange}
                        placeholder="请填写申诉说明"
                        className="min-h-[120px]"
                    />
                    {fieldState.error?.message ? (
                        <Text className="mt-1 text-xs text-[#DC2626]">
                            {fieldState.error.message}
                        </Text>
                    ) : null}
                </View>
            )}
        />

        <Pressable
            className="items-center rounded-full bg-[#111827] py-3"
            disabled={submitAppealMutation.isPending}
            onPress={() => {
                void handleSubmitAppeal();
            }}
        >
            <Text className="text-sm font-medium text-white">
                {submitAppealMutation.isPending ? "提交中..." : "提交申诉"}
            </Text>
        </Pressable>
    </View>
</BottomSheetModal>
```

This sheet reads下架原因 from `currentAuditItem.takenDownReason` and submits `currentAuditItem.serviceId`.

- [ ] **Step 6: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: mobile-worker compiles.

---

### Task 8: End-To-End Verification And Cleanup

**Files:**

- Review all modified files.

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
pnpm --filter backend test -- work-skill.service.spec.ts admin-service-offerings.service.spec.ts admin-service-offerings.repository.spec.ts
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run full type-check**

Run:

```bash
pnpm type-check
```

Expected: no TypeScript errors.

- [ ] **Step 3: Inspect diff without committing**

Run:

```bash
git -C /mnt/f/home_server diff --stat
```

Expected: changes limited to appeal feature files, spec, and plan.

Run:

```bash
git -C /mnt/f/home_server diff -- docs/superpowers/specs/2026-05-18-service-offering-appeal-design.md docs/superpowers/plans/2026-05-18-service-offering-appeal-implementation.md
```

Expected: docs contain no unresolved markers such as `TBD`, `TODO`, or unknown variable names.

- [ ] **Step 4: Manual scenario checklist**

Use seeded/local data or API calls from app UI:

- Admin down service with reason.
- Worker sees taken-down notice and “申诉” button.
- Worker submits appeal with 10-500 chars.
- Worker sees “申诉处理中”.
- Admin filters “申诉待处理”.
- Admin rejects appeal with reason.
- Worker sees rejection reason and “重新申诉”.
- Worker submits again.
- Admin approves appeal.
- Worker service returns to active.
- Public discovery still hides taken-down services before approval and shows restored service after approval.
- If worker submits整改审核 while appeal pending, approving整改 cancels pending appeal.

- [ ] **Step 5: Final status**

Do not commit. Report:

- Files changed.
- Migration SQL file path.
- Verification commands and results.
- Any environment-only failures.
