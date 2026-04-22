# Service Personnel Qualification Certificates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为服务人员端补齐按摩服务资质证书上传与校验，并让用户端资质页改为展示后端结构化返回的脱敏身份证号、商家资质和从业资格证书。

**Architecture:** 这次改动沿用现有 `workSkill/offerings` 保存链路，不新增证书专用接口。共享常量、协议、数据库字段先收敛，再在后端分别补齐“保存时校验”和“展示时聚合”两条链路，最后接上 `mobile-worker` 的上传 UI 与 `mobile-user` 的结构化展示。身份证脱敏规则从实名认证模块抽成复用工具，避免两处各写一份 `3 + * + 4` 逻辑。

**Tech Stack:** NestJS 11、Drizzle ORM、Jest、Expo Router、React Native、React Query、Zod v4、TypeScript

---

## File Map

- Create: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`
  责任：为按摩分类证书必填规则建立后端单测。
- Create: `apps/backend/src/modules/user-auth-real-name/mask-id-card-number.ts`
  责任：复用实名认证 `3 + * + 4` 身份证掩码规则。
- Create: `apps/backend/drizzle/0069_add_service_personnel_qualification_fields.sql`
  责任：新增服务人员两类证书文件字段的 SQL 迁移。
- Modify: `apps/backend/drizzle/meta/0069_snapshot.json`
  责任：同步 Drizzle schema 快照。
- Modify: `apps/backend/drizzle/meta/_journal.json`
  责任：登记本次迁移元信息。
- Modify: `apps/backend/src/common/database/schema/shops-service.ts`
  责任：在 `service_personnel` schema 上新增证书字段。
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`
  责任：让 `PUT /workSkill/offerings` 透传完整 payload。
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
  责任：增加按摩分类证书校验，协调 repository 写入。
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
  责任：查询服务分类、保存证书 file id、回填 `categoryId/categoryName`。
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.repository.ts`
  责任：聚合手机号与身份证号。
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.ts`
  责任：构造 `maskedIdCardNumber`、结构化证书字段与兼容 `qualificationImages`。
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts`
  责任：为聚合资料返回新增结构化证书与身份证脱敏测试。
- Modify: `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts`
  责任：改为复用提取出的掩码工具。
- Modify: `packages/types/src/massage.ts`
  责任：暴露共享常量 `MASSAGE_CATEGORY_ID`。
- Modify: `packages/types/src/work-skill.ts`
  责任：扩展服务设置请求、服务聚合资料和服务条目的 schema。
- Modify: `apps/mobile-user/components/massage/route.ts`
  责任：改为从共享类型导入 `MASSAGE_CATEGORY_ID`。
- Modify: `apps/mobile-user/lib/category-filter-route.test.ts`
  责任：断言共享按摩分类常量仍驱动路由参数。
- Modify: `apps/mobile-worker/app/profile/service-settings.tsx`
  责任：新增证书上传区、回显、按摩分类校验和保存 payload。
- Modify: `apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx`
  责任：改为读取结构化证书字段和接口返回的脱敏身份证号。

### Task 1: 锁定共享常量、协议和数据库字段

**Files:**
- Modify: `packages/types/src/massage.ts`
- Modify: `apps/mobile-user/components/massage/route.ts`
- Modify: `apps/mobile-user/lib/category-filter-route.test.ts`
- Modify: `packages/types/src/work-skill.ts`
- Modify: `apps/backend/src/common/database/schema/shops-service.ts`
- Create: `apps/backend/drizzle/0069_add_service_personnel_qualification_fields.sql`
- Modify: `apps/backend/drizzle/meta/0069_snapshot.json`
- Modify: `apps/backend/drizzle/meta/_journal.json`

- [ ] **Step 1: 在共享类型层补上按摩分类常量并替换用户端本地魔法值**

在 `packages/types/src/massage.ts` 顶部加入：

```ts
export const MASSAGE_CATEGORY_ID = "wgla64hwo7zr9iz";
```

把 `apps/mobile-user/components/massage/route.ts` 改成：

```ts
import type { ServiceTagDomain } from "@repo/types";
import { MASSAGE_CATEGORY_ID } from "@repo/types";
import { CATEGORY_FILTER_ROUTE_TYPE } from "@/lib/category-filter-route";

