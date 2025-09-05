import { Inject, Injectable } from '@nestjs/common';
import { ServiceRepository } from './service.repository';
import { CreateServiceCategory, UpdateServiceCategory } from '@repo/types';

@Injectable()
export class ServiceService {
    @Inject(ServiceRepository)
    private readonly serviceRepository: ServiceRepository;

    async getServiceCategories(dep?: number) {
        return await this.serviceRepository.getServiceCategories(dep);
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
}
