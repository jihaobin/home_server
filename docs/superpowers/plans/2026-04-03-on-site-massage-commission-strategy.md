# 上门按摩动态抽成策略 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为“上门按摩”服务分类落地带版本发布能力的动态抽成策略，包括后台配置、发布、试算、结算判档、退款月度冲减与历史快照扩展。

**Architecture:** 保留服务分类现有 `commission_rate` 作为兜底抽成，在后端新增独立的“分类抽成策略/版本/规则”数据模型和管理接口；结算时仅对“上门按摩”分类调用新的抽成判定服务，其余分类仍走现有固定抽成。管理端新增独立的策略页面，按 SSR 预取 + React Query hooks 模式接入草稿编辑、发布和试算。

**Tech Stack:** NestJS 11、Drizzle ORM、PostgreSQL、Zod、React Query、Next.js App Router、@tanstack/react-form

---

## File Map

- Create: `apps/backend/src/common/database/schema/category-commission-strategies.ts`
  负责定义分类抽成策略、版本、规则、操作审计表及 relations。
- Modify: `apps/backend/src/common/database/schema/index.ts`
  导出新的 schema 模块。
- Create: `apps/backend/drizzle/0066_on_site_massage_commission_strategy.sql`
  创建新表、索引、约束和必要默认值。
- Modify: `apps/backend/drizzle/meta/0066_snapshot.json`
  更新 Drizzle snapshot。
- Modify: `apps/backend/drizzle/meta/_journal.json`
  注册新 migration。
- Modify: `packages/types/src/admin.ts`
  增加策略版本、规则项、试算输入输出、发布输入输出 schema。
- Modify: `packages/types/src/pay.ts`
  扩展收益记录的抽成快照字段。
- Modify: `packages/types/src/database-entity.ts`
  为新的数据库实体补齐 Zod schema。
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.repository.ts`
  负责策略/版本/规则查询、写入、发布事务。
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.ts`
  负责草稿复制、发布校验、试算逻辑和分类绑定校验。
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.controller.ts`
  暴露策略详情、更新草稿、发布、试算接口。
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
  注册新的 controller/provider。
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.spec.ts`
  覆盖发布校验、试算和回退逻辑。
- Create: `apps/backend/src/modules/pay/worker-category-commission.repository.ts`
  查询上门按摩分类标识、月度已入账收益、保护期和版本快照。
- Create: `apps/backend/src/modules/pay/worker-category-commission.service.ts`
  负责“上门按摩”订单的抽成判定、退款月份归属和快照组装。
- Create: `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts`
  覆盖保护期、阶梯命中、退款冲减、固定抽成兜底。
- Modify: `apps/backend/src/modules/pay/pay.module.ts`
  注入新的抽成判定服务与仓储。
- Modify: `apps/backend/src/modules/pay/pay.service.ts`
  将当前固定抽成计算替换为“上门按摩动态判定 + 其他分类固定抽成”。
- Modify: `apps/backend/src/modules/pay/pay.repository.ts`
  读取并透出新增的抽成快照字段。
- Create: `packages/hooks/src/api/ssr/admin-service-category-commission-strategy.ts`
  管理端策略详情、保存草稿、发布、试算 hooks。
- Modify: `packages/hooks/src/api/ssr/index.ts`
  导出新的 hooks。
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
  为策略页面增加 SSR 预取。
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/page.tsx`
  策略管理页面路由入口。
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-page-section.tsx`
  页面 section + 错误边界承载层。
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-page-content.tsx`
  规则编辑、版本发布、试算主界面。
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-rule-table.tsx`
  阶梯规则表格。
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-simulator.tsx`
  试算组件。
- Modify: `apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx`
  为“上门按摩”分类增加“抽成策略”入口。

## Task 1: 建立数据模型与共享契约(已完成)

**Files:**

- Create: `apps/backend/src/common/database/schema/category-commission-strategies.ts`
- Modify: `apps/backend/src/common/database/schema/index.ts`
- Create: `apps/backend/drizzle/0066_on_site_massage_commission_strategy.sql`
- Modify: `apps/backend/drizzle/meta/0066_snapshot.json`
- Modify: `apps/backend/drizzle/meta/_journal.json`
- Modify: `packages/types/src/database-entity.ts`
- Modify: `packages/types/src/admin.ts`
- Modify: `packages/types/src/pay.ts`

- [ ] **Step 1: 先写共享 schema 的失败用例，锁定配置边界**

Create `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.spec.ts` with:

```ts
import {
    AdminCommissionStrategyDraftSchema,
    AdminCommissionStrategyRuleSchema,
    AdminCommissionStrategyPublishInputSchema,
} from '@repo/types';

