import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
    AdminServiceOfferingListItem,
    AdminServiceOfferingListQuery,
    AdminServiceOfferingListResponse,
    AdminServiceOfferingSpecification,
    FileAccessInfo,
    ServiceOfferingLifecycle,
    ServiceOfferingLifecycleFilter,
    ServiceOfferingSubmittedSnapshot,
} from '@repo/types';
import { UpdateServiceOfferingsRequestSchema } from '@repo/types';
import {
    and,
    count,
    desc,
    eq,
    ilike,
    inArray,
    or,
    sql,
} from 'drizzle-orm';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    serviceCategories,
    servicePersonnel,
    servicePersonnelOfferingDrafts,
    servicePersonnelOfferingStatuses,
    servicePersonnelPricing,
    servicePersonnelSkills,
    services,
    users,
} from 'src/common/database/schema';

export const ADMIN_SERVICE_OFFERINGS_FILES_SERVICE = Symbol(
    'ADMIN_SERVICE_OFFERINGS_FILES_SERVICE',
);

type AdminServiceOfferingsFilesService = {
    getFileAccessInfo(fileIdentifier: string): Promise<{
        fileUrl: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        expiresIn: number;
        blurhash?: string;
    }>;
};

export interface ServiceOfferingReviewResult {
    draftId: string;
    personnelUserId: string;
    serviceIds: string[];
}

export interface ServiceOfferingTakeDownResult {
    personnelUserId: string;
    serviceId: string;
}

type NormalizedListQuery = {
    page: number;
    limit: number;
    offset: number;
    keyword?: string;
    lifecycle: ServiceOfferingLifecycleFilter;
};

type DraftLifecycleSource = 'pending' | 'rejected';
type PublishedLifecycleSource = 'active' | 'taken_down';

function deriveDraftLifecycle(
    reviewStatus: 'pending' | 'approved' | 'rejected',
): ServiceOfferingLifecycle {
    if (reviewStatus === 'rejected') {
        return 'rejected';
    }
    return 'pending_review';
}

function derivePublishedLifecycle(
    publicationStatus: PublishedLifecycleSource,
): ServiceOfferingLifecycle {
    return publicationStatus === 'taken_down' ? 'taken_down' : 'active';
}

function lifecycleIncludesDraft(lifecycle: ServiceOfferingLifecycleFilter) {
    return (
        lifecycle === 'all' ||
        lifecycle === 'pending_review' ||
        lifecycle === 'rejected'
    );
}

function lifecycleIncludesPublished(lifecycle: ServiceOfferingLifecycleFilter) {
    return (
        lifecycle === 'all' ||
        lifecycle === 'active' ||
        lifecycle === 'taken_down'
    );
}

function lifecycleToDraftReviewStatus(
    lifecycle: ServiceOfferingLifecycleFilter,
): DraftLifecycleSource | undefined {
    if (lifecycle === 'pending_review') return 'pending';
    if (lifecycle === 'rejected') return 'rejected';
    return undefined;
}

function lifecycleToPublicationStatus(
    lifecycle: ServiceOfferingLifecycleFilter,
): PublishedLifecycleSource | undefined {
    if (lifecycle === 'active') return 'active';
    if (lifecycle === 'taken_down') return 'taken_down';
    return undefined;
}

type ExistingPricingSpec = {
    id: string;
    serviceId: string;
    isActive: boolean;
};

type SubmittedPricingSpec = {
    id?: string;
    serviceId: string;
};

type PricingSyncPlan = {
    updateSpecIds: string[];
    insertSpecs: SubmittedPricingSpec[];
    deactivateSpecIds: string[];
};

type PublishedListRow = {
    personnelId: string;
    personnelName: string | null;
    phoneNumber: string | null;
    merchantQualificationFileId: string | null;
    vocationalQualificationFileId: string | null;
    serviceId: string;
    serviceName: string;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
    galleryFileIds: string[] | null;
    reviewStatus: 'pending' | 'approved' | 'rejected';
    publicationStatus: 'active' | 'taken_down';
    takeDownReason: string | null;
    takenDownBy: string | null;
    takenDownAt: Date | null;
    lastApprovedDraftId: string | null;
    lastApprovedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};

