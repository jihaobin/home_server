import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { WorkSkillRepository } from './work-skill.repository';
import {
    ServicePersonnel,
    UpsertWorkInfoRequest,
    UpdatePersonnelSkillsRequest,
    SkillUpdateResult,
    UpdateServiceOfferingsRequest,
    ServiceOfferingSubmissionResult,
    UpdateServiceNonSensitiveFieldsRequest,
    WithdrawServiceDraftResponse,
    WorkerServiceItem,
    SubmitServiceOfferingAppealRequest,
    ServiceOfferingAppealSummary,
} from '@repo/types';

@Injectable()
export class WorkSkillService {
    @Inject(WorkSkillRepository)
    private readonly workSkillRepository: WorkSkillRepository;

    /**
     * 创建或更新工作人员信息
     *
     * @param userId 用户ID，由认证中间件提供
     * @param workInfo 工作人员信息
     * @returns 返回创建或更新后的工作人员信息
     */
    async upsertWorkInfo(
        userId: string,
        workInfo: UpsertWorkInfoRequest,
    ): Promise<ServicePersonnel> {
        const fullWorkInfo = {
            userId,
            ...workInfo,
        };

        return (await this.workSkillRepository.upsertWorkInfo(
            fullWorkInfo,
        )) as ServicePersonnel;
    }

    /**
     * 更新工作人员技能
     *
     * @param personnelId 工作人员用户ID
     * @param skillsData 技能更新数据
     * @returns 返回操作统计信息
     */
    async updatePersonnelSkills(
        personnelId: string,
        skillsData: UpdatePersonnelSkillsRequest,
    ): Promise<SkillUpdateResult> {
        return await this.workSkillRepository.updatePersonnelSkills(
            skillsData.serviceIds,
            personnelId,
        );
    }

    /**
     * 获取工作人员的完整信息
     *
     * @param personnelId 工作人员用户ID
     * @returns 返回工作人员信息及其技能列表，不存在时返回null
     */
    async getPersonnelInfo(personnelId: string, serviceId?: string) {
        return await this.workSkillRepository.getPersonnelInfo(
            personnelId,
            serviceId,
        );
    }

    async getPublishedPersonnelInfo(personnelId: string, serviceId?: string) {
        return await this.workSkillRepository.getPublishedPersonnelInfo(
            personnelId,
            serviceId,
        );
    }

    /**
     * 检查服务人员是否存在
     *
     * @param personnelId 服务人员用户ID
     * @returns 存在返回true，不存在返回false
     */
    async isServicePersonnelExists(personnelId: string): Promise<boolean> {
        return await this.workSkillRepository.isServicePersonnelExists(
            personnelId,
        );
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
        return await this.workSkillRepository.upsertPersonnelPricing(
            personnelId,
            serviceId,
            price,
            estimatedDurationMinutes,
            currency,
        );
    }

    /**
     * 获取服务人员的所有定价
     *
     * @param personnelId 服务人员用户ID
     * @returns 返回定价列表
     */
    async getPersonnelPricing(personnelId: string) {
        return await this.workSkillRepository.getPersonnelPricing(personnelId);
    }

    /**
     * 删除服务人员的定价
     *
     * @param personnelId 服务人员用户ID
     * @param serviceId 服务ID
     * @returns 返回是否成功
     */
    async removePersonnelPricing(personnelId: string, serviceId: string) {
        return await this.workSkillRepository.removePersonnelPricing(
            personnelId,
            serviceId,
        );
    }

    async listWorkerServices(
        personnelId: string,
    ): Promise<WorkerServiceItem[]> {
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
    ): Promise<{ serviceId: string; updated: true }> {
        return await this.workSkillRepository.updateServiceNonSensitiveFields(
            personnelId,
            payload,
        );
    }

    async selfTakedownService(
        personnelId: string,
        serviceId: string,
    ): Promise<{ serviceId: string; takenDown: true }> {
        return await this.workSkillRepository.selfTakedownService(
            personnelId,
            serviceId,
        );
    }

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

    async deleteWorkerService(
        personnelId: string,
        serviceId: string,
        confirmName: string,
    ): Promise<{ serviceId: string; deleted: true }> {
        const serviceName = await this.workSkillRepository.getWorkerServiceName(
            personnelId,
            serviceId,
        );

        if (serviceName !== confirmName) {
            throw new BadRequestException('服务名称不匹配');
        }

        return await this.workSkillRepository.deleteWorkerService(
            personnelId,
            serviceId,
        );
    }

    async updateServiceOfferings(
        personnelId: string,
        payload: UpdateServiceOfferingsRequest,
    ): Promise<ServiceOfferingSubmissionResult> {
        if (payload.services.length !== 1) {
            throw new BadRequestException('一次只能提交一个服务进行审核');
        }

        const serviceIds = payload.services.map((service) => service.serviceId);
        const boundServices =
            await this.workSkillRepository.findServicesByIds(serviceIds);
        const requiresCertificates = boundServices.some((service) =>
            service.categoryName?.includes('按摩'),
        );

        if (
            requiresCertificates &&
            !payload.merchantQualificationFileId &&
            !payload.vocationalQualificationFileId
        ) {
            throw new BadRequestException('上门按摩服务需至少上传一种资质证书');
        }

        const draft =
            await this.workSkillRepository.submitServiceOfferingsForReview(
                personnelId,
                payload,
            );

        return {
            draftId: draft.id,
            status: draft.status,
            submittedAt: draft.submittedAt ?? draft.createdAt ?? new Date(),
            message: '已提交审核，等待管理员审核',
        };
    }
}