describe('AdminCommissionStrategy schemas', () => {
    it('rejects a rule with threshold below zero', () => {
        const result = AdminCommissionStrategyRuleSchema.safeParse({
            id: 'rule_1',
            threshold: -1,
            commissionRate: 20,
            isEnabled: true,
            sortOrder: 1,
        });

        expect(result.success).toBe(false);
    });

    it('rejects a commission rate above 100', () => {
        const result = AdminCommissionStrategyRuleSchema.safeParse({
            id: 'rule_2',
            threshold: 5000,
            commissionRate: 120,
            isEnabled: true,
            sortOrder: 1,
        });

        expect(result.success).toBe(false);
    });

    it('requires a target category id for publish input', () => {
        const result = AdminCommissionStrategyPublishInputSchema.safeParse({});

        expect(result.success).toBe(false);
    });

    it('accepts a valid draft payload', () => {
        const result = AdminCommissionStrategyDraftSchema.safeParse({
            categoryId: 'cat_massage',
            draftVersionId: 'ver_draft',
            beginnerProtection: {
                isEnabled: true,
                protectionDays: 90,
                monthlyIncomeThreshold: 5000,
                fixedCommissionRate: 20,
            },
            rules: [
                {
                    id: 'rule_15000',
                    threshold: 15000,
                    commissionRate: 10,
                    isEnabled: true,
                    sortOrder: 1,
                },
            ],
        });

        expect(result.success).toBe(true);
    });
});
```

- [ ] **Step 2: 运行失败用例，确认类型契约尚未实现**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-category-commission-strategy.service.spec.ts --runInBand`

Expected: FAIL，报错指出 `@repo/types` 中缺少 `AdminCommissionStrategyDraftSchema`、`AdminCommissionStrategyRuleSchema` 等导出。

- [ ] **Step 3: 增加数据库表与 Zod 契约**

Implement the new schema module and types with the following shape:

```ts
// apps/backend/src/common/database/schema/category-commission-strategies.ts
export const categoryCommissionStrategies = pgTable('category_commission_strategies', {
    id: varchar('id', { length: 255 }).primaryKey().$default(() => createId()),
    categoryId: varchar('category_id', { length: 255 }).notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
    strategyCode: varchar('strategy_code', { length: 64 }).notNull(),
    strategyName: varchar('strategy_name', { length: 128 }).notNull(),
    fallbackCommissionRate: integer('fallback_commission_rate').notNull().default(30),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categoryCommissionStrategyVersions = pgTable('category_commission_strategy_versions', {
    id: varchar('id', { length: 255 }).primaryKey().$default(() => createId()),
    strategyId: varchar('strategy_id', { length: 255 }).notNull().references(() => categoryCommissionStrategies.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    beginnerProtectionEnabled: boolean('beginner_protection_enabled').notNull().default(false),
    beginnerProtectionDays: integer('beginner_protection_days').notNull().default(90),
    beginnerIncomeThreshold: integer('beginner_income_threshold').notNull().default(5000),
    beginnerCommissionRate: integer('beginner_commission_rate').notNull().default(20),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: varchar('published_by', { length: 255 }).references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categoryCommissionStrategyRules = pgTable('category_commission_strategy_rules', {
    id: varchar('id', { length: 255 }).primaryKey().$default(() => createId()),
    versionId: varchar('version_id', { length: 255 }).notNull().references(() => categoryCommissionStrategyVersions.id, { onDelete: 'cascade' }),
    threshold: integer('threshold').notNull(),
    commissionRate: integer('commission_rate').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// packages/types/src/admin.ts
export const AdminCommissionStrategyRuleSchema = z.object({
    id: z.string().min(1),
    threshold: z.number().int().min(0),
    commissionRate: z.number().int().min(0).max(100),
    isEnabled: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
});

export const AdminCommissionStrategyDraftSchema = z.object({
    categoryId: z.string().min(1),
    draftVersionId: z.string().min(1),
    beginnerProtection: z.object({
        isEnabled: z.boolean(),
        protectionDays: z.number().int().min(1),
        monthlyIncomeThreshold: z.number().int().min(0),
        fixedCommissionRate: z.number().int().min(0).max(100),
    }),
    rules: z.array(AdminCommissionStrategyRuleSchema),
});
```

