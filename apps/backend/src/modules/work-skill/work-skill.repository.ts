import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { UpdateServiceOfferingsRequest } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import {
    servicePersonnel,
    servicePersonnelOfferingStatuses,
    servicePersonnelSkills,
    servicePersonnelPricing,
    servicePersonnelOfferingDrafts,
    serviceCategories,
    services,
    users,
} from 'src/common/database/schema';

export function resolveOfferingVisibilityState({
    draftStatus,
    statusReviewStatus,
    statusPublicationStatus,
}: {
    draftStatus?: 'pending' | 'approved' | 'rejected' | null;
    statusReviewStatus?: 'pending' | 'approved' | 'rejected' | null;
    statusPublicationStatus?: 'active' | 'taken_down' | null;
}) {
    return {
        reviewStatus: draftStatus ?? statusReviewStatus ?? 'pending',
        publicationStatus: statusPublicationStatus ?? 'taken_down',
    };
}

@Injectable()
export class WorkSkillRepository {
    @Inject(DB)
    private readonly db: DbType;

    /**
     * 设置或更新工作人员的工作信息
     *
     * 功能说明：
     * - 如果工作人员不存在，则创建新记录
     * - 如果工作人员已存在，则更新现有记录
     * - 使用upsert机制保证操作的幂等性
     *
     * @param info 工作人员信息，必须包含userId
     * @returns 返回创建或更新后的工作人员信息
     * @throws 参数无效时抛出异常
     */
    async upsertWorkInfo(
        info: Omit<typeof servicePersonnel.$inferInsert, 'geom'> & {
            location: { lng: number; lat: number };
        },
    ) {
        // 检查用户是否存在于users表中
        if (!(await this.isUserExists(info.userId))) {
            throw new BadRequestException('用户不存在，无法创建服务人员信息');
        }

        // 拆解 location，避免插入额外未知字段
        const { location, ...rest } = info;

        // 必填字段简单校验（Drizzle 在编译期已提示，但这里运行时加强提示）
        const required: Array<keyof typeof rest> = [
            'userId',
            'province',
            'workStartTime',
            'workEndTime',
        ];
        for (const key of required) {
            if (!(rest as any)[key]) {
                throw new BadRequestException(`缺少必要字段: ${key}`);
            }
        }

        // 构造插入数据，使用 Drizzle 推导的插入类型（具有默认值的字段可省略）
        const insertData: typeof servicePersonnel.$inferInsert = {
            ...rest,
            geom: [location.lng, location.lat], // geometry(point) tuple
        };

        const updatePayload: Partial<typeof servicePersonnel.$inferInsert> = {
            bio: rest.bio,
            province: rest.province,
            district: rest.district,
            county: rest.county,
            detailedAddress: rest.detailedAddress,
            yearsOfExperience: rest.yearsOfExperience,
            workStartTime: rest.workStartTime,
            workEndTime: rest.workEndTime,
            isAvailable: rest.isAvailable,
            currentStatus: rest.currentStatus,
            workDays: rest.workDays,
            geom: [location.lng, location.lat],
        };

        if (rest.name !== undefined) {
            updatePayload.name = rest.name;
        }

        if (rest.avatar !== undefined) {
            updatePayload.avatar = rest.avatar;
        }

        const result = await this.db
            .insert(servicePersonnel)
            .values(insertData)
            .onConflictDoUpdate({
                target: servicePersonnel.userId,
                set: updatePayload,
            })
            .returning();

        return result[0];
    }