export function createMassageTagFilterRouteParams(input: {
    tagId: string;
    tagName: string;
    tagDomain: ServiceTagDomain;
}) {
    return {
        type: CATEGORY_FILTER_ROUTE_TYPE.tag,
        categoryId: MASSAGE_CATEGORY_ID,
        categoryName: "上门按摩",
        serviceTagId: input.tagId,
        serviceTagName: input.tagName,
        serviceTagDomain: input.tagDomain,
    };
}
```

并把 `apps/mobile-user/lib/category-filter-route.test.ts` 中的硬编码 `"wgla64hwo7zr9iz"` 改成从 `@repo/types` 导入的 `MASSAGE_CATEGORY_ID`。

- [ ] **Step 2: 扩展 `UpdateServiceOfferingsRequest`、`ServicePersonnelOffering` 和 `ServicePersonnelProfile`**

在 `packages/types/src/work-skill.ts` 中把 `UpdateServiceOfferingsRequestSchema` 改成：

```ts
export const UpdateServiceOfferingsRequestSchema = z
    .object({
        services: z
            .array(
                z.object({
                    serviceId: z.string().min(1, "服务ID不能为空"),
                    description: z.string().max(2000, "描述过长").optional().nullable(),
                    galleryFileIds: z
                        .array(z.string().min(1, "文件ID不能为空").trim())
                        .max(5, "宣传图片最多 5 张")
                        .default([])
                        .transform((ids) => Array.from(new Set(ids))),
                    specifications: z
                        .array(ServiceOfferingSpecificationInputSchema)
                        .min(1, "至少需要保留一条服务规格"),
                }),
            )
            .min(1, "请至少选择一个服务分类"),
        merchantQualificationFileId: z.string().trim().max(255).nullable().optional(),
        vocationalQualificationFileId: z.string().trim().max(255).nullable().optional(),
    })
    .meta({
        title: "更新服务人员提供的服务",
        description: "批量配置服务分类、描述、规格与按摩资质证书",
    });
```

把 `ServicePersonnelOfferingSchema` 扩展为：

```ts
export const ServicePersonnelOfferingSchema = z.object({
    serviceId: z.string().min(1, "服务ID不能为空"),
    serviceName: z.string().min(1, "服务名称不能为空"),
    categoryId: z.string().nullable().optional(),
    categoryName: z.string().nullable().optional(),
    serviceDescription: z.string().nullable(),
    personnelDescription: z.string().nullable(),
    currency: z.string().min(1, "币种不能为空"),
    isActive: z.boolean(),
    galleryFileIds: z.array(z.string()).default([]),
    gallery: z.array(FileAccessInfoSchema).default([]),
    specifications: z.array(specificationSchema).default([]),
    pricing: PersonnelPricingInfoSchema.nullable().optional(),
});
```

把 `ServicePersonnelProfileSchema` 扩展为：

```ts
export const ServicePersonnelProfileSchema = z.object({
    userId: z.string().min(1, "服务人员ID不能为空"),
    name: z.string().nullable().describe("昵称或实名"),
    bio: z.string().nullable(),
    province: z.string().min(1, "省份不能为空"),
    district: z.string().nullable(),
    county: z.string().nullable(),
    detailedAddress: z.string().nullable(),
    yearsOfExperience: z.number().int().nonnegative(),
    workStartTime: z.string().min(1, "工作开始时间不能为空"),
    workEndTime: z.string().min(1, "工作结束时间不能为空"),
    workDays: z.string().min(1, "工作日不能为空"),
    isAvailable: z.boolean(),
    currentStatus: z.string().min(1, "当前状态不能为空"),
    lastActiveAt: z.date(),
    maskedPhoneNumber: z.string().nullable(),
    maskedIdCardNumber: z.string().nullable(),
    avatar: FileAccessInfoSchema.nullable(),
    services: z.array(ServicePersonnelOfferingSchema),
    merchantQualificationImage: FileAccessInfoSchema.nullable(),
    vocationalQualificationImage: FileAccessInfoSchema.nullable(),
    qualificationImages: z.array(FileAccessInfoSchema).default([]),
    location: z.object({ lng: z.number(), lat: z.number() }).nullable(),
});
```

- [ ] **Step 3: 在 `service_personnel` schema 中新增两个证书字段**

修改 `apps/backend/src/common/database/schema/shops-service.ts` 中的 `servicePersonnel`：

```ts
export const servicePersonnel = pgTable(
    'service_personnel',
    {
        userId: varchar('user_id', { length: 255 })
            .primaryKey()
            .unique()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 50 }),
        avatar: varchar('avatar', { length: 255 }),
        merchantQualificationFileId: varchar('merchant_qualification_file_id', { length: 255 }),
        vocationalQualificationFileId: varchar('vocational_qualification_file_id', { length: 255 }),
        bio: text('bio'),
        province: varchar('province', { length: 100 }).notNull(),
        district: varchar('district', { length: 100 }),
        county: varchar('county', { length: 100 }),
        detailedAddress: varchar('detailed_address', { length: 255 }),
        geom: geometry('geom', { type: 'point', mode: 'tuple', srid: 4326 }).notNull(),
        yearsOfExperience: integer('years_of_experience').default(0).notNull(),
        workStartTime: time('work_start_time').notNull(),
        workEndTime: time('work_end_time').notNull(),
        isAvailable: boolean('is_available').default(true).notNull(),
        workDays: varchar('work_days', { length: 7 }).default('1234567').notNull(),
        currentStatus: varchar('current_status', { length: 20 }).default('available').notNull(),
        lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
    },
    // 保持原索引定义不变
);
```

- [ ] **Step 4: 生成并核对迁移文件**

Run: `pnpm --filter backend db:generate`

Expected:

- 生成 `apps/backend/drizzle/0069_add_service_personnel_qualification_fields.sql`
- 更新 `apps/backend/drizzle/meta/0069_snapshot.json`
- 更新 `apps/backend/drizzle/meta/_journal.json`

迁移 SQL 至少应包含：

```sql
ALTER TABLE "service_personnel"
ADD COLUMN "merchant_qualification_file_id" varchar(255),
ADD COLUMN "vocational_qualification_file_id" varchar(255);
```

- [ ] **Step 5: 运行后端类型检查，确认协议和 schema 扩展没有基础编译错误**

Run: `pnpm --filter backend type-check`

Expected:

- 通过 TypeScript 检查
- 不出现 `UpdateServiceOfferingsRequest`、`ServicePersonnelProfile` 或 `MASSAGE_CATEGORY_ID` 的导入错误

- [ ] **Step 6: 提交协议与 schema 基线**

```bash
git add packages/types/src/massage.ts packages/types/src/work-skill.ts apps/mobile-user/components/massage/route.ts apps/mobile-user/lib/category-filter-route.test.ts apps/backend/src/common/database/schema/shops-service.ts apps/backend/drizzle/0069_add_service_personnel_qualification_fields.sql apps/backend/drizzle/meta/0069_snapshot.json apps/backend/drizzle/meta/_journal.json
git commit -m "feat(shared): add qualification certificate contracts"
```

### Task 2: 用 TDD 补齐服务设置保存时的按摩证书校验

**Files:**
- Create: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.controller.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.service.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`