```ts
// packages/types/src/pay.ts
export const WorkerEarningsRecordItemSchema = z.object({
    // existing fields...
    commissionRate: z.number().nullable().optional(),
    commissionAmount: z.number().nullable().optional(),
    commissionRuleType: z.enum(['fixed', 'beginner-protection', 'dynamic']).nullable().optional(),
    commissionThreshold: z.number().nullable().optional(),
    commissionStrategyVersionId: z.string().nullable().optional(),
    monthlyIncomeSnapshot: z.number().nullable().optional(),
});
```

- [ ] **Step 4: 生成 migration 并同步 snapshot**

Run: `pnpm --filter backend db:generate`

Expected: 生成 `apps/backend/drizzle/0066_on_site_massage_commission_strategy.sql`，并更新 `apps/backend/drizzle/meta/0066_snapshot.json` 与 `apps/backend/drizzle/meta/_journal.json`。

- [ ] **Step 5: 再跑一次 schema 用例**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-category-commission-strategy.service.spec.ts --runInBand`

Expected: PASS，至少通过本任务新增的 schema 契约断言。

## Task 2: 实现后台策略管理、发布和试算 API(已完成)

**Files:**

- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.repository.ts`
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.ts`
- Create: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.controller.ts`
- Modify: `apps/backend/src/modules/admin/admin.module.ts`
- Modify: `packages/types/src/admin.ts`
- Test: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.spec.ts`

- [ ] **Step 1: 先写发布与试算的失败用例**

Extend `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.spec.ts` with:

```ts
describe('AdminServiceCategoryCommissionStrategyService', () => {
    it('rejects publish when all dynamic rules are disabled', async () => {
        await expect(
            service.publishDraft({
                categoryId: 'cat_massage',
                operatorId: 'admin_1',
            }),
        ).rejects.toThrow('至少保留一条启用的动态规则');
    });

    it('returns beginner protection rate when income is within threshold', async () => {
        const result = await service.simulate({
            categoryId: 'cat_massage',
            workerId: 'worker_1',
            settlementDate: '2026-04-10T10:00:00.000Z',
            monthlyIncomeBeforeSettlement: 5000,
            isWithinBeginnerProtection: true,
        });

        expect(result.ruleType).toBe('beginner-protection');
        expect(result.commissionRate).toBe(20);
    });

    it('falls back to fixed category rate when no enabled rule matches', async () => {
        const result = await service.simulate({
            categoryId: 'cat_massage',
            workerId: 'worker_1',
            settlementDate: '2026-04-10T10:00:00.000Z',
            monthlyIncomeBeforeSettlement: 1000,
            isWithinBeginnerProtection: false,
        });

        expect(result.ruleType).toBe('fixed');
        expect(result.commissionRate).toBe(30);
    });
});
```

- [ ] **Step 2: 运行失败用例，确认 service / repository / controller 尚未接线**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-category-commission-strategy.service.spec.ts --runInBand`

Expected: FAIL，报错提示 `AdminServiceCategoryCommissionStrategyService` 或其依赖尚不存在。

- [ ] **Step 3: 实现 repository 与 service 的最小发布模型**

Add the repository/service skeleton:

