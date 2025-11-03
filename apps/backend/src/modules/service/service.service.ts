import { Inject, Injectable } from '@nestjs/common';
import { ServiceRepository } from './service.repository';
import {
    CreateServiceCategory,
    UpdateServiceCategory,
    CreateService,
    UpdateService,
    ServiceListRequest,
    ServiceDetail,
    ServiceStats,
} from '@repo/types';

@Injectable()
export class ServiceService {
    @Inject(ServiceRepository)
    private readonly serviceRepository: ServiceRepository;

    async getServiceCategories(dep?: number, keyword?: string) {
        return await this.serviceRepository.getServiceCategories(dep, keyword);
    }

    async createServiceCategory(data: CreateServiceCategory) {
        return await this.serviceRepository.createServiceCategory(data);
    }

    async updateServiceCategory(
        id: string,
        data: Partial<UpdateServiceCategory>,
    ) {
        return await this.serviceRepository.updateServiceCategory(id, data);
    }

    async deleteServiceCategory(id: string) {
        const deleted = await this.serviceRepository.deleteServiceCategory(id);
        if (!deleted) {
            throw new Error('删除服务分类失败');
        }
        return { success: true, message: '删除成功' };
    }

    async getServiceCategoryById(id: string) {
        return await this.serviceRepository.getServiceCategoryById(id);
    }

    // ========== 服务项目相关业务方法 ==========

    /**
     * 获取服务项目列表（支持分页和筛选）
     */
    async getServices(params: ServiceListRequest) {
        return await this.serviceRepository.getServices(params);
    }

    /**
     * 根据ID获取服务项目详情
     */
    async getServiceById(id: string): Promise<ServiceDetail | null> {
        return await this.serviceRepository.getServiceById(id);
    }

    /**
     * 创建服务项目
     */
    async createService(data: CreateService): Promise<ServiceDetail> {
        return await this.serviceRepository.createService(data);
    }

    /**
     * 更新服务项目
     */
    async updateService(
        id: string,
        data: Partial<UpdateService>,
    ): Promise<ServiceDetail | null> {
        return await this.serviceRepository.updateService(id, data);
    }

    /**
     * 删除服务项目
     */
    async deleteService(
        id: string,
    ): Promise<{ success: boolean; message: string }> {
        const deleted = await this.serviceRepository.deleteService(id);
        if (!deleted) {
            throw new Error('删除服务项目失败');
        }
        return { success: true, message: '删除成功' };
    }

    /**
     * 获取服务统计信息
     */
    async getServiceStats(): Promise<ServiceStats> {
        return await this.serviceRepository.getServiceStats();
    }
}