- [ ] **Step 1: 先写 `WorkSkillService.updateServiceOfferings` 的失败测试**

在 `apps/backend/src/modules/work-skill/work-skill.service.spec.ts` 写入：

```ts
import { BadRequestException } from '@nestjs/common';
import { MASSAGE_CATEGORY_ID } from '@repo/types';
import { WorkSkillService } from './work-skill.service';
import type { WorkSkillRepository } from './work-skill.repository';

type MockWorkSkillRepository = jest.Mocked<
    Pick<WorkSkillRepository, 'findServicesByIds' | 'updateServiceOfferings'>
>;

describe('WorkSkillService.updateServiceOfferings', () => {
    let service: WorkSkillService;
    let repository: MockWorkSkillRepository;

    beforeEach(() => {
        repository = {
            findServicesByIds: jest.fn(),
            updateServiceOfferings: jest.fn(),
        };

        service = new WorkSkillService(
            repository as unknown as WorkSkillRepository,
        );
    });

    it('命中按摩分类且两类证书都为空时抛出 BadRequestException', async () => {
        repository.findServicesByIds.mockResolvedValue([
            { id: 'svc_massage_1', categoryId: MASSAGE_CATEGORY_ID },
        ] as any);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
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
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('命中按摩分类且商家资质存在时允许保存', async () => {
        repository.findServicesByIds.mockResolvedValue([
            { id: 'svc_massage_1', categoryId: MASSAGE_CATEGORY_ID },
        ] as any);
        repository.updateServiceOfferings.mockResolvedValue(undefined);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
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
                merchantQualificationFileId: 'file_merchant',
                vocationalQualificationFileId: null,
            }),
        ).resolves.toBeUndefined();
    });

    it('未命中按摩分类时不要求证书', async () => {
        repository.findServicesByIds.mockResolvedValue([
            { id: 'svc_clean_1', categoryId: 'cat_cleaning' },
        ] as any);
        repository.updateServiceOfferings.mockResolvedValue(undefined);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_clean_1',
                        description: null,
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
            }),
        ).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: 运行测试，确认它先红灯**

Run: `pnpm --filter backend test -- --runInBand src/modules/work-skill/work-skill.service.spec.ts`

Expected:

- FAIL
- 原因是 `updateServiceOfferings` 仍只接收 `services`，且还没有按摩分类证书校验

- [ ] **Step 3: 改 controller 和 service，让完整 payload 进入业务层**

把 `apps/backend/src/modules/work-skill/work-skill.controller.ts` 改为：

```ts
async updateServiceOfferings(
    @Body() payload: UpdateServiceOfferingsRequest,
    @Req() req: Request,
) {
    await this.workSkillService.updateServiceOfferings(req.user.id, payload);
    return { success: true };
}
```

把 `apps/backend/src/modules/work-skill/work-skill.service.ts` 改为：

```ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MASSAGE_CATEGORY_ID, type UpdateServiceOfferingsRequest } from '@repo/types';

@Injectable()
export class WorkSkillService {
    @Inject(WorkSkillRepository)
    private readonly workSkillRepository: WorkSkillRepository;