```ts
// repository
async findStrategyByCategoryId(categoryId: string) {}
async findDraftVersion(strategyId: string) {}
async findPublishedVersion(strategyId: string) {}
async replaceDraftVersion(input: ReplaceDraftVersionInput) {}
async publishDraftVersion(input: { strategyId: string; operatorId: string }) {}
async recordAuditLog(input: CommissionStrategyAuditInsert) {}
```

```ts
// service
async getStrategyDetail(categoryId: string) {
    await this.assertMassageCategory(categoryId);
    return this.repository.findStrategyDetailByCategoryId(categoryId);
}

async saveDraft(input: SaveCommissionStrategyDraftInput) {
    this.assertDraftPayload(input.payload);
    await this.assertMassageCategory(input.categoryId);
    return this.repository.replaceDraftVersion(input);
}

async publishDraft(input: PublishCommissionStrategyInput) {
    const draft = await this.repository.findDraftVersionByCategoryId(input.categoryId);
    this.assertPublishableDraft(draft);
    return this.repository.publishDraftVersion(input);
}

async simulate(input: AdminCommissionStrategySimulationInput) {
    const version = await this.repository.findEffectiveVersionByCategoryId(input.categoryId);
    return this.evaluateDraftOrPublishedVersion(version, input);
}
```

- [ ] **Step 4: 暴露管理接口，并注册到 AdminModule**

Use the following route surface:

```ts
@Controller('admin/service-categories/:categoryId/commission-strategy')
export class AdminServiceCategoryCommissionStrategyController {
    @Get() getDetail(@Param('categoryId') categoryId: string) {}
    @Put('draft') saveDraft(@Param('categoryId') categoryId: string, @Body() body: SaveCommissionStrategyDraftInput) {}
    @Post('publish') publishDraft(@Param('categoryId') categoryId: string, @Req() req: Request) {}
    @Post('simulate') simulate(@Param('categoryId') categoryId: string, @Body() body: AdminCommissionStrategySimulationInput) {}
}
```

Register in `apps/backend/src/modules/admin/admin.module.ts`:

```ts
controllers: [
    // existing controllers...
    AdminServiceCategoryCommissionStrategyController,
],
providers: [
    // existing providers...
    AdminServiceCategoryCommissionStrategyService,
    AdminServiceCategoryCommissionStrategyRepository,
],
```

- [ ] **Step 5: 跑后台单测，确认发布和试算逻辑通过**

Run: `pnpm --filter backend test -- src/modules/admin/admin-service-category-commission-strategy.service.spec.ts --runInBand`

Expected: PASS。

## Task 3: 实现结算判档服务并接入 PayService(已完成)

**Files:**

- Create: `apps/backend/src/modules/pay/worker-category-commission.repository.ts`
- Create: `apps/backend/src/modules/pay/worker-category-commission.service.ts`
- Create: `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts`
- Modify: `apps/backend/src/modules/pay/pay.module.ts`
- Modify: `apps/backend/src/modules/pay/pay.service.ts`

- [ ] **Step 1: 先写结算判档失败用例**

Create `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts` with:

```ts
describe('WorkerCategoryCommissionService', () => {
    it('uses beginner protection when worker is within protection days and income is <= threshold', async () => {
        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_1',
            workerId: 'worker_1',
            categoryId: 'cat_massage',
            categoryName: '上门按摩',
            fixedCommissionRate: 30,
            orderAmount: '100.00',
            originalAmount: '100.00',
            settlementDate: new Date('2026-04-12T12:00:00.000Z'),
        });

        expect(result.ruleType).toBe('beginner-protection');
        expect(result.commissionRate).toBe(20);
        expect(result.monthlyIncomeSnapshot).toBe(5000);
    });

    it('uses dynamic rule with highest matched threshold', async () => {
        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_2',
            workerId: 'worker_2',
            categoryId: 'cat_massage',
            categoryName: '上门按摩',
            fixedCommissionRate: 30,
            orderAmount: '200.00',
            originalAmount: '200.00',
            settlementDate: new Date('2026-04-20T12:00:00.000Z'),
        });

        expect(result.ruleType).toBe('dynamic');
        expect(result.commissionRate).toBe(10);
        expect(result.commissionThreshold).toBe(15000);
    });

    it('falls back to fixed category rate for non-massage category', async () => {
        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_3',
            workerId: 'worker_2',
            categoryId: 'cat_cleaning',
            categoryName: '保洁',
            fixedCommissionRate: 35,
            orderAmount: '200.00',
            originalAmount: '200.00',
            settlementDate: new Date('2026-04-20T12:00:00.000Z'),
        });

        expect(result.ruleType).toBe('fixed');
        expect(result.commissionRate).toBe(35);
    });
});
```

