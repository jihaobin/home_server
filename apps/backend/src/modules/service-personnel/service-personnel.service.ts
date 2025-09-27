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
	async findMatchedPersonnel(filters: ServicePersonnelFilterRequest & {userId: string}) {
		// 调用Repository层执行复杂的数据查询
		return await this.servicePersonnelRepository.findMatchedPersonnel(filters);
	}
}