    async updateServiceOfferings(
        personnelId: string,
        payload: UpdateServiceOfferingsRequest,
    ) {
        const serviceIds = payload.services.map((service) => service.serviceId);
        const boundServices = await this.workSkillRepository.findServicesByIds(serviceIds);
        const requiresCertificates = boundServices.some(
            (service) => service.categoryId === MASSAGE_CATEGORY_ID,
        );

        if (
            requiresCertificates &&
            !payload.merchantQualificationFileId &&
            !payload.vocationalQualificationFileId
        ) {
            throw new BadRequestException('上门按摩服务需至少上传一种资质证书');
        }

        await this.workSkillRepository.updateServiceOfferings(personnelId, payload);
    }
}
```

- [ ] **Step 4: 在 repository 中补齐服务分类查询和证书写入**

在 `apps/backend/src/modules/work-skill/work-skill.repository.ts` 中新增：

```ts
async findServicesByIds(serviceIds: string[]) {
    if (!serviceIds.length) {
        return [];
    }

    return await this.db
        .select({
            id: services.id,
            categoryId: services.categoryId,
        })
        .from(services)
        .where(inArray(services.id, serviceIds));
}
```

并把 `updateServiceOfferings` 签名改为：

```ts
async updateServiceOfferings(
    personnelId: string,
    payload: UpdateServiceOfferingsRequest,
) {
    const { services: inputServices, merchantQualificationFileId, vocationalQualificationFileId } = payload;
    // 原有 normalizedServices / skill / pricing 逻辑保留
    await this.db.transaction(async (tx) => {
        // 原有技能和规格逻辑

        await tx
            .update(servicePersonnel)
            .set({
                merchantQualificationFileId: merchantQualificationFileId?.trim() || null,
                vocationalQualificationFileId: vocationalQualificationFileId?.trim() || null,
            })
            .where(eq(servicePersonnel.userId, personnelId));
    });
}
```

- [ ] **Step 5: 重新运行测试，确认后端校验已转绿**

Run: `pnpm --filter backend test -- --runInBand src/modules/work-skill/work-skill.service.spec.ts`

Expected:

- PASS
- 三个核心场景全部通过

- [ ] **Step 6: 再跑一次后端类型检查**

Run: `pnpm --filter backend type-check`

Expected:

- `work-skill.controller.ts`
- `work-skill.service.ts`
- `work-skill.repository.ts`

全部通过编译

- [ ] **Step 7: 提交保存链路改动**

```bash
git add apps/backend/src/modules/work-skill/work-skill.service.spec.ts apps/backend/src/modules/work-skill/work-skill.controller.ts apps/backend/src/modules/work-skill/work-skill.service.ts apps/backend/src/modules/work-skill/work-skill.repository.ts
git commit -m "feat(backend): validate massage certificates on offerings save"
```

### Task 3: 用 TDD 补齐聚合资料中的脱敏身份证号和结构化证书返回

**Files:**
- Create: `apps/backend/src/modules/user-auth-real-name/mask-id-card-number.ts`
- Modify: `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts`
- Modify: `apps/backend/src/modules/work-skill/work-skill.repository.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.repository.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.ts`
- Modify: `apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts`

- [ ] **Step 1: 先给 `getPersonnelProfile` 写失败测试**

在 `apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts` 追加：

```ts
describe('ServicePersonnelService.getPersonnelProfile', () => {
    let service: ServicePersonnelService;
    let repository: jest.Mocked<Pick<ServicePersonnelRepository, 'getPersonnelContactInfo'>>;
    let workSkillService: jest.Mocked<Pick<WorkSkillService, 'getPersonnelInfo'>>;
    let filesService: jest.Mocked<Pick<FilesService, 'getFileAccessInfo'>>;

    beforeEach(() => {
        repository = {
            getPersonnelContactInfo: jest.fn(),
        };
        workSkillService = {
            getPersonnelInfo: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
        };

        service = new ServicePersonnelService(
            repository as unknown as ServicePersonnelRepository,
            workSkillService as unknown as WorkSkillService,
            filesService as unknown as FilesService,
            {} as OrderRepository,
            {} as PayService,
            {} as ReviewService,
        );
    });

    it('返回脱敏身份证号和结构化证书字段，并回填 qualificationImages', async () => {
        workSkillService.getPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            name: '李师傅',
            avatar: null,
            bio: null,
            province: '湖北省',
            district: '黄冈市',
            county: null,
            detailedAddress: '测试路 1 号',
            geom: [114.87, 30.45],
            yearsOfExperience: 5,
            workStartTime: '09:00:00',
            workEndTime: '18:00:00',
            workDays: '1234567',
            isAvailable: true,
            currentStatus: 'available',
            lastActiveAt: new Date('2026-04-22T08:00:00.000Z'),
            merchantQualificationFileId: 'file_merchant',
            vocationalQualificationFileId: 'file_vocational',
            skills: [
                {
                    id: 'svc_massage_1',
                    name: '上门按摩',
                    categoryId: 'wgla64hwo7zr9iz',
                    categoryName: '上门按摩',
                    description: '服务描述',
                    personnelDescription: '个人描述',
                    currency: 'CNY',
                    isActive: true,
                    galleryFileIds: [],
                    specifications: [],
                },
            ],
        } as any);

        repository.getPersonnelContactInfo.mockResolvedValue({
            phoneNumber: '13812345678',
            idCardNumber: '420106199901011234',
        } as any);

        filesService.getFileAccessInfo
            .mockResolvedValueOnce({
                fileUrl: 'https://example.com/merchant.jpg',
                fileName: 'merchant.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1,
                expiresIn: 3600,
                blurhash: 'merchant',
            } as any)
            .mockResolvedValueOnce({
                fileUrl: 'https://example.com/vocational.jpg',
                fileName: 'vocational.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1,
                expiresIn: 3600,
                blurhash: 'vocational',
            } as any);

        const result = await service.getPersonnelProfile('worker_1');

        expect(result.maskedIdCardNumber).toBe('420***********1234');
        expect(result.merchantQualificationImage?.url).toBe('https://example.com/merchant.jpg');
        expect(result.vocationalQualificationImage?.url).toBe('https://example.com/vocational.jpg');
        expect(result.qualificationImages).toHaveLength(2);
        expect(result.services[0]).toMatchObject({
            categoryId: 'wgla64hwo7zr9iz',
            categoryName: '上门按摩',
        });
    });
});
```

- [ ] **Step 2: 运行测试，确认当前返回结构不足以通过**

Run: `pnpm --filter backend test -- --runInBand src/modules/service-personnel/service-personnel.service.spec.ts`

Expected:

- FAIL
- 原因是 `maskedIdCardNumber`、结构化证书字段和 `categoryName` 还不存在

- [ ] **Step 3: 抽出身份证掩码工具并让实名认证控制器复用**

新增 `apps/backend/src/modules/user-auth-real-name/mask-id-card-number.ts`：

```ts
export function maskIdCardNumber(idCard?: string | null) {
    if (!idCard) {
        return idCard;
    }

    const normalized = idCard.trim();
    if (normalized.length <= 8) {
        if (normalized.length <= 2) {
            return `${normalized[0] ?? ''}${'*'.repeat(Math.max(normalized.length - 1, 0))}`;
        }
        return `${normalized.slice(0, 1)}${'*'.repeat(normalized.length - 2)}${normalized.slice(-1)}`;
    }

    const prefix = normalized.slice(0, 3);
    const suffix = normalized.slice(-4);
    return `${prefix}${'*'.repeat(normalized.length - 7)}${suffix}`;
}
```

然后把 `apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts` 中的本地函数删除，改为：

```ts
import { maskIdCardNumber } from './mask-id-card-number';
```

- [ ] **Step 4: 让 `getPersonnelInfo` 和 `getPersonnelContactInfo` 带回展示所需的分类和实名信息**

把 `apps/backend/src/modules/work-skill/work-skill.repository.ts` 的技能查询改成：

```ts
const result = await this.db.query.servicePersonnel.findFirst({
    where: (servicePersonnel, { eq }) => eq(servicePersonnel.userId, personnelId),
    with: {
        skills: {
            with: {
                service: {
                    with: {
                        category: true,
                    },
                },
            },
            where: (servicePersonnelSkills, { eq, and }) => {
                if (serviceId) {
                    return and(eq(servicePersonnelSkills.serviceId, serviceId));
                }
            },
        },
        pricing: true,
    },
});
```

并在 `skillsWithPrice` 映射中补上：

```ts
return {
    ...skill.service,
    categoryId: skill.service.categoryId,
    categoryName: skill.service.category?.name ?? null,
    specifications,
    galleryFileIds: skill.galleryFileIds ?? [],
    personnelDescription: skill.description ?? null,
};
```

把 `apps/backend/src/modules/service-personnel/service-personnel.repository.ts` 的 `getPersonnelContactInfo` 改成 join `userProfiles`：

```ts
import { and, eq } from 'drizzle-orm';
import { userProfiles, users } from 'src/common/database/schema';