- [ ] **Step 2: 运行失败用例，确认新结算服务尚未存在**

Run: `pnpm --filter backend test -- src/modules/pay/worker-category-commission.service.spec.ts --runInBand`

Expected: FAIL。

- [ ] **Step 3: 实现专用结算判档服务与仓储**

Implement the service boundary as:

```ts
export interface ResolveWorkerCategoryCommissionInput {
    orderId: string;
    workerId: string;
    categoryId: string | null;
    categoryName: string | null;
    fixedCommissionRate: number;
    orderAmount: string;
    originalAmount: string | null;
    settlementDate: Date;
}

export class WorkerCategoryCommissionService {
    async resolveCommissionSnapshot(input: ResolveWorkerCategoryCommissionInput) {
        if (!this.isMassageCategory(input.categoryName)) {
            return this.buildFixedSnapshot(input.fixedCommissionRate, input);
        }

        const monthlyIncome = await this.repository.sumMonthlySettledIncomeBefore({
            workerId: input.workerId,
            settlementDate: input.settlementDate,
            categoryName: '上门按摩',
        });

        const strategyVersion = await this.repository.findPublishedStrategyVersionByCategoryId(input.categoryId);

        if (!strategyVersion) {
            return this.buildFixedSnapshot(input.fixedCommissionRate, input, monthlyIncome);
        }

        return this.resolveFromStrategyVersion({
            input,
            monthlyIncome,
            strategyVersion,
        });
    }
}
```

- [ ] **Step 4: 在 PayService 中用新服务替换当前固定抽成判定**

Replace the fixed logic in `buildCommissionSnapshotFromOrder`:

```ts
const categoryRecord = await this.loadOrderCategoryRecord(tx, order);
const commissionSnapshot =
    await this.workerCategoryCommissionService.resolveCommissionSnapshot({
        orderId: order.id,
        workerId: order.servicePersonnelId!,
        categoryId: categoryRecord?.categoryId ?? null,
        categoryName: categoryRecord?.categoryName ?? null,
        fixedCommissionRate: categoryRecord?.commissionRate ?? 30,
        orderAmount: order.totalAmount ?? '0',
        originalAmount: order.originalAmount ?? order.totalAmount ?? '0',
        settlementDate: new Date(),
    });

return commissionSnapshot;
```

Register dependencies in `apps/backend/src/modules/pay/pay.module.ts`:

```ts
providers: [
    // existing providers...
    WorkerCategoryCommissionRepository,
    WorkerCategoryCommissionService,
],
```

- [ ] **Step 5: 跑结算单测**

Run: `pnpm --filter backend test -- src/modules/pay/worker-category-commission.service.spec.ts --runInBand`

Expected: PASS。

## Task 4: 扩展收益快照与退款月份冲减(已完成)

**Files:**

- Modify: `apps/backend/src/modules/pay/pay.service.ts`
- Modify: `apps/backend/src/modules/pay/pay.repository.ts`
- Modify: `packages/types/src/pay.ts`
- Test: `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts`

- [ ] **Step 1: 先写退款归属月份和快照字段的失败断言**

Extend `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts` with:

```ts
it('counts refunds in the month when the refund happens', async () => {
    const monthlyIncome = await repository.sumMonthlySettledIncomeBefore({
        workerId: 'worker_1',
        settlementDate: new Date('2026-04-25T12:00:00.000Z'),
        categoryName: '上门按摩',
    });

    expect(monthlyIncome).toBe(4300);
});

it('stores strategy snapshot metadata on settlement records', async () => {
    const snapshot = await service.resolveCommissionSnapshot({
        orderId: 'order_4',
        workerId: 'worker_1',
        categoryId: 'cat_massage',
        categoryName: '上门按摩',
        fixedCommissionRate: 30,
        orderAmount: '300.00',
        originalAmount: '300.00',
        settlementDate: new Date('2026-04-25T12:00:00.000Z'),
    });

    expect(snapshot.commissionStrategyVersionId).toBe('ver_published');
    expect(snapshot.commissionRuleType).toBeDefined();
    expect(snapshot.monthlyIncomeSnapshot).toBeDefined();
});
```

- [ ] **Step 2: 运行失败用例**

Run: `pnpm --filter backend test -- src/modules/pay/worker-category-commission.service.spec.ts --runInBand`

Expected: FAIL，提示 repository 的月收入聚合尚未考虑退款月份，或 snapshot 字段尚未写入。

- [ ] **Step 3: 在仓储聚合中纳入退款发生月冲减，并透传新快照字段**

Update repository/service code along these lines:

```ts
async sumMonthlySettledIncomeBefore(input: {
    workerId: string;
    settlementDate: Date;
    categoryName: string;
}) {
    return this.db
        .select({
            amount: sql<number>`COALESCE(SUM(
                CASE
                    WHEN ${financialTransactions.transactionType} = 'service_income' THEN ${financialTransactions.amount}
                    WHEN ${financialTransactions.transactionType} = 'refund' THEN ${financialTransactions.amount}
                    ELSE 0
                END
            ), 0)`,
        })
        .from(financialTransactions)
        .innerJoin(orders, eq(financialTransactions.orderId, orders.id))
        .innerJoin(services, eq(orders.serviceId, services.id))
        .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
        .where(/* worker + month start/end + createdAt < settlementDate + categoryName */);
}
```

```ts
const metadata = JSON.stringify({
    commissionRate: commissionSnapshot.commissionRate,
    settlementAmount: commissionSnapshot.settlementAmount,
    originalOrderPrice: commissionSnapshot.originalOrderPrice,
    commissionAmount: commissionSnapshot.commissionAmount,
    commissionRuleType: commissionSnapshot.ruleType,
    commissionThreshold: commissionSnapshot.commissionThreshold,
    commissionStrategyVersionId: commissionSnapshot.commissionStrategyVersionId,
    monthlyIncomeSnapshot: commissionSnapshot.monthlyIncomeSnapshot,
});
```

Update `extractServiceEarningSnapshot` in `pay.repository.ts` to parse the new metadata keys.

- [ ] **Step 4: 跑收益相关单测**

Run: `pnpm --filter backend test -- src/modules/pay/worker-category-commission.service.spec.ts --runInBand`

Expected: PASS。

## Task 5: 接入管理端数据层与 SSR 页面(已完成)

**Files:**

- Create: `packages/hooks/src/api/ssr/admin-service-category-commission-strategy.ts`
- Modify: `packages/hooks/src/api/ssr/index.ts`
- Modify: `apps/admin-web/src/lib/prefetchers.ts`
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/page.tsx`
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-page-section.tsx`

- [ ] **Step 1: 先写页面级接入的失败代码**

Create the route shell first:

```tsx
// page.tsx
import { HydrateClient } from "@/components/hydrate-client";
import { preloadServiceCategoryCommissionStrategyPageState } from "@/lib/prefetchers";
import { CommissionStrategyPageSection } from "./_components/commission-strategy-page-section";

export default async function CommissionStrategyPage({
    params,
}: {
    params: Promise<{ categoryId: string }>;
}) {
    const { categoryId } = await params;
    const dehydratedState =
        await preloadServiceCategoryCommissionStrategyPageState(categoryId);

    return (
        <HydrateClient state={dehydratedState}>
            <CommissionStrategyPageSection categoryId={categoryId} />
        </HydrateClient>
    );
}
```