    /**
     * 设置工作人员能够提供的服务技能
     *
     * 功能说明：
     * - 支持新增绑定：如果工作人员之前没有任何技能，会直接添加所有指定的服务技能
     * - 支持完整更新：会智能计算差异，只添加新技能，删除不再需要的技能
     * - 事务安全：所有操作都在数据库事务中进行，保证数据一致性
     *
     * @param serviceIds 服务ID数组，传入空数组将清除该工作人员的所有技能
     * @param personnelId 工作人员用户ID
     * @returns 返回操作统计信息：{added: 新增数量, removed: 删除数量}
     * @throws 参数无效时抛出异常
     */
    async updatePersonnelSkills(serviceIds: string[], personnelId: string) {
        // 检查服务人员是否存在
        if (!(await this.isServicePersonnelExists(personnelId))) {
            throw new BadRequestException('该服务人员不存在');
        }

        // 去重处理
        const uniqueServiceIds = [...new Set(serviceIds.filter(Boolean))];
        // 2. 在事务中操作
        return await this.db.transaction(async (tx) => {
            // 3. 获取现有技能
            const existing = await tx
                .select({ serviceId: servicePersonnelSkills.serviceId })
                .from(servicePersonnelSkills)
                .where(eq(servicePersonnelSkills.userId, personnelId));

            const existingIds = existing.map((e) => e.serviceId);

            // 4. 计算差异
            const toAdd = uniqueServiceIds.filter(
                (id) => !existingIds.includes(id),
            );
            const toRemove = existingIds.filter(
                (id) => !uniqueServiceIds.includes(id),
            );

            // 5. 执行变更
            if (toRemove.length > 0) {
                await tx
                    .delete(servicePersonnelSkills)
                    .where(
                        and(
                            eq(servicePersonnelSkills.userId, personnelId),
                            inArray(servicePersonnelSkills.serviceId, toRemove),
                        ),
                    );
            }

            if (toAdd.length > 0) {
                await tx.insert(servicePersonnelSkills).values(
                    toAdd.map((serviceId) => ({
                        serviceId,
                        userId: personnelId,
                    })),
                );
            }

            return { added: toAdd.length, removed: toRemove.length };
        });
    }

    /**
     * 获取工作人员的完整信息
     *
     * @param personnelId 工作人员用户ID
     * @returns 返回工作人员信息及其技能列表，不存在时返回null
     * @throws 参数无效时抛出异常
     */
    async getPersonnelInfo(personnelId: string, serviceId?: string) {
        // 参数验证
        if (!personnelId || typeof personnelId !== 'string') {
            throw new Error('工作人员ID不能为空');
        }
        return await this.getPersonnelInfoWithOfferingState(personnelId, {
            serviceId,
            publicOnly: false,
        });
    }

    async getPublishedPersonnelInfo(personnelId: string, serviceId?: string) {
        if (!personnelId || typeof personnelId !== 'string') {
            throw new Error('工作人员ID不能为空');
        }

        return await this.getPersonnelInfoWithOfferingState(personnelId, {
            serviceId,
            publicOnly: true,
        });
    }

