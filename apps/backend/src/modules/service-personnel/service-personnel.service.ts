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
} from '@repo/types';
import { ServicePersonnelRepository } from './service-personnel.repository';
import { WorkSkillService } from '../work-skill/work-skill.service';
import { FilesService } from '../files/files.service';
import { OrderRepository } from '../order/order.reposityro';
import { PayService } from '../pay/pay.service';
import { ReviewService } from '../review/review.service';
import { ReviewTargetTypeEnum } from '@repo/types';

type RawPersonnelSkill = {
    id: string;
    name: string;
    description?: string | null;
    currency: string;
    isActive: boolean;
    personnelDescription?: string | null;
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

    /**
     * 智能匹配服务人员
     * 根据用户位置、价格区间、服务类型等条件筛选合适的服务人员
     */
    async findMatchedPersonnel(filters: ServicePersonnelFilterRequest) {
        // 调用Repository层执行复杂的数据查询
        return await this.servicePersonnelRepository.findMatchedPersonnel(
            filters,
        );
    }

    async getPersonnelServiceDetails({
        personnelId,
        serviceId,
    }: {
        personnelId: string;
        serviceId: string;
    }) {
        // 获取服务人员的详细信息和所提供的服务详情
        return await this.servicePersonnelRepository.getPersonnelServiceDetails(
            personnelId,
            serviceId,
        );
    }

    /**
     * 聚合获取服务人员资料，包含基本信息、可提供的服务、脱敏手机号以及文件预签名URL
     */
    async getPersonnelProfile(
        personnelId: string,
    ): Promise<ServicePersonnelProfile> {
        const personnel =
            await this.workSkillService.getPersonnelInfo(personnelId);
        if (!personnel) {
            throw new NotFoundException('服务人员不存在');
        }
        const userInfo =
            await this.servicePersonnelRepository.getPersonnelContactInfo(
                personnelId,
            );
        if (!userInfo) {
            throw new NotFoundException('服务人员不存在');
        }

        const avatar = userInfo.image
            ? await this.getFileAccessInfoSafely(userInfo.image)
            : null;
        const services = (personnel.skills ?? []).map(
            (skill: RawPersonnelSkill) => {
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

                return {
                    serviceId: skill.id,
                    serviceName: skill.name,
                    serviceDescription: skill.description ?? null,
                    personnelDescription: skill.personnelDescription ?? null,
                    currency: skill.currency,
                    isActive: skill.isActive,
                    specifications: specs,
                };
            },
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

        const qualificationImageIds =
            (personnel as { qualificationImageIds?: string[] })
                .qualificationImageIds ?? [];

        const qualificationImages = await this.buildFileAccessList(
            qualificationImageIds,
        );

        return {
            userId: personnel.userId,
            name: userInfo.name ?? null,
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
            avatar,
            services,
            qualificationImages,
            location,
        };
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