- [ ] **Step 2: 运行管理端 type-check，确认 hook / prefetcher 尚未提供**

Run: `pnpm --filter admin-web type-check`

Expected: FAIL，报错 `preloadServiceCategoryCommissionStrategyPageState`、`useAdminServiceCategoryCommissionStrategy` 等符号不存在。

- [ ] **Step 3: 增加 hooks 与 SSR 预取**

Implement hooks with the existing SSR hook pattern:

```ts
export const adminServiceCategoryCommissionStrategyQueryOptions = (
    categoryId: string,
) =>
    queryOptions<AdminCommissionStrategyDetail>({
        queryKey: ['admin-service-category-commission-strategy', categoryId],
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response =
                await apiClient.get<AdminCommissionStrategyDetail>(
                    `/admin/service-categories/${categoryId}/commission-strategy`,
                    { schema: AdminCommissionStrategyDetailSchema },
                );

            if (!response.data) {
                throw new Error('抽成策略数据为空');
            }

            return response.data;
        },
        meta: {
            errorMessage: '抽成策略获取失败',
        },
    });
```

```ts
export async function preloadServiceCategoryCommissionStrategyPageState(
    categoryId: string,
) {
    ensureSsrApiClient();
    return prefetchDehydratedState(async (queryClient) => {
        await queryClient.fetchQuery(
            adminServiceCategoryCommissionStrategyQueryOptions(categoryId),
        );
    });
}
```

- [ ] **Step 4: 再跑管理端 type-check**

Run: `pnpm --filter admin-web type-check`

Expected: PASS through the new hooks/prefetcher layer, even if page content is still empty.

## Task 6: 完成策略编辑页、试算面板与分类入口(已完成)

**Files:**

- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-page-content.tsx`
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-rule-table.tsx`
- Create: `apps/admin-web/src/app/(management)/service-categories/[categoryId]/commission-strategy/_components/commission-strategy-simulator.tsx`
- Modify: `apps/admin-web/src/app/(management)/service-categories/_components/service-categories-page-content.tsx`

- [ ] **Step 1: 先搭建失败的页面结构**

Start with a minimal content shell:

```tsx
export function CommissionStrategyPageContent({
    categoryId,
}: {
    categoryId: string;
}) {
    const { data } = useAdminServiceCategoryCommissionStrategy(categoryId);

    return (
        <div className="space-y-6">
            <PageHeader
                title="上门按摩抽成策略"
                description="维护草稿版本、发布上线并试算规则命中结果。"
                breadcrumbs={[
                    { label: "运营管理", href: "/service-categories" },
                    { label: "服务分类管理", href: "/service-categories" },
                    { label: "抽成策略" },
                ]}
            />
            <div>{data.currentPublishedVersion?.id}</div>
        </div>
    );
}
```

- [ ] **Step 2: 运行管理端 type-check，确认内容组件缺少子组件和 mutation 接口**

Run: `pnpm --filter admin-web type-check`

Expected: FAIL。

- [ ] **Step 3: 实现草稿编辑、规则列表和试算**

Fill in the page with `@tanstack/react-form` and split subcomponents:

```tsx
const form = useForm({
    defaultValues: {
        beginnerProtectionEnabled: draft.beginnerProtection.isEnabled,
        beginnerProtectionDays: String(draft.beginnerProtection.protectionDays),
        beginnerIncomeThreshold: String(
            draft.beginnerProtection.monthlyIncomeThreshold,
        ),
        beginnerCommissionRate: String(
            draft.beginnerProtection.fixedCommissionRate,
        ),
        rules: draft.rules.map((rule) => ({
            id: rule.id,
            threshold: String(rule.threshold),
            commissionRate: String(rule.commissionRate),
            isEnabled: rule.isEnabled,
            sortOrder: String(rule.sortOrder),
        })),
    },
    onSubmit: async ({ value }) => {
        await saveDraftMutation.mutateAsync({
            categoryId,
            payload: normalizeDraftPayload(value),
        });
        toast.success("草稿已保存");
    },
});
```

