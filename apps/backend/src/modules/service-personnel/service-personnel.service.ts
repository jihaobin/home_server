import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import type {
    FileAccessInfo,
    ServicePersonnelFilterRequest,
    ServicePersonnelProfile,
    ServicePersonnelDashboardStats,
    UpdateServicePersonnelProfileRequest,
} from '@repo/types';
import { ServicePersonnelRepository } from './service-personnel.repository';
import { WorkSkillService } from '../work-skill/work-skill.service';
import { FilesService } from '../files/files.service';
import { OrderRepository } from '../order/order.reposityro';
import { PayService } from '../pay/pay.service';
import { ReviewService } from '../review/review.service';
import { ReviewTargetTypeEnum } from '@repo/types';
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
    reviewStatus?: 'pending' | 'approved' | 'rejected';
    publicationStatus?: 'active' | 'taken_down';
    rejectionReason?: string | null;
    takeDownReason?: string | null;
    pendingDraftId?: string | null;
    lastApprovedAt?: Date | null;
    takenDownAt?: Date | null;
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

type PersonnelContactInfo = {
    phoneNumber: string | null;
    idCardNumber: string | null;
};

type SearchPersonnelRow = {
    personnelId: string;
    name: string;
    avatar: string | null;
    serviceId: string;
    serviceName: string;
    pricingId?: string;
    minPrice: number;
    distanceKm: number;
    addressText: string;
    workDays: string;
    workStartTime: string;
    workEndTime: string;
    tag: string;
    reviewCount: number;
    goodRatePercentage: number;
    ratingValue: number;
};

@Injectable()
export class ServicePersonnelService {
    private readonly logger = new Logger(ServicePersonnelService.name);
    constructor(
        private readonly servicePersonnelRepository: ServicePersonnelRepository,
        private readonly workSkillService: WorkSkillService,
        private readonly filesService: FilesService,
        private readonly orderRepository: OrderRepository,
        private readonly payService: PayService,
        private readonly reviewService: ReviewService,
    ) {}

    private dedupeSearchPersonnelRows(rows: SearchPersonnelRow[]) {
        const dedupedRows = new Map<string, SearchPersonnelRow>();

        for (const row of rows) {
            const dedupeKey = row.personnelId;
            const existing = dedupedRows.get(dedupeKey);

            if (!existing) {
                dedupedRows.set(dedupeKey, row);
                continue;
            }

            const currentPrice = Number(
                row.minPrice ?? Number.POSITIVE_INFINITY,
            );
            const existingPrice = Number(
                existing.minPrice ?? Number.POSITIVE_INFINITY,
            );
            const currentDistance = Number(
                row.distanceKm ?? Number.POSITIVE_INFINITY,
            );
            const existingDistance = Number(
                existing.distanceKm ?? Number.POSITIVE_INFINITY,
            );

            if (currentDistance < existingDistance) {
                dedupedRows.set(dedupeKey, row);
                continue;
            }

            if (currentDistance > existingDistance) {
                continue;
            }

            if (currentPrice < existingPrice) {
                dedupedRows.set(dedupeKey, row);
                continue;
            }

            if (
                currentPrice === existingPrice &&
                (row.pricingId ?? '') < (existing.pricingId ?? '')
            ) {
                dedupedRows.set(dedupeKey, row);
            }
        }

        return Array.from(dedupedRows.values());
    }

    /**
     * 智能匹配服务人员
     * 根据用户位置、价格区间、服务类型等条件筛选合适的服务人员
     */
    async findMatchedPersonnel(filters: ServicePersonnelFilterRequest) {
        const result =
            await this.servicePersonnelRepository.findMatchedPersonnel(filters);

        // 兼容：原有 avatarUrl 可能为文件 hash；新增 avatar 提供可直接渲染的 URL + blurhash。
        const items = result.items ?? [];
        const isHttpUrl = (value: string) =>
            value.startsWith('http://') || value.startsWith('https://');

        const avatarFileIds = Array.from(
            new Set(
                items
                    .map((p) => (p.avatarUrl ?? '').trim())
                    .filter((id) => Boolean(id) && !isHttpUrl(id)),
            ),
        );

        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash: string | null }
        >();
        await Promise.all(
            avatarFileIds.map(async (fileId) => {
                const info = await this.getFileAccessInfoSafely(fileId);
                if (!info?.url) return;
                avatarInfoMap.set(fileId, {
                    url: info.url,
                    blurhash: info.blurhash ?? null,
                });
            }),
        );