    private async getPersonnelInfoWithOfferingState(
        personnelId: string,
        options: { serviceId?: string; publicOnly: boolean },
    ) {
        const result = await this.db.query.servicePersonnel.findFirst({
            where: (servicePersonnel, { eq }) =>
                eq(servicePersonnel.userId, personnelId),
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
                        if (options.serviceId) {
                            return and(
                                eq(
                                    servicePersonnelSkills.serviceId,
                                    options.serviceId,
                                ),
                            );
                        }
                    },
                },
                pricing: options.publicOnly
                    ? {
                          where: (
                              servicePersonnelPricing,
                              { and, eq },
                          ) =>
                              and(
                                  eq(servicePersonnelPricing.isActive, true),
                                  options.serviceId
                                      ? eq(
                                            servicePersonnelPricing.serviceId,
                                            options.serviceId,
                                        )
                                      : sql`true`,
                              ),
                      }
                    : true,
            },
        });

        if (!result) {
            return null;
        }

        const { pricing, skills, ...personnelInfo } = result;
        const serviceIds = skills.map((skill) => skill.serviceId);
        const [statuses, drafts] = await Promise.all([
            serviceIds.length > 0
                ? this.db
                      .select({
                          serviceId: servicePersonnelOfferingStatuses.serviceId,
                          publicationStatus:
                              servicePersonnelOfferingStatuses.publicationStatus,
                          reviewStatus:
                              servicePersonnelOfferingStatuses.reviewStatus,
                          takeDownReason:
                              servicePersonnelOfferingStatuses.takeDownReason,
                          lastApprovedAt:
                              servicePersonnelOfferingStatuses.lastApprovedAt,
                          takenDownAt:
                              servicePersonnelOfferingStatuses.takenDownAt,
                      })
                      .from(servicePersonnelOfferingStatuses)
                      .where(
                          and(
                              eq(
                                  servicePersonnelOfferingStatuses.personnelUserId,
                                  personnelId,
                              ),
                              inArray(
                                  servicePersonnelOfferingStatuses.serviceId,
                                  serviceIds,
                              ),
                          ),
                      )
                : Promise.resolve([]),
            this.db
                .select()
                .from(servicePersonnelOfferingDrafts)
                .where(
                    and(
                        eq(
                            servicePersonnelOfferingDrafts.personnelUserId,
                            personnelId,
                        ),
                        inArray(servicePersonnelOfferingDrafts.status, [
                            'pending',
                            'rejected',
                        ]),
                    ),
                )
                .orderBy(desc(servicePersonnelOfferingDrafts.updatedAt)),
        ]);
        const statusMap = new Map<string, (typeof statuses)[number]>();
        for (const status of statuses) {
            statusMap.set(status.serviceId, status);
        }
        const draftMap = new Map<string, (typeof drafts)[number]>();
        for (const draft of drafts) {
            const snapshot = draft.submittedSnapshot as {
                services?: Array<{ serviceId?: string }>;
            };
            for (const service of snapshot.services ?? []) {
                if (service.serviceId && !draftMap.has(service.serviceId)) {
                    draftMap.set(service.serviceId, draft);
                }
            }
        }

        const pricingMap = new Map<
            string,
            (typeof servicePersonnelPricing.$inferSelect)[]
        >();
        for (const item of pricing) {
            if (!pricingMap.has(item.serviceId)) {
                pricingMap.set(item.serviceId, []);
            }
            pricingMap.get(item.serviceId)?.push(item);
        }

        const skillsWithPrice = skills
            .map((skill) => {
                const status = statusMap.get(skill.serviceId);
                const draft = draftMap.get(skill.serviceId);
                const specifications = pricingMap.get(skill.serviceId) ?? [];
                const { reviewStatus, publicationStatus } =
                    resolveOfferingVisibilityState({
                        draftStatus: draft?.status,
                        statusReviewStatus: status?.reviewStatus,
                        statusPublicationStatus: status?.publicationStatus,
                    });
                const isPublished =
                    status?.publicationStatus === 'active' &&
                    status.reviewStatus === 'approved' &&
                    skill.service.isActive &&
                    specifications.length > 0;

                if (options.publicOnly && !isPublished) {
                    return null;
                }

                return {
                    ...skill.service,
                    categoryId: skill.service.categoryId,
                    categoryName: skill.service.category?.name ?? null,
                    specifications,
                    galleryFileIds: skill.galleryFileIds ?? [],
                    personnelDescription: skill.description ?? null,
                    reviewStatus,
                    publicationStatus,
                    rejectionReason:
                        draft?.status === 'rejected'
                            ? draft.rejectionReason
                            : null,
                    takeDownReason: status?.takeDownReason ?? null,
                    pendingDraftId: draft?.status === 'pending' ? draft.id : null,
                    lastApprovedAt: status?.lastApprovedAt ?? null,
                    takenDownAt: status?.takenDownAt ?? null,
                };
            })
            .filter((skill) => skill !== null);

        return {
            ...personnelInfo,
            skills: skillsWithPrice,
        };
    }

    /**
     * 检查用户是否存在于users表中
     *
     * @param userId 用户ID
     * @returns 存在返回true，不存在返回false
     */
    async isUserExists(userId: string): Promise<boolean> {
        const s = sql`SELECT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${userId}) AS user_exists`;
        const result = await this.db.execute<{
            user_exists: boolean;
        }>(s);

        return result.rows[0].user_exists;
    }

    /**
     * 检查服务人员是否存在于service_personnel表中
     *
     * @param personnelId 服务人员用户ID
     * @returns 存在返回true，不存在返回false
     */
    async isServicePersonnelExists(personnelId: string): Promise<boolean> {
        const s = sql`SELECT EXISTS (SELECT 1 FROM ${servicePersonnel} WHERE ${servicePersonnel.userId} = ${personnelId}) AS personnel_exists`;
        const result = await this.db.execute<{
            personnel_exists: boolean;
        }>(s);

        return result.rows[0].personnel_exists;
    }

    /**
     * 设置或更新服务人员的个人定价
     *
     * @param personnelId 服务人员用户ID
     * @param serviceId 服务ID
     * @param price 个人定价
     * @param estimatedDurationMinutes 预计服务时长（分钟）
     * @param currency 币种代码
     * @returns 返回定价记录
     */
    async upsertPersonnelPricing(
        personnelId: string,
        serviceId: string,
        price: string,
        estimatedDurationMinutes: number,
        currency: string = 'CNY',
    ) {
        // 检查服务人员是否存在
        if (!(await this.isServicePersonnelExists(personnelId))) {
            throw new BadRequestException('该服务人员不存在');
        }

        const now = new Date();

        // 使用 upsert 操作
        const result = await this.db
            .insert(servicePersonnelPricing)
            .values({
                userId: personnelId,
                serviceId,
                price,
                estimatedDurationMinutes,
                currency,
                isActive: true,
                effectiveFrom: now,
            })
            .onConflictDoUpdate({
                target: [
                    servicePersonnelPricing.userId,
                    servicePersonnelPricing.serviceId,
                ],
                set: {
                    price,
                    estimatedDurationMinutes,
                    currency,
                    isActive: true,
                    effectiveFrom: now,
                },
            })
            .returning();

        return result[0];
    }

    /**
     * 获取服务人员的所有定价
     *
     * @param personnelId 服务人员用户ID
     * @returns 返回定价列表
     */
    async getPersonnelPricing(personnelId: string) {
        return await this.db
            .select({
                id: servicePersonnelPricing.id,
                serviceId: servicePersonnelPricing.serviceId,
                price: servicePersonnelPricing.price,
                currency: servicePersonnelPricing.currency,
                isActive: servicePersonnelPricing.isActive,
                effectiveFrom: servicePersonnelPricing.effectiveFrom,
                effectiveTo: servicePersonnelPricing.effectiveTo,
            })
            .from(servicePersonnelPricing)
            .where(
                and(
                    eq(servicePersonnelPricing.userId, personnelId),
                    eq(servicePersonnelPricing.isActive, true),
                ),
            );
    }

    /**
     * 删除服务人员的定价
     *
     * @param personnelId 服务人员用户ID
     * @param serviceId 服务ID
     * @returns 返回是否成功
     */
    async removePersonnelPricing(personnelId: string, serviceId: string) {
        const result = await this.db
            .update(servicePersonnelPricing)
            .set({
                isActive: false,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(servicePersonnelPricing.userId, personnelId),
                    eq(servicePersonnelPricing.serviceId, serviceId),
                ),
            )
            .returning();

        return result.length > 0;
    }

    async findServicesByIds(serviceIds: string[]) {
        if (serviceIds.length === 0) {
            return [];
        }

        return await this.db
            .select({
                id: services.id,
                categoryId: services.categoryId,
                categoryName: serviceCategories.name,
            })
            .from(services)
            .leftJoin(
                serviceCategories,
                eq(serviceCategories.id, services.categoryId),
            )
            .where(inArray(services.id, serviceIds));
    }

    async updateServiceOfferings(
        personnelId: string,
        payload: UpdateServiceOfferingsRequest,
    ) {
        const {
            services: inputServices,
            merchantQualificationFileId,
            vocationalQualificationFileId,
        } = payload;

        if (inputServices.length === 0) {
            throw new BadRequestException('请至少配置一个服务分类');
        }

        if (!(await this.isServicePersonnelExists(personnelId))) {
            throw new BadRequestException('该服务人员不存在');
        }

        const normalizedServices = inputServices.map((service) => {
            const galleryFileIds = Array.from(
                new Set(service.galleryFileIds ?? []),
            );
            if (galleryFileIds.length > 5) {
                throw new BadRequestException('宣传图片最多 5 张');
            }
            return { ...service, galleryFileIds };
        });

        await this.db.transaction(async (tx) => {
            const targetServiceIds = Array.from(
                new Set(normalizedServices.map((service) => service.serviceId)),
            );

            await tx
                .update(servicePersonnel)
                .set({
                    merchantQualificationFileId:
                        merchantQualificationFileId?.trim() || null,
                    vocationalQualificationFileId:
                        vocationalQualificationFileId?.trim() || null,
                })
                .where(eq(servicePersonnel.userId, personnelId));

            const existingSkills = await tx
                .select({ serviceId: servicePersonnelSkills.serviceId })
                .from(servicePersonnelSkills)
                .where(eq(servicePersonnelSkills.userId, personnelId));

            const existingIds = existingSkills.map((item) => item.serviceId);
            const toInsert = targetServiceIds.filter(
                (id) => !existingIds.includes(id),
            );
            const toRemove = existingIds.filter(
                (id) => !targetServiceIds.includes(id),
            );

            if (toRemove.length > 0) {
                await tx
                    .delete(servicePersonnelSkills)
                    .where(
                        and(
                            eq(servicePersonnelSkills.userId, personnelId),
                            inArray(servicePersonnelSkills.serviceId, toRemove),
                        ),
                    );

                await tx
                    .update(servicePersonnelPricing)
                    .set({ isActive: false })
                    .where(
                        and(
                            eq(servicePersonnelPricing.userId, personnelId),
                            inArray(
                                servicePersonnelPricing.serviceId,
                                toRemove,
                            ),
                        ),
                    );
            }

            if (toInsert.length > 0) {
                await tx.insert(servicePersonnelSkills).values(
                    toInsert.map((serviceId) => ({
                        serviceId,
                        userId: personnelId,
                    })),
                );
            }

            for (const service of normalizedServices) {
                await tx
                    .update(servicePersonnelSkills)
                    .set({
                        description: service.description ?? null,
                        galleryFileIds: service.galleryFileIds ?? [],
                    })
                    .where(
                        and(
                            eq(servicePersonnelSkills.userId, personnelId),
                            eq(
                                servicePersonnelSkills.serviceId,
                                service.serviceId,
                            ),
                        ),
                    );
            }

            const existingSpecs = await tx
                .select({
                    id: servicePersonnelPricing.id,
                    serviceId: servicePersonnelPricing.serviceId,
                    isActive: servicePersonnelPricing.isActive,
                })
                .from(servicePersonnelPricing)
                .where(
                    and(
                        eq(servicePersonnelPricing.userId, personnelId),
                        inArray(
                            servicePersonnelPricing.serviceId,
                            targetServiceIds,
                        ),
                    ),
                );

            const specById = new Map(
                existingSpecs.map((spec) => [spec.id, spec]),
            );
            const retainedSpecIds = new Set<string>();
            const now = new Date();

            for (const service of normalizedServices) {
                for (const spec of service.specifications) {
                    if (spec.id && specById.has(spec.id)) {
                        await tx
                            .update(servicePersonnelPricing)
                            .set({
                                name: spec.name,
                                price: spec.price,
                                currency: spec.currency ?? 'CNY',
                                estimatedDurationMinutes:
                                    spec.estimatedDurationMinutes,
                                isActive: true,
                                effectiveFrom: now,
                            })
                            .where(eq(servicePersonnelPricing.id, spec.id));
                        retainedSpecIds.add(spec.id);
                        continue;
                    }

                    const inserted = await tx
                        .insert(servicePersonnelPricing)
                        .values({
                            userId: personnelId,
                            serviceId: service.serviceId,
                            name: spec.name,
                            price: spec.price,
                            currency: spec.currency ?? 'CNY',
                            estimatedDurationMinutes:
                                spec.estimatedDurationMinutes,
                            isActive: true,
                            effectiveFrom: now,
                        })
                        .returning({ id: servicePersonnelPricing.id });

                    retainedSpecIds.add(inserted[0].id);
                }
            }

            const toDeactivate = existingSpecs
                .filter(
                    (spec) =>
                        spec.isActive && !retainedSpecIds.has(spec.id ?? ''),
                )
                .map((spec) => spec.id);

            if (toDeactivate.length > 0) {
                await tx
                    .update(servicePersonnelPricing)
                    .set({ isActive: false })
                    .where(inArray(servicePersonnelPricing.id, toDeactivate));
            }
        });
    }

    async submitServiceOfferingsForReview(
        personnelId: string,
        payload: UpdateServiceOfferingsRequest,
    ) {
        if (!(await this.isServicePersonnelExists(personnelId))) {
            throw new BadRequestException('该服务人员不存在');
        }

        const normalizedServices = payload.services.map((service) => {
            const galleryFileIds = Array.from(
                new Set(service.galleryFileIds ?? []),
            );
            if (galleryFileIds.length > 5) {
                throw new BadRequestException('宣传图片最多 5 张');
            }
            return { ...service, galleryFileIds };
        });
        const submittedSnapshot = {
            ...payload,
            services: normalizedServices,
        };
        const [draft] = await this.db
            .insert(servicePersonnelOfferingDrafts)
            .values({
                personnelUserId: personnelId,
                status: 'pending',
                submittedSnapshot,
            })
            .onConflictDoUpdate({
                target: servicePersonnelOfferingDrafts.personnelUserId,
                targetWhere: sql`${servicePersonnelOfferingDrafts.status} = 'pending'`,
                set: {
                    submittedSnapshot,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return draft;
    }
}