async getPersonnelContactInfo(personnelId: string) {
    const rows = await this.db
        .select({
            phoneNumber: users.phoneNumber,
            idCardNumber: userProfiles.idCardNumber,
        })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, personnelId))
        .limit(1);

    return rows[0] ?? null;
}
```

- [ ] **Step 5: 改 `ServicePersonnelService.getPersonnelProfile` 组装结构化返回**

把 `apps/backend/src/modules/service-personnel/service-personnel.service.ts` 改为：

```ts
import { maskIdCardNumber } from '../user-auth-real-name/mask-id-card-number';

type RawPersonnelSkill = {
    id: string;
    name: string;
    categoryId?: string | null;
    categoryName?: string | null;
    description?: string | null;
    currency?: string | null;
    isActive: boolean;
    personnelDescription?: string | null;
    galleryFileIds?: string[] | null;
    specifications: Array<{
        id: string;
        userId: string;
        serviceId: string;
        name?: string | null;
        price: string;
        currency: string;
        isActive: boolean;
        effectiveFrom?: Date | null;
        effectiveTo?: Date | null;
        estimatedDurationMinutes?: number | null;
    }>;
};

async getPersonnelProfile(personnelId: string): Promise<ServicePersonnelProfile> {
    const personnel = await this.workSkillService.getPersonnelInfo(personnelId);
    if (!personnel) {
        throw new NotFoundException('服务人员不存在');
    }

    const userInfo = await this.servicePersonnelRepository.getPersonnelContactInfo(personnelId);
    if (!userInfo) {
        throw new NotFoundException('服务人员不存在');
    }

    const avatarHash = personnel.avatar?.trim();
    const avatar = avatarHash ? await this.getFileAccessInfoSafely(avatarHash) : null;

    const merchantQualificationImage = personnel.merchantQualificationFileId
        ? await this.getFileAccessInfoSafely(personnel.merchantQualificationFileId)
        : null;
    const vocationalQualificationImage = personnel.vocationalQualificationFileId
        ? await this.getFileAccessInfoSafely(personnel.vocationalQualificationFileId)
        : null;

    const qualificationImages = [
        merchantQualificationImage,
        vocationalQualificationImage,
    ].filter((item): item is FileAccessInfo => Boolean(item));

    const services = await Promise.all(
        (personnel.skills ?? []).map(async (skill: RawPersonnelSkill) => {
            const specs = (skill.specifications ?? []).map((spec) => ({
                id: spec.id,
                userId: spec.userId,
                serviceId: spec.serviceId,
                price: spec.price,
                currency: spec.currency,
                name: spec.name ?? undefined,
                estimatedDurationMinutes: spec.estimatedDurationMinutes ?? undefined,
            }));
            const galleryFileIds = skill.galleryFileIds ?? [];
            const gallery = await this.buildFileAccessList(galleryFileIds);

            return {
                serviceId: skill.id,
                serviceName: skill.name,
                categoryId: skill.categoryId ?? null,
                categoryName: skill.categoryName ?? null,
                serviceDescription: skill.description ?? null,
                personnelDescription: skill.personnelDescription ?? null,
                currency: skill.currency || specs.find((spec) => spec.currency)?.currency || 'CNY',
                isActive: skill.isActive,
                galleryFileIds,
                gallery,
                specifications: specs,
            };
        }),
    );

    return {
        userId: personnel.userId,
        name: personnel.name?.trim() || null,
        bio: personnel.bio ?? null,
        province: personnel.province,
        district: personnel.district ?? null,
        county: personnel.county ?? null,
        detailedAddress: personnel.detailedAddress ?? null,
        yearsOfExperience: personnel.yearsOfExperience ?? 0,
        workStartTime: personnel.workStartTime,
        workEndTime: personnel.workEndTime,
        workDays: personnel.workDays,
        isAvailable: personnel.isAvailable,
        currentStatus: personnel.currentStatus,
        lastActiveAt: personnel.lastActiveAt,
        maskedPhoneNumber: this.maskPhoneNumber(userInfo.phoneNumber),
        maskedIdCardNumber: maskIdCardNumber(userInfo.idCardNumber),
        avatar,
        services,
        merchantQualificationImage,
        vocationalQualificationImage,
        qualificationImages,
        location,
    };
}
```

- [ ] **Step 6: 重新运行聚合资料测试**

Run: `pnpm --filter backend test -- --runInBand src/modules/service-personnel/service-personnel.service.spec.ts`

Expected:

- PASS
- 现有 `searchPersonnelByServiceIds` 用例仍通过
- 新增 `getPersonnelProfile` 用例通过

- [ ] **Step 7: 再跑一次后端类型检查并提交**

Run: `pnpm --filter backend type-check`

Expected:

- `service-personnel.service.ts`
- `service-personnel.repository.ts`
- `user-auth-real-name.controller.ts`

编译通过

```bash
git add apps/backend/src/modules/user-auth-real-name/mask-id-card-number.ts apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts apps/backend/src/modules/work-skill/work-skill.repository.ts apps/backend/src/modules/service-personnel/service-personnel.repository.ts apps/backend/src/modules/service-personnel/service-personnel.service.ts apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts
git commit -m "feat(backend): expose structured qualification profile"
```

### Task 4: 在服务人员端接入证书上传、回显和前端校验

**Files:**
- Modify: `apps/mobile-worker/app/profile/service-settings.tsx`

- [ ] **Step 1: 扩展页面状态，让服务回显和证书状态可持久化**

把文件顶部类型改成：

```ts
import { MASSAGE_CATEGORY_ID, type FileDownloadUrlResponse, type ServiceListResponse } from "@repo/types";