@Injectable()
export class AdminServiceOfferingsRepository {
    @Inject(DB)
    private readonly db: DbType;

    @Inject(ADMIN_SERVICE_OFFERINGS_FILES_SERVICE)
    private readonly filesService?: AdminServiceOfferingsFilesService;

    async list(
        query: AdminServiceOfferingListQuery,
    ): Promise<AdminServiceOfferingListResponse> {
        const normalized = this.normalizeQuery(query);
        const includeDraft = lifecycleIncludesDraft(normalized.lifecycle);
        const includePublished = lifecycleIncludesPublished(normalized.lifecycle);

        if (includeDraft && !includePublished) {
            const result = await this.findDraftItems(normalized, true);
            return this.buildPaginatedResponse(result.items, result.total, normalized);
        }
        if (includePublished && !includeDraft) {
            const result = await this.findPublishedItems(normalized, true);
            return this.buildPaginatedResponse(result.items, result.total, normalized);
        }

        const [draftResult, publishedResult] = await Promise.all([
            this.findDraftItems(normalized, false),
            this.findPublishedItems(normalized, false),
        ]);
        const combined = [...draftResult.items, ...publishedResult.items].sort(
            (a, b) => b.updatedAt.localeCompare(a.updatedAt),
        );
        return this.buildPaginatedResponse(
            combined.slice(normalized.offset, normalized.offset + normalized.limit),
            draftResult.total + publishedResult.total,
            normalized,
        );
    }