```tsx
<CommissionStrategyRuleTable
    rules={form.state.values.rules}
    onAddRule={() => form.pushFieldValue("rules", createEmptyRule())}
    onRemoveRule={(index) => form.removeFieldValue("rules", index)}
    onMoveUp={(index) => moveRule(form, index, index - 1)}
    onMoveDown={(index) => moveRule(form, index, index + 1)}
/>

<CommissionStrategySimulator
    categoryId={categoryId}
    onSimulate={simulateMutation.mutateAsync}
/>
```

- [ ] **Step 4: 在服务分类页给“上门按摩”分类增加入口**

Add a row-level action in `service-categories-page-content.tsx`:

```tsx
{category.name === "上门按摩" ? (
    <Button asChild variant="outline" size="sm">
        <Link href={`/service-categories/${category.id}/commission-strategy`}>
            抽成策略
        </Link>
    </Button>
) : null}
```

- [ ] **Step 5: 跑管理端校验**

Run: `pnpm --filter admin-web type-check`

Expected: PASS。

Run: `pnpm lint`

Expected: PASS 或仅剩与本任务无关的历史问题。

## Task 7: 全链路验证与回归检查(已完成)

**Files:**

- Modify: `apps/backend/src/modules/admin/admin-service-category-commission-strategy.service.spec.ts`
- Modify: `apps/backend/src/modules/pay/worker-category-commission.service.spec.ts`
- Review: `docs/tasks/on-site-massage-dynamic-commission-design.md`
- Review: `docs/superpowers/plans/2026-04-03-on-site-massage-commission-strategy.md`

- [ ] **Step 1: 跑后端关键单测**

Run:

```bash
pnpm --filter backend test -- src/modules/admin/admin-service-category-commission-strategy.service.spec.ts --runInBand
pnpm --filter backend test -- src/modules/pay/worker-category-commission.service.spec.ts --runInBand
```

Expected: PASS。

- [ ] **Step 2: 跑类型检查**

Run:

```bash
pnpm --filter backend type-check
pnpm --filter admin-web type-check
```

Expected: PASS。

- [ ] **Step 3: 做手动验收清单**

Verify the following manually:

```md
- 仅“上门按摩”分类展示“抽成策略”入口。
- 草稿修改后未发布时，结算仍读取旧的已发布版本。
- 发布后新结算订单命中新版本，历史收益记录不变。
- 保护期内且月收入 `<=` 门槛时命中固定保护比例。
- 保护期内且月收入 `>` 门槛时命中动态阶梯规则。
- 非上门按摩分类订单继续使用原 `commission_rate`。
- 退款记入退款发生当月，并影响该月后续订单档位。
- 规则全禁用或删空时，系统回退固定抽成。
```

- [ ] **Step 4: 做计划自检**

Check before implementation handoff:

```md
- 数据模型覆盖了策略、版本、规则、审计四个对象。
- 后端接口覆盖了详情、保存草稿、发布、试算四条主路径。
- PayService 不再直接写死“按分类固定抽成”。
- 收益快照包含 ruleType / threshold / strategyVersionId / monthlyIncomeSnapshot。
- 管理端遵守 SSR 预取约定：ensureSsrApiClient + prefetchDehydratedState + HydrateClient。
```

## Self-Review

- **Spec coverage:** 设计稿里的范围限制、保护期、`>=` 阶梯、`<=` 保护期门槛、退款发生月冲减、历史快照锁定、版本发布、试算能力、异常回退都已映射到 Task 1-7。
- **Placeholder scan:** 计划中未保留 `TODO` / `TBD` / “后续补充” 类型占位。
- **Type consistency:** 文档统一使用 `AdminCommissionStrategy*` 作为后台类型前缀，结算快照统一使用 `commissionRuleType`、`commissionThreshold`、`commissionStrategyVersionId`、`monthlyIncomeSnapshot`。

Plan complete and saved to `docs/superpowers/plans/2026-04-03-on-site-massage-commission-strategy.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