type EditableCertificate = {
    id: string;
    url: string;
};

type EditableService = {
    serviceId: string;
    categoryId?: string;
    name: string;
    categoryName?: string;
    description: string;
    specs: EditableSpecification[];
    gallery: EditableImage[];
};
```

新增状态：

```ts
const [merchantQualification, setMerchantQualification] = useState<EditableCertificate | null>(null);
const [vocationalQualification, setVocationalQualification] = useState<EditableCertificate | null>(null);
const [uploadingCertificateKey, setUploadingCertificateKey] = useState<"merchant" | "vocational" | null>(null);
```

在 `useEffect(() => { if (!profile) return; ... }, [profile])` 里补上：

```ts
setMerchantQualification(
    profile.merchantQualificationImage
        ? {
              id: profile.merchantQualificationImage.fileId,
              url: profile.merchantQualificationImage.url,
          }
        : null,
);

setVocationalQualification(
    profile.vocationalQualificationImage
        ? {
              id: profile.vocationalQualificationImage.fileId,
              url: profile.vocationalQualificationImage.url,
          }
        : null,
);
```

并把 `selectedServices` 映射改成从 `profile.services` 读取 `categoryId/categoryName`。

- [ ] **Step 2: 新增证书上传 helper 和按摩分类检测**

在文件中补两个 helper：

```ts
const requiresMassageCertificates = useMemo(
    () => selectedServices.some((service) => service.categoryId === MASSAGE_CATEGORY_ID),
    [selectedServices],
);