    private async findDraftItems(
        normalized: NormalizedListQuery,
        applyPagination: boolean,
    ): Promise<{
        items: AdminServiceOfferingListItem[];
        total: number;
    }> {
        const draftReviewStatus = lifecycleToDraftReviewStatus(
            normalized.lifecycle,
        );
        const conditions = [
            draftReviewStatus
                ? eq(servicePersonnelOfferingDrafts.status, draftReviewStatus)
                : normalized.lifecycle === 'all'
                  ? inArray(servicePersonnelOfferingDrafts.status, [
                        'pending',
                        'rejected',
                    ])
                  : undefined,
            this.buildDraftKeywordCondition(normalized.keyword),
        ].filter(Boolean);
        const where = conditions.length ? and(...conditions) : undefined;

        const [items, totalRows] = await Promise.all([
            this.db
                .select({
                    draftId: servicePersonnelOfferingDrafts.id,
                    serviceId: servicePersonnelOfferingDrafts.serviceId,
                    personnelId: servicePersonnel.userId,
                    personnelName: servicePersonnel.name,
                    phoneNumber: users.phoneNumber,
                    merchantQualificationFileId:
                        servicePersonnel.merchantQualificationFileId,
                    vocationalQualificationFileId:
                        servicePersonnel.vocationalQualificationFileId,
                    reviewStatus: servicePersonnelOfferingDrafts.status,
                    rejectionReason:
                        servicePersonnelOfferingDrafts.rejectionReason,
                    submittedSnapshot:
                        servicePersonnelOfferingDrafts.submittedSnapshot,
                    serviceName: services.name,
                    categoryId: serviceCategories.id,
                    categoryName: serviceCategories.name,
                    reviewedBy: servicePersonnelOfferingDrafts.reviewedBy,
                    reviewedAt: servicePersonnelOfferingDrafts.reviewedAt,
                    createdAt: servicePersonnelOfferingDrafts.createdAt,
                    updatedAt: servicePersonnelOfferingDrafts.updatedAt,
                })
                .from(servicePersonnelOfferingDrafts)
                .innerJoin(
                    servicePersonnel,
                    eq(
                        servicePersonnel.userId,
                        servicePersonnelOfferingDrafts.personnelUserId,
                    ),
                )
                .innerJoin(users, eq(users.id, servicePersonnel.userId))
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelOfferingDrafts.serviceId),
                )
                .leftJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(where)
                .orderBy(desc(servicePersonnelOfferingDrafts.updatedAt))
                .limit(
                    applyPagination
                        ? normalized.limit
                        : normalized.offset + normalized.limit,
                )
                .offset(applyPagination ? normalized.offset : 0),
            this.db
                .select({ total: count() })
                .from(servicePersonnelOfferingDrafts)
                .innerJoin(
                    servicePersonnel,
                    eq(
                        servicePersonnel.userId,
                        servicePersonnelOfferingDrafts.personnelUserId,
                    ),
                )
                .innerJoin(users, eq(users.id, servicePersonnel.userId))
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelOfferingDrafts.serviceId),
                )
                .leftJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(where),
        ]);

        return {
            items: await Promise.all(
                items.map(async (item) => ({
                    kind: 'draft' as const,
                    draftId: item.draftId,
                    personnel: await this.buildPersonnelSummary({
                        id: item.personnelId,
                        name: item.personnelName,
                        phoneNumber: item.phoneNumber ?? null,
                        merchantQualificationFileId:
                            item.merchantQualificationFileId,
                        vocationalQualificationFileId:
                            item.vocationalQualificationFileId,
                    }),
                    reviewStatus: item.reviewStatus,
                    lifecycle: deriveDraftLifecycle(item.reviewStatus),
                    rejectionReason: item.rejectionReason,
                    submittedSnapshot: await this.enrichSubmittedSnapshot(
                        item.submittedSnapshot,
                        {
                            serviceId: item.serviceId,
                            serviceName: item.serviceName,
                            categoryId: item.categoryId,
                            categoryName: item.categoryName,
                        },
                    ),
                    reviewedBy: item.reviewedBy,
                    reviewedAt: this.toNullableIsoString(item.reviewedAt),
                    createdAt: this.toRequiredIsoString(item.createdAt),
                    updatedAt: this.toRequiredIsoString(item.updatedAt),
                })),
            ),
            total: Number(totalRows[0]?.total ?? 0),
        };
    }

    private async findPublishedItems(
        normalized: NormalizedListQuery,
        applyPagination: boolean,
    ): Promise<{
        items: AdminServiceOfferingListItem[];
        total: number;
    }> {
        const publicationStatus = lifecycleToPublicationStatus(
            normalized.lifecycle,
        );
        const conditions = [
            eq(
                servicePersonnelOfferingStatuses.reviewStatus,
                'approved',
            ),
            publicationStatus
                ? eq(
                      servicePersonnelOfferingStatuses.publicationStatus,
                      publicationStatus,
                  )
                : undefined,
            this.buildPublishedKeywordCondition(normalized.keyword),
        ].filter(Boolean);
        const where = conditions.length ? and(...conditions) : undefined;

        const [items, totalRows] = await Promise.all([
            this.db
                .select({
                    personnelId: servicePersonnel.userId,
                    personnelName: servicePersonnel.name,
                    phoneNumber: users.phoneNumber,
                    merchantQualificationFileId:
                        servicePersonnel.merchantQualificationFileId,
                    vocationalQualificationFileId:
                        servicePersonnel.vocationalQualificationFileId,
                    serviceId: services.id,
                    serviceName: services.name,
                    categoryId: serviceCategories.id,
                    categoryName: serviceCategories.name,
                    description: servicePersonnelSkills.description,
                    galleryFileIds: servicePersonnelSkills.galleryFileIds,
                    reviewStatus:
                        servicePersonnelOfferingStatuses.reviewStatus,
                    publicationStatus:
                        servicePersonnelOfferingStatuses.publicationStatus,
                    takeDownReason:
                        servicePersonnelOfferingStatuses.takeDownReason,
                    takenDownBy:
                        servicePersonnelOfferingStatuses.takenDownBy,
                    takenDownAt:
                        servicePersonnelOfferingStatuses.takenDownAt,
                    lastApprovedDraftId:
                        servicePersonnelOfferingStatuses.lastApprovedDraftId,
                    lastApprovedAt:
                        servicePersonnelOfferingStatuses.lastApprovedAt,
                    createdAt: servicePersonnelOfferingStatuses.createdAt,
                    updatedAt: servicePersonnelOfferingStatuses.updatedAt,
                })
                .from(servicePersonnelOfferingStatuses)
                .innerJoin(
                    servicePersonnel,
                    eq(
                        servicePersonnel.userId,
                        servicePersonnelOfferingStatuses.personnelUserId,
                    ),
                )
                .innerJoin(users, eq(users.id, servicePersonnel.userId))
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelOfferingStatuses.serviceId),
                )
                .leftJoin(
                    servicePersonnelSkills,
                    and(
                        eq(
                            servicePersonnelSkills.userId,
                            servicePersonnelOfferingStatuses.personnelUserId,
                        ),
                        eq(
                            servicePersonnelSkills.serviceId,
                            servicePersonnelOfferingStatuses.serviceId,
                        ),
                    ),
                )
                .leftJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(where)
                .orderBy(desc(servicePersonnelOfferingStatuses.updatedAt))
                .limit(
                    applyPagination
                        ? normalized.limit
                        : normalized.offset + normalized.limit,
                )
                .offset(applyPagination ? normalized.offset : 0),
            this.db
                .select({ total: count() })
                .from(servicePersonnelOfferingStatuses)
                .innerJoin(
                    servicePersonnel,
                    eq(
                        servicePersonnel.userId,
                        servicePersonnelOfferingStatuses.personnelUserId,
                    ),
                )
                .innerJoin(users, eq(users.id, servicePersonnel.userId))
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelOfferingStatuses.serviceId),
                )
                .leftJoin(
                    servicePersonnelSkills,
                    and(
                        eq(
                            servicePersonnelSkills.userId,
                            servicePersonnelOfferingStatuses.personnelUserId,
                        ),
                        eq(
                            servicePersonnelSkills.serviceId,
                            servicePersonnelOfferingStatuses.serviceId,
                        ),
                    ),
                )
                .leftJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(where),
        ]);

        const specificationsByOffering =
            await this.findPublishedSpecifications(items);

        return {
            items: await Promise.all(
                items.map(async (item) => {
                    const offeringKey = this.buildOfferingKey(
                        item.personnelId,
                        item.serviceId,
                    );

                    return {
                        kind: 'published' as const,
                        personnel: await this.buildPersonnelSummary({
                            id: item.personnelId,
                            name: item.personnelName,
                            phoneNumber: item.phoneNumber ?? null,
                            merchantQualificationFileId:
                                item.merchantQualificationFileId,
                            vocationalQualificationFileId:
                                item.vocationalQualificationFileId,
                        }),
                        service: {
                            id: item.serviceId,
                            name: item.serviceName,
                            categoryId: item.categoryId,
                            categoryName: item.categoryName,
                            description: item.description,
                            galleryFileIds: item.galleryFileIds ?? [],
                            gallery: await this.buildFileAccessList(
                                item.galleryFileIds ?? [],
                            ),
                        },
                        specifications:
                            specificationsByOffering.get(offeringKey) ?? [],
                        reviewStatus: item.reviewStatus,
                        publicationStatus: item.publicationStatus,
                        lifecycle: derivePublishedLifecycle(
                            item.publicationStatus,
                        ),
                        takeDownReason: item.takeDownReason,
                        takenDownBy: item.takenDownBy,
                        takenDownAt: this.toNullableIsoString(item.takenDownAt),
                        lastApprovedDraftId: item.lastApprovedDraftId,
                        lastApprovedAt: this.toNullableIsoString(
                            item.lastApprovedAt,
                        ),
                        createdAt: this.toRequiredIsoString(item.createdAt),
                        updatedAt: this.toRequiredIsoString(item.updatedAt),
                    };
                }),
            ),
            total: Number(totalRows[0]?.total ?? 0),
        };
    }

    private async findPublishedSpecifications(
        items: PublishedListRow[],
    ): Promise<Map<string, AdminServiceOfferingSpecification[]>> {
        if (items.length === 0) {
            return new Map();
        }

        const personnelIds = Array.from(
            new Set(items.map((item) => item.personnelId)),
        );
        const serviceIds = Array.from(new Set(items.map((item) => item.serviceId)));
        const offeringKeys = new Set(
            items.map((item) =>
                this.buildOfferingKey(item.personnelId, item.serviceId),
            ),
        );

        const pricingRows = await this.db
            .select({
                id: servicePersonnelPricing.id,
                userId: servicePersonnelPricing.userId,
                serviceId: servicePersonnelPricing.serviceId,
                name: servicePersonnelPricing.name,
                price: servicePersonnelPricing.price,
                currency: servicePersonnelPricing.currency,
                estimatedDurationMinutes:
                    servicePersonnelPricing.estimatedDurationMinutes,
                isActive: servicePersonnelPricing.isActive,
            })
            .from(servicePersonnelPricing)
            .where(
                and(
                    inArray(servicePersonnelPricing.userId, personnelIds),
                    inArray(servicePersonnelPricing.serviceId, serviceIds),
                    eq(servicePersonnelPricing.isActive, true),
                ),
            );

        const grouped = new Map<string, AdminServiceOfferingSpecification[]>();
        for (const row of pricingRows) {
            const offeringKey = this.buildOfferingKey(row.userId, row.serviceId);
            if (!offeringKeys.has(offeringKey)) {
                continue;
            }

            const specifications = grouped.get(offeringKey) ?? [];
            specifications.push({
                id: row.id,
                name: row.name,
                serviceId: row.serviceId,
                price: row.price,
                currency: row.currency,
                estimatedDurationMinutes: row.estimatedDurationMinutes,
                isActive: row.isActive,
            });
            grouped.set(offeringKey, specifications);
        }

        return grouped;
    }

    async approveDraft(
        draftId: string,
        adminUserId: string,
    ): Promise<ServiceOfferingReviewResult> {
        return this.db.transaction(async (tx) => {
            const [draft] = await tx
                .select()
                .from(servicePersonnelOfferingDrafts)
                .where(
                    and(
                        eq(servicePersonnelOfferingDrafts.id, draftId),
                        eq(servicePersonnelOfferingDrafts.status, 'pending'),
                    ),
                )
                .limit(1)
                .for('update');

            if (!draft) {
                throw new BadRequestException('待审核草稿不存在或已处理');
            }

            const snapshot = UpdateServiceOfferingsRequestSchema.parse(
                draft.submittedSnapshot,
            ) as ServiceOfferingSubmittedSnapshot;
            const now = new Date();
            const normalizedServices = snapshot.services.map((service) => ({
                ...service,
                galleryFileIds: Array.from(
                    new Set(service.galleryFileIds ?? []),
                ),
            }));
            const targetServiceIds = Array.from(
                new Set(normalizedServices.map((service) => service.serviceId)),
            );
            if (
                targetServiceIds.length !== 1 ||
                targetServiceIds[0] !== draft.serviceId
            ) {
                throw new BadRequestException('待审核草稿服务不一致');
            }

            await tx
                .update(servicePersonnel)
                .set({
                    merchantQualificationFileId:
                        snapshot.merchantQualificationFileId?.trim() || null,
                    vocationalQualificationFileId:
                        snapshot.vocationalQualificationFileId?.trim() || null,
                })
                .where(eq(servicePersonnel.userId, draft.personnelUserId));

            if (normalizedServices.length > 0) {
                await tx
                    .insert(servicePersonnelSkills)
                    .values(
                        normalizedServices.map((service) => ({
                            userId: draft.personnelUserId,
                            serviceId: service.serviceId,
                            description: service.description ?? null,
                            galleryFileIds: service.galleryFileIds ?? [],
                        })),
                    )
                    .onConflictDoUpdate({
                        target: [
                            servicePersonnelSkills.userId,
                            servicePersonnelSkills.serviceId,
                        ],
                        set: {
                            description: sql`excluded.description`,
                            galleryFileIds: sql`excluded.gallery_file_ids`,
                        },
                    });
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
                        eq(
                            servicePersonnelPricing.userId,
                            draft.personnelUserId,
                        ),
                        inArray(
                            servicePersonnelPricing.serviceId,
                            targetServiceIds,
                        ),
                    ),
                );

            const submittedSpecs = normalizedServices.flatMap((service) =>
                service.specifications.map((spec) => ({
                    ...spec,
                    serviceId: service.serviceId,
                })),
            );
            const pricingSyncPlan = buildPricingSyncPlan(
                existingSpecs,
                submittedSpecs,
            );

            for (const spec of submittedSpecs) {
                if (
                    spec.id &&
                    pricingSyncPlan.updateSpecIds.includes(spec.id)
                ) {
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
                            updatedAt: now,
                        })
                        .where(eq(servicePersonnelPricing.id, spec.id));
                    continue;
                }

                const [inserted] = await tx
                    .insert(servicePersonnelPricing)
                    .values({
                        userId: draft.personnelUserId,
                        serviceId: spec.serviceId,
                        name: spec.name,
                        price: spec.price,
                        currency: spec.currency ?? 'CNY',
                        estimatedDurationMinutes:
                            spec.estimatedDurationMinutes,
                        isActive: true,
                        effectiveFrom: now,
                    })
                    .returning({ id: servicePersonnelPricing.id });

                if (inserted) {
                    pricingSyncPlan.deactivateSpecIds =
                        pricingSyncPlan.deactivateSpecIds.filter(
                            (id) => id !== inserted.id,
                        );
                }
            }

            if (pricingSyncPlan.deactivateSpecIds.length > 0) {
                await tx
                    .update(servicePersonnelPricing)
                    .set({
                        isActive: false,
                        updatedAt: now,
                    })
                    .where(
                        inArray(
                            servicePersonnelPricing.id,
                            pricingSyncPlan.deactivateSpecIds,
                        ),
                    );
            }

            for (const serviceId of targetServiceIds) {
                await tx
                    .insert(servicePersonnelOfferingStatuses)
                    .values({
                        personnelUserId: draft.personnelUserId,
                        serviceId,
                        publicationStatus: 'active',
                        reviewStatus: 'approved',
                        takeDownReason: null,
                        takenDownBy: null,
                        takenDownAt: null,
                        lastApprovedDraftId: draft.id,
                        lastApprovedAt: now,
                    })
                    .onConflictDoUpdate({
                        target: [
                            servicePersonnelOfferingStatuses.personnelUserId,
                            servicePersonnelOfferingStatuses.serviceId,
                        ],
                        set: {
                            publicationStatus: 'active',
                            reviewStatus: 'approved',
                            takeDownReason: null,
                            takenDownBy: null,
                            takenDownAt: null,
                            lastApprovedDraftId: draft.id,
                            lastApprovedAt: now,
                            updatedAt: now,
                        },
                    });
            }

            await tx
                .update(servicePersonnelOfferingDrafts)
                .set({
                    status: 'approved',
                    reviewedBy: adminUserId,
                    reviewedAt: now,
                    updatedAt: now,
                })
                .where(eq(servicePersonnelOfferingDrafts.id, draft.id));

            return {
                draftId: draft.id,
                personnelUserId: draft.personnelUserId,
                serviceIds: targetServiceIds,
            };
        });
    }

    async rejectDraft(
        draftId: string,
        adminUserId: string,
        reason: string,
    ): Promise<ServiceOfferingReviewResult> {
        const [draft] = await this.db
            .update(servicePersonnelOfferingDrafts)
            .set({
                status: 'rejected',
                rejectionReason: reason,
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(servicePersonnelOfferingDrafts.id, draftId),
                    eq(servicePersonnelOfferingDrafts.status, 'pending'),
                ),
            )
            .returning({
                draftId: servicePersonnelOfferingDrafts.id,
                personnelUserId:
                    servicePersonnelOfferingDrafts.personnelUserId,
                submittedSnapshot:
                    servicePersonnelOfferingDrafts.submittedSnapshot,
            });

        if (!draft) {
            throw new BadRequestException('待审核草稿不存在或已处理');
        }

        const snapshot = UpdateServiceOfferingsRequestSchema.safeParse(
            draft.submittedSnapshot,
        );

        return {
            draftId: draft.draftId,
            personnelUserId: draft.personnelUserId,
            serviceIds: snapshot.success
                ? snapshot.data.services.map((service) => service.serviceId)
                : [],
        };
    }

    async takeDownOffering(
        personnelId: string,
        serviceId: string,
        adminUserId: string,
        reason: string,
    ): Promise<ServiceOfferingTakeDownResult> {
        const [existing] = await this.db
            .select({
                serviceId: servicePersonnelOfferingStatuses.serviceId,
            })
            .from(servicePersonnelOfferingStatuses)
            .where(
                and(
                    eq(
                        servicePersonnelOfferingStatuses.personnelUserId,
                        personnelId,
                    ),
                    eq(servicePersonnelOfferingStatuses.serviceId, serviceId),
                    eq(
                        servicePersonnelOfferingStatuses.publicationStatus,
                        'active',
                    ),
                    eq(
                        servicePersonnelOfferingStatuses.reviewStatus,
                        'approved',
                    ),
                ),
            )
            .limit(1);

        if (!existing) {
            throw new BadRequestException('该服务未处于已发布状态，无法下架');
        }

        await this.db
            .insert(servicePersonnelOfferingStatuses)
            .values({
                personnelUserId: personnelId,
                serviceId,
                publicationStatus: 'taken_down',
                reviewStatus: 'approved',
                takeDownReason: reason,
                takenDownBy: adminUserId,
                takenDownAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [
                    servicePersonnelOfferingStatuses.personnelUserId,
                    servicePersonnelOfferingStatuses.serviceId,
                ],
                set: {
                    publicationStatus: 'taken_down',
                    takeDownReason: reason,
                    takenDownBy: adminUserId,
                    takenDownAt: new Date(),
                    updatedAt: new Date(),
                },
            });

        return {
            personnelUserId: personnelId,
            serviceId,
        };
    }

    private normalizeQuery(
        query: AdminServiceOfferingListQuery,
    ): NormalizedListQuery {
        const page = Math.max(1, Number(query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
        return {
            page,
            limit,
            offset: (page - 1) * limit,
            keyword: query.keyword?.trim() || undefined,
            lifecycle: query.lifecycle ?? 'all',
        };
    }

    private buildDraftKeywordCondition(keyword?: string) {
        if (!keyword) {
            return undefined;
        }
        const pattern = `%${keyword}%`;
        return or(
            ilike(servicePersonnel.name, pattern),
            ilike(users.phoneNumber, pattern),
            sql`${servicePersonnelOfferingDrafts.submittedSnapshot}::text ILIKE ${pattern}`,
        );
    }

    private buildPublishedKeywordCondition(keyword?: string) {
        if (!keyword) {
            return undefined;
        }
        const pattern = `%${keyword}%`;
        return or(
            ilike(servicePersonnel.name, pattern),
            ilike(users.phoneNumber, pattern),
            ilike(services.name, pattern),
        );
    }

    private buildPaginatedResponse<T>(
        items: T[],
        total: number,
        query: NormalizedListQuery,
    ) {
        const totalPages = Math.ceil(total / query.limit) || 0;
        return {
            items,
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages,
                hasNext: query.page < totalPages,
                hasPrev: query.page > 1,
            },
        };
    }

    private buildOfferingKey(personnelId: string, serviceId: string): string {
        return `${personnelId}:${serviceId}`;
    }

    private async buildPersonnelSummary(personnel: {
        id: string;
        name: string | null;
        phoneNumber: string | null;
        merchantQualificationFileId?: string | null;
        vocationalQualificationFileId?: string | null;
    }) {
        const [merchantQualification, vocationalQualification] =
            await Promise.all([
                this.getFileAccessInfoSafely(
                    personnel.merchantQualificationFileId,
                ),
                this.getFileAccessInfoSafely(
                    personnel.vocationalQualificationFileId,
                ),
            ]);

        return {
            id: personnel.id,
            name: personnel.name,
            phoneNumber: personnel.phoneNumber,
            merchantQualificationFileId:
                personnel.merchantQualificationFileId ?? null,
            vocationalQualificationFileId:
                personnel.vocationalQualificationFileId ?? null,
            merchantQualification,
            vocationalQualification,
        };
    }

    private async enrichSubmittedSnapshot(
        snapshot: unknown,
        serviceMeta?: {
            serviceId: string;
            serviceName: string;
            categoryId: string | null;
            categoryName: string | null;
        },
    ) {
        const parsed = UpdateServiceOfferingsRequestSchema.safeParse(snapshot);
        if (!parsed.success) {
            return snapshot;
        }

        const servicesWithGallery = await Promise.all(
            parsed.data.services.map(async (service) => ({
                ...service,
                serviceName:
                    service.serviceId === serviceMeta?.serviceId
                        ? serviceMeta.serviceName
                        : undefined,
                categoryId:
                    service.serviceId === serviceMeta?.serviceId
                        ? serviceMeta.categoryId
                        : undefined,
                categoryName:
                    service.serviceId === serviceMeta?.serviceId
                        ? serviceMeta.categoryName
                        : undefined,
                galleryFileIds: service.galleryFileIds ?? [],
                gallery: await this.buildFileAccessList(
                    service.galleryFileIds ?? [],
                ),
            })),
        );

        return {
            ...parsed.data,
            services: servicesWithGallery,
        };
    }

    private async buildFileAccessList(
        fileIds: string[] | null | undefined,
    ): Promise<FileAccessInfo[]> {
        if (!fileIds?.length) {
            return [];
        }

        const files = await Promise.all(
            fileIds.map((fileId) => this.getFileAccessInfoSafely(fileId)),
        );

        return files.filter((file): file is FileAccessInfo => Boolean(file));
    }

    private async getFileAccessInfoSafely(
        fileId: string | null | undefined,
    ): Promise<FileAccessInfo | null> {
        if (!fileId) {
            return null;
        }

        try {
            if (!this.filesService) {
                return null;
            }
            const file = await this.filesService.getFileAccessInfo(fileId);
            return {
                fileId,
                url: file.fileUrl,
                fileName: file.fileName,
                mimeType: file.mimeType,
                fileSize: file.fileSize,
                expiresIn: file.expiresIn,
                blurhash: file.blurhash,
            };
        } catch {
            return null;
        }
    }

    private toNullableIsoString(value: Date | null | undefined): string | null {
        return value ? value.toISOString() : null;
    }

    private toRequiredIsoString(value: Date | null | undefined): string {
        return (value ?? new Date(0)).toISOString();
    }
}

export function buildPricingSyncPlan(
    existingSpecs: ExistingPricingSpec[],
    submittedSpecs: SubmittedPricingSpec[],
): PricingSyncPlan {
    const existingSpecIds = new Set(existingSpecs.map((spec) => spec.id));
    const retainedSpecIds = new Set<string>();
    const updateSpecIds: string[] = [];
    const insertSpecs: SubmittedPricingSpec[] = [];

    for (const spec of submittedSpecs) {
        if (spec.id && existingSpecIds.has(spec.id)) {
            retainedSpecIds.add(spec.id);
            updateSpecIds.push(spec.id);
            continue;
        }
        insertSpecs.push(spec);
    }

    const submittedServiceIds = new Set(
        submittedSpecs.map((spec) => spec.serviceId),
    );
    const deactivateSpecIds = existingSpecs
        .filter(
            (spec) =>
                spec.isActive &&
                submittedServiceIds.has(spec.serviceId) &&
                !retainedSpecIds.has(spec.id),
        )
        .map((spec) => spec.id);

    return {
        updateSpecIds,
        insertSpecs,
        deactivateSpecIds,
    };
}
