import { Inject, Injectable } from "@nestjs/common";
import { WorkSkillRepository } from "./work-skill.repository";
import {
	ServicePersonnel,
	UpsertWorkInfoRequest,
	UpdatePersonnelSkillsRequest,
	SkillUpdateResult,
} from "@repo/types";

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

	/**
	 * 检查服务人员是否存在
	 *
	 * @param personnelId 服务人员用户ID
	 * @returns 存在返回true，不存在返回false
	 */
	async isServicePersonnelExists(personnelId: string): Promise<boolean> {
		return await this.workSkillRepository.isServicePersonnelExists(personnelId);
	}

	/**
	 * 设置或更新服务人员的个人定价
	 *
	 * @param personnelId 服务人员用户ID
	 * @param serviceId 服务ID
	 * @param price 个人定价
	 * @param currency 币种代码
	 * @returns 返回定价记录
	 */
	async upsertPersonnelPricing(
		personnelId: string,
		serviceId: string,
		price: string,
		currency: string = "CNY",
	) {
		return await this.workSkillRepository.upsertPersonnelPricing(
			personnelId,
			serviceId,
			price,
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
}
