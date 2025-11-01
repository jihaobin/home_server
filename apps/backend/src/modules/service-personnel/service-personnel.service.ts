import { Injectable } from "@nestjs/common";
import type { ServicePersonnelFilterRequest } from "@repo/types";
import { ServicePersonnelRepository } from "./service-personnel.repository";

@Injectable()
export class ServicePersonnelService {
	constructor(
		private readonly servicePersonnelRepository: ServicePersonnelRepository,
	) {}

	/**
	 * 智能匹配服务人员
	 * 根据用户位置、价格区间、服务类型等条件筛选合适的服务人员
	 */
    async findMatchedPersonnel(filters: ServicePersonnelFilterRequest) {
		// 调用Repository层执行复杂的数据查询
		return await this.servicePersonnelRepository.findMatchedPersonnel(filters);
	}

    async getPersonnelServiceDetails({ personnelId, serviceId }: { personnelId: string, serviceId: string }) {
        // 获取服务人员的详细信息和所提供的服务详情
        return await this.servicePersonnelRepository.getPersonnelServiceDetails(personnelId, serviceId);
    }
}