const handleUploadCertificate = useCallback(
    async (kind: "merchant" | "vocational") => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("提示", "需要相册权限才能上传图片");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
        });

        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];

        setUploadingCertificateKey(kind);
        try {
            const response = await uploadFile.mutateAsync({
                file: {
                    uri: asset.uri,
                    name: asset.fileName ?? `${kind}_${Date.now()}.jpg`,
                    type: asset.mimeType ?? "image/jpeg",
                },
            });

            const accessibleUrl = await fetchFileUrl(response.id).catch(() => asset.uri);
            const nextValue = {
                id: response.id,
                url: accessibleUrl,
            };

            if (kind === "merchant") {
                setMerchantQualification(nextValue);
            } else {
                setVocationalQualification(nextValue);
            }
        } catch (error) {
            console.error("[ServiceSettings] 资质证书上传失败", error);
            Alert.alert("上传失败", "请稍后重试");
        } finally {
            setUploadingCertificateKey(null);
        }
    },
    [fetchFileUrl, uploadFile],
);

const handleRemoveCertificate = useCallback((kind: "merchant" | "vocational") => {
    if (kind === "merchant") {
        setMerchantQualification(null);
        return;
    }
    setVocationalQualification(null);
}, []);
```

- [ ] **Step 3: 在页面中插入证书 UI 并把保存校验接上**

在“已提供服务”卡片之后插入：

```tsx
{requiresMassageCertificates ? (
    <View style={styles.card}>
        <Text style={styles.sectionTitle}>资质证书</Text>
        <Text style={styles.helperText}>上门按摩服务需至少上传一种资质证书</Text>

        {[
            {
                key: "merchant" as const,
                title: "商家资质",
                value: merchantQualification,
            },
            {
                key: "vocational" as const,
                title: "从业资格证书",
                value: vocationalQualification,
            },
        ].map((item) => (
            <View key={item.key} style={styles.certificateBlock}>
                <Text style={styles.label}>{item.title}</Text>
                {item.value ? (
                    <View style={styles.certificatePreviewWrapper}>
                        <Image source={{ uri: item.value.url }} style={styles.certificatePreview} />
                        <View style={styles.certificateActionRow}>
                            <TouchableOpacity onPress={() => void handleUploadCertificate(item.key)}>
                                <Text style={styles.certificateActionText}>替换</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRemoveCertificate(item.key)}>
                                <Text style={[styles.certificateActionText, { color: "#ef4444" }]}>删除</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.galleryAddButton}
                        disabled={uploadingCertificateKey === item.key}
                        onPress={() => void handleUploadCertificate(item.key)}
                    >
                        {uploadingCertificateKey === item.key ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                            <>
                                <Ionicons name="add" size={20} color="#2563eb" />
                                <Text style={styles.galleryAddText}>上传</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        ))}
    </View>
) : null}
```

并把 `handleSave` 的校验补上：

```ts
if (
    requiresMassageCertificates &&
    !merchantQualification?.id &&
    !vocationalQualification?.id
) {
    Alert.alert("提示", "上门按摩服务需至少上传一种资质证书");
    return;
}
```

同时把 payload 改成：

```ts
const payload = {
    services: selectedServices.map((service) => ({
        serviceId: service.serviceId,
        description: service.description.trim() ? service.description.trim() : undefined,
        galleryFileIds: (service.gallery ?? []).map((item) => item.id),
        specifications: service.specs.map((spec) => ({
            id: spec.id,
            name: spec.name.trim(),
            price: spec.price.trim(),
            currency: spec.currency || "CNY",
            estimatedDurationMinutes: Number.parseInt(spec.duration, 10),
        })),
    })),
    merchantQualificationFileId: merchantQualification?.id ?? null,
    vocationalQualificationFileId: vocationalQualification?.id ?? null,
};
```

- [ ] **Step 4: 跑 `mobile-work` 类型检查**

Run: `pnpm --filter mobile-work type-check`

Expected:

- `service-settings.tsx` 无类型错误
- `MASSAGE_CATEGORY_ID`、新增 profile 字段、payload 字段全部解析成功

- [ ] **Step 5: 提交服务人员端页面改动**

```bash
git add apps/mobile-worker/app/profile/service-settings.tsx
git commit -m "feat(mobile-worker): add massage qualification uploads"
```

### Task 5: 改造用户端资质页为结构化展示

**Files:**
- Modify: `apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx`

- [ ] **Step 1: 删除关键词猜图逻辑，改成直接消费接口字段**

删除：

```ts
function matchesKeywords(...) { ... }
function selectCertificateImages(...) { ... }
```

改为：

```ts
type CertificateCardItem = {
    title: string;
    height: number;
    image: ServicePersonnelProfile["merchantQualificationImage"] | ServicePersonnelProfile["vocationalQualificationImage"];
};

function buildCertificateCards(profile: ServicePersonnelProfile): CertificateCardItem[] {
    return [
        {
            title: "所属商家资质",
            height: 224,
            image: profile.merchantQualificationImage,
        },
        {
            title: "从业资格证书",
            height: 212,
            image: profile.vocationalQualificationImage,
        },
    ];
}
```

把 `CertificatesContent` 里的 memo 改成：

```ts
const certificateCards = useMemo(
    () => (profileQuery.data ? buildCertificateCards(profileQuery.data) : []),
    [profileQuery.data],
);
```

- [ ] **Step 2: 让身份证展示来自真实接口返回，而不是写死占位**

把 `INFO_CARD_ITEMS` 的静态常量改成动态构造：

```ts
function buildInfoCardItems(profile: ServicePersonnelProfile): InfoCardItem[] {
    return [
        {
            badge: "已通过认证",
            title: "商家实名认证通过",
            subtitle: profile.maskedIdCardNumber
                ? `身份证 ${profile.maskedIdCardNumber}`
                : "身份证信息暂未完善",
            description: "所有理疗师签约入驻平台时，身份信息均已通过核验",
            icon: ShieldCheck,
        },
        {
            badge: "已通过认证",
            title: "该店铺已在平台完成市场主体登记认证",
            description: "根据相关法律法规要求，经营者相关资质信息公示如下",
            icon: Building2,
        },
    ];
}
```

并在 `CertificatesContent` 中改成：

```ts
const infoCards = useMemo(
    () => (profileQuery.data ? buildInfoCardItems(profileQuery.data) : []),
    [profileQuery.data],
);
```

渲染时使用：

```tsx
{infoCards.map((item) => (
    <InfoCard key={item.title} {...item} />
))}
```

- [ ] **Step 3: 跑 `mobile-user` 类型检查**

Run: `pnpm --filter mobile-user type-check`

Expected:

- `qualification-certificates.tsx` 无类型错误
- 不再引用已删除的关键词匹配 helper

- [ ] **Step 4: 提交用户端资质页改动**

```bash
git add apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx
git commit -m "feat(mobile-user): show structured qualification certificates"
```

### Task 6: 收尾验证与人工回归

**Files:**
- Verify: `packages/types/src/massage.ts`
- Verify: `packages/types/src/work-skill.ts`
- Verify: `apps/backend/src/common/database/schema/shops-service.ts`
- Verify: `apps/backend/src/modules/work-skill/work-skill.service.spec.ts`
- Verify: `apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts`
- Verify: `apps/mobile-worker/app/profile/service-settings.tsx`
- Verify: `apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx`

- [ ] **Step 1: 重新运行按摩证书后端单测**

Run: `pnpm --filter backend test -- --runInBand src/modules/work-skill/work-skill.service.spec.ts`

Expected:

- PASS
- 证书必填规则稳定通过

- [ ] **Step 2: 重新运行聚合资料单测**

Run: `pnpm --filter backend test -- --runInBand src/modules/service-personnel/service-personnel.service.spec.ts`

Expected:

- PASS
- 既有 `searchPersonnelByServiceIds` 用例和新增 `getPersonnelProfile` 用例都为绿灯

- [ ] **Step 3: 运行后端类型检查**

Run: `pnpm --filter backend type-check`

Expected:

- backend 全量 TypeScript 通过

- [ ] **Step 4: 运行 `mobile-work` 类型检查**

Run: `pnpm --filter mobile-work type-check`

Expected:

- `service-settings.tsx` 通过

- [ ] **Step 5: 运行 `mobile-user` 类型检查**

Run: `pnpm --filter mobile-user type-check`

Expected:

- `qualification-certificates.tsx` 通过

- [ ] **Step 6: 执行手工回归**

Run: `pnpm mobile-worker:dev`

Expected:

- 只选普通分类服务时，不上传证书也能保存
- 选中上门按摩服务时，不上传证书会被弹窗拦截
- 选中上门按摩服务时，只上传商家资质即可保存
- 选中上门按摩服务时，只上传从业资格证书即可保存
- 保存后重新进入服务设置页，两类证书可正确回显

Run: `pnpm mobile-user:dev`

Expected:

- 进入用户端技师资质页后，身份证显示接口返回的脱敏值
- 商家资质卡片与从业资格证书卡片分别读取结构化字段
- 某一类证书为空时，只该卡片显示“暂无图片”

- [ ] **Step 7: 提交最终整合结果**

```bash
git add packages/types/src/massage.ts packages/types/src/work-skill.ts apps/mobile-user/components/massage/route.ts apps/mobile-user/lib/category-filter-route.test.ts apps/backend/src/common/database/schema/shops-service.ts apps/backend/drizzle/0069_add_service_personnel_qualification_fields.sql apps/backend/drizzle/meta/0069_snapshot.json apps/backend/drizzle/meta/_journal.json apps/backend/src/modules/work-skill/work-skill.service.spec.ts apps/backend/src/modules/work-skill/work-skill.controller.ts apps/backend/src/modules/work-skill/work-skill.service.ts apps/backend/src/modules/work-skill/work-skill.repository.ts apps/backend/src/modules/user-auth-real-name/mask-id-card-number.ts apps/backend/src/modules/user-auth-real-name/user-auth-real-name.controller.ts apps/backend/src/modules/service-personnel/service-personnel.repository.ts apps/backend/src/modules/service-personnel/service-personnel.service.ts apps/backend/src/modules/service-personnel/service-personnel.service.spec.ts apps/mobile-worker/app/profile/service-settings.tsx apps/mobile-user/app/servicePersonnel/qualification-certificates.tsx
git commit -m "feat(service-personnel): wire structured qualification certificates"
```