        const nextItems = items.map((p) => {
            const raw = (p.avatarUrl ?? '').trim();
            const avatar = !raw
                ? null
                : isHttpUrl(raw)
                  ? { url: raw, blurhash: null }
                  : (avatarInfoMap.get(raw) ?? null);

            return {
                ...p,
                avatar,
            };
        });

        return {
            ...result,
            items: nextItems,
        };
    }

    async findSearchPersonnelSuggestions(keyword: string, limit = 5) {
        return await this.servicePersonnelRepository.findSearchPersonnelSuggestions(
            keyword,
            limit,
        );
    }

    async findExactPersonnelByName(keyword: string) {
        return await this.servicePersonnelRepository.findExactPersonnelByName(
            keyword,
        );
    }

    async searchPersonnelByServiceIds(params: {
        serviceIds: string[];
        page: number;
        limit: number;
        lat?: number;
        lng?: number;
        excludePersonnelUserId?: string;
    }) {
        const result =
            await this.servicePersonnelRepository.searchPersonnelByServiceIds(
                params,
            );
        const dedupedPersonnel = this.dedupeSearchPersonnelRows(
            result.personnel,
        );
        const hasMore =
            dedupedPersonnel.length >= params.limit ? result.hasMore : false;

        const isHttpUrl = (value: string) =>
            value.startsWith('http://') || value.startsWith('https://');

        const avatarFileIds = Array.from(
            new Set(
                dedupedPersonnel
                    .map((item) => item.avatar?.trim() ?? '')
                    .filter((item) => Boolean(item) && !isHttpUrl(item)),
            ),
        );

        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash: string | null }
        >();

        await Promise.all(
            avatarFileIds.map(async (fileId) => {
                const info = await this.getFileAccessInfoSafely(fileId);
                if (!info?.url) {
                    return;
                }

                avatarInfoMap.set(fileId, {
                    url: info.url,
                    blurhash: info.blurhash ?? null,
                });
            }),
        );

        return {
            ...result,
            hasMore,
            nextPage: hasMore ? result.nextPage : null,
            personnel: dedupedPersonnel.map((item) => {
                const rawAvatar = item.avatar?.trim() ?? '';
                const avatar = !rawAvatar
                    ? null
                    : isHttpUrl(rawAvatar)
                      ? { url: rawAvatar, blurhash: null }
                      : (avatarInfoMap.get(rawAvatar) ?? null);

                return {
                    personnelId: item.personnelId,
                    name: item.name,
                    avatarUrl: avatar?.url ?? null,
                    avatarBlurhash: avatar?.blurhash ?? null,
                    serviceId: item.serviceId,
                    serviceName: item.serviceName,
                    pricingId: item.pricingId,
                    minPrice: item.minPrice,
                    distanceKm: item.distanceKm,
                    addressText: item.addressText,
                    workDays: item.workDays,
                    workStartTime: item.workStartTime,
                    workEndTime: item.workEndTime,
                    tag: item.tag,
                    reviewCount: item.reviewCount,
                    goodRatePercentage: item.goodRatePercentage,
                    ratingValue: item.ratingValue,
                };
            }),
        };
    }

    async getPersonnelServicesSummary(personnelId: string) {
        const personnel =
            await this.workSkillService.getPublishedPersonnelInfo(personnelId);
        if (!personnel) {
            throw new NotFoundException('服务人员不存在');
        }

        const avatarHash = personnel.avatar?.trim();
        const avatar = avatarHash
            ? await this.getFileAccessInfoSafely(avatarHash)
            : null;

        const services = ((personnel.skills ?? []) as RawPersonnelSkill[])
            .filter((skill) => skill.isActive)
            .map((skill) => {
                const activeSpecifications = (skill.specifications ?? [])
                    .filter((spec) => spec.isActive)
                    .sort(
                        (left, right) =>
                            Number(left.price) - Number(right.price),
                    );
                const firstSpecification = activeSpecifications[0];

                return {
                    serviceId: skill.id,
                    serviceName: skill.name,
                    pricingId: firstSpecification?.id,
                    price: firstSpecification
                        ? Number(firstSpecification.price)
                        : undefined,
                    estimatedDurationMinutes:
                        firstSpecification?.estimatedDurationMinutes ??
                        undefined,
                    categoryId:
                        'categoryId' in skill &&
                        typeof skill.categoryId === 'string'
                            ? skill.categoryId
                            : undefined,
                };
            });

        return {
            matchedPersonnel: {
                id: personnel.userId,
                name: personnel.name?.trim() || '服务人员',
                avatarUrl: avatar?.url ?? null,
                avatarBlurhash: avatar?.blurhash ?? null,
            },
            services,
        };
    }

    async getPersonnelServiceDetails({
        personnelId,
        serviceId,
    }: {
        personnelId: string;
        serviceId: string;
    }) {
        // 获取服务人员的详细信息和所提供的服务详情
        const details =
            await this.servicePersonnelRepository.getPersonnelServiceDetails(
                personnelId,
                serviceId,
            );

        if (!details) {
            throw new NotFoundException('服务详情不存在');
        }

        if (!details.specifications || details.specifications.length === 0) {
            throw new NotFoundException('该服务暂无可用定价');
        }

        const galleryFileIds = details.galleryFileIds ?? [];
        const gallery = await this.buildFileAccessList(galleryFileIds);

        const topReviews = await this.reviewService.getTopReviewsByTarget(
            personnelId,
            ReviewTargetTypeEnum.parse('personnel'),
            {
                serviceId,
                limit: 5,
            },
        );

        return {
            ...details,
            galleryFileIds,
            gallery,
            topReviews,
        };
    }

    /**
     * 聚合获取服务人员资料，包含基本信息、可提供的服务、脱敏手机号以及文件预签名URL
     */
    async getPersonnelProfile(
        personnelId: string,
    ): Promise<ServicePersonnelProfile> {
        const personnel =
            await this.workSkillService.getPublishedPersonnelInfo(personnelId);
        return await this.buildPersonnelProfile(personnelId, personnel);
    }

    async getOwnPersonnelProfile(
        personnelId: string,
    ): Promise<ServicePersonnelProfile> {
        const personnel = await this.workSkillService.getPersonnelInfo(personnelId);
        return await this.buildPersonnelProfile(personnelId, personnel);
    }

    private async buildPersonnelProfile(
        personnelId: string,
        personnel: Awaited<ReturnType<WorkSkillService['getPersonnelInfo']>>,
    ): Promise<ServicePersonnelProfile> {
        if (!personnel) {
            throw new NotFoundException('服务人员不存在');
        }
        const userInfo =
            (await this.servicePersonnelRepository.getPersonnelContactInfo(
                personnelId,
            )) as PersonnelContactInfo | null;
        if (!userInfo) {
            throw new NotFoundException('服务人员不存在');
        }

        const avatarHash = personnel.avatar?.trim();
        const avatar = avatarHash
            ? await this.getFileAccessInfoSafely(avatarHash)
            : null;
        const merchantQualificationImage = personnel.merchantQualificationFileId
            ? await this.getFileAccessInfoSafely(
                  personnel.merchantQualificationFileId,
              )
            : null;
        const vocationalQualificationImage =
            personnel.vocationalQualificationFileId
                ? await this.getFileAccessInfoSafely(
                      personnel.vocationalQualificationFileId,
                  )
                : null;
        const services = await Promise.all(
            (personnel.skills ?? []).map(async (skill: RawPersonnelSkill) => {
                const specs = (skill.specifications ?? []).map((spec) => ({
                    id: spec.id,
                    userId: spec.userId,
                    serviceId: spec.serviceId,
                    price: spec.price,
                    currency: spec.currency,
                    name: spec.name ?? undefined,
                    estimatedDurationMinutes:
                        spec.estimatedDurationMinutes ?? undefined,
                }));
                const galleryFileIds = skill.galleryFileIds ?? [];
                const gallery = await this.buildFileAccessList(galleryFileIds);
                const currency =
                    skill.currency ||
                    specs.find((spec) => spec.currency)?.currency ||
                    'CNY';

                return {
                    serviceId: skill.id,
                    serviceName: skill.name,
                    categoryId: skill.categoryId ?? null,
                    categoryName: skill.categoryName ?? null,
                    serviceDescription: skill.description ?? null,
                    personnelDescription: skill.personnelDescription ?? null,
                    currency,
                    isActive: skill.isActive,
                    galleryFileIds,
                    gallery,
                    specifications: specs,
                    reviewStatus: skill.reviewStatus ?? 'approved',
                    publicationStatus: skill.publicationStatus ?? 'active',
                    rejectionReason: skill.rejectionReason ?? null,
                    takeDownReason: skill.takeDownReason ?? null,
                    pendingDraftId: skill.pendingDraftId ?? null,
                    lastApprovedAt: skill.lastApprovedAt ?? null,
                    takenDownAt: skill.takenDownAt ?? null,
                };
            }),
        );

        let location: { lng: number; lat: number } | null = null;
        const geom = (personnel as any).geom;
        if (
            Array.isArray(geom) &&
            typeof geom[0] === 'number' &&
            typeof geom[1] === 'number'
        ) {
            location = {
                lng: geom[0],
                lat: geom[1],
            };
        }

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
            maskedIdCardNumber:
                maskIdCardNumber(userInfo.idCardNumber ?? null) ?? null,
            emergencyContactPhone: personnel.emergencyContactPhone ?? null,
            emergencyContactName: personnel.emergencyContactName ?? null,
            avatar,
            services,
            merchantQualificationImage,
            vocationalQualificationImage,
            location,
        };
    }

    async updatePersonnelProfile(
        personnelId: string,
        payload: UpdateServicePersonnelProfileRequest,
    ) {
        if (
            !payload ||
            (payload.name === undefined &&
                payload.avatar === undefined &&
                payload.emergencyContactPhone === undefined &&
                payload.emergencyContactName === undefined)
        ) {
            throw new BadRequestException('请提供需要更新的字段');
        }

        const updated =
            await this.servicePersonnelRepository.updatePersonnelProfile(
                personnelId,
                payload,
            );

        if (!updated) {
            throw new NotFoundException('服务人员不存在');
        }

        return updated;
    }

    private maskPhoneNumber(phone?: string | null) {
        if (!phone) {
            return null;
        }

        if (phone.length < 7) {
            return `${phone[0] ?? ''}****`;
        }

        const prefix = phone.slice(0, 3);
        const suffix = phone.slice(-4);
        return `${prefix}****${suffix}`;
    }

    private async buildFileAccessList(
        fileIds: string[],
    ): Promise<FileAccessInfo[]> {
        if (!fileIds || fileIds.length === 0) {
            return [];
        }

        const files = await Promise.all(
            fileIds.map((id) => this.getFileAccessInfoSafely(id)),
        );

        return files.filter((file): file is FileAccessInfo => Boolean(file));
    }

    private async getFileAccessInfoSafely(
        fileId: string,
    ): Promise<FileAccessInfo | null> {
        try {
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
        } catch (error) {
            this.logger.warn(
                `获取文件预签名URL失败: ${fileId} - ${error instanceof Error ? error.message : error}`,
            );

            return null;
        }
    }

    async getPersonnelDashboardStats(
        personnelId: string,
    ): Promise<ServicePersonnelDashboardStats> {
        if (!personnelId) {
            throw new BadRequestException('服务人员ID不能为空');
        }

        const [completedCount, ratingStats, balanceSnapshot] =
            await Promise.all([
                this.orderRepository.countOrdersByStaff({
                    servicePersonnelId: personnelId,
                    status: 'completed',
                }),
                this.reviewService.getReviewStats(
                    personnelId,
                    ReviewTargetTypeEnum.enum.personnel,
                ),
                this.payService.getUserBalanceSnapshot(personnelId),
            ]);

        const hasRating =
            ratingStats?.totalCount && ratingStats.totalCount > 0
                ? true
                : false;

        const ratingValue = hasRating
            ? parseFloat((ratingStats.averageRating / 100).toFixed(2))
            : 5;

        return {
            userId: personnelId,
            serviceCount: completedCount,
            rating: {
                value: ratingValue,
                display: hasRating ? ratingStats.averageRatingDisplay : '5.00',
                totalReviews: ratingStats?.totalCount ?? 0,
                goodRatePercentage: ratingStats?.goodRatePercentage ?? 0,
            },
            balance: {
                available: balanceSnapshot.available,
                frozen: balanceSnapshot.frozen,
                currency: balanceSnapshot.currency ?? 'CNY',
            },
            generatedAt: new Date(),
        };
    }
}
