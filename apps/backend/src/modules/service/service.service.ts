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
import { FilesService } from '../files/files.service';

@Injectable()
export class ServiceService {
    @Inject(ServiceRepository)
    private readonly serviceRepository: ServiceRepository;

    @Inject(FilesService)
    private readonly filesService: FilesService;

    private async resolveFileUrl(fileId?: string | null) {
        if (!fileId) {
            return null;
        }
        try {
            const file = await this.filesService.getFileAccessInfo(fileId);
            return file.fileUrl;
        } catch {
            return null;
        }
    }

    private async attachIconUrl<
        T extends { iconFileId?: string | null; children?: any },
    >(category: T, options: { deep?: boolean } = {}) {
        const { deep = true } = options;
        const iconFileUrl = await this.resolveFileUrl(category.iconFileId);

        let nextChildren = category.children;
        if (deep && Array.isArray(category.children)) {
            nextChildren = await Promise.all(
                category.children.map((child: any) =>
                    this.attachIconUrl(child, options),
                ),
            );
        }

        return {
            ...category,
            iconFileUrl,
            ...(nextChildren !== undefined ? { children: nextChildren } : {}),
        } as T & { iconFileUrl: string | null };
    }

    private async attachServiceImage<T extends { imageFileId?: string | null }>(
        service: T,
    ) {
        const imageFileUrl = await this.resolveFileUrl(service.imageFileId);
        return { ...service, imageFileUrl } as T & {
            imageFileUrl: string | null;
        };
    }

    async getServiceCategories(dep?: number, keyword?: string) {
        const categories = await this.serviceRepository.getServiceCategories(
            dep,
            keyword,
        );

        if (!Array.isArray(categories)) {
            return categories;
        }

        return await Promise.all(
            categories.map((category) => this.attachIconUrl(category)),
        );
    }

    async createServiceCategory(data: CreateServiceCategory) {
        const created =
            await this.serviceRepository.createServiceCategory(data);
        return await this.attachIconUrl(created, { deep: false });
    }

    async updateServiceCategory(
        id: string,
        data: Partial<UpdateServiceCategory>,
    ) {
        const updated = await this.serviceRepository.updateServiceCategory(
            id,
            data,
        );
        return updated
            ? await this.attachIconUrl(updated, { deep: false })
            : updated;
    }

    async deleteServiceCategory(id: string) {
        const deleted = await this.serviceRepository.deleteServiceCategory(id);
        if (!deleted) {
            throw new Error('删除服务分类失败');
        }
        return { success: true, message: '删除成功' };
    }

    async getServiceCategoryById(id: string) {
        const category =
            await this.serviceRepository.getServiceCategoryById(id);
        return category
            ? await this.attachIconUrl(category, { deep: false })
            : category;
    }
    // ========== 服务项目相关业务方法 ==========

    /**
     * 获取服务项目列表（支持分页和筛选）
     */
    async getServices(params: ServiceListRequest) {
        const result = await this.serviceRepository.getServices(params);
        const itemsWithIconAndImages = await Promise.all(
            result.items.map(async (item) => {
                const categoryWithIcon = await this.attachIconUrl(item, {
                    deep: false,
                });
                const servicesWithImages = await Promise.all(
                    (item.children || []).map((service: any) =>
                        this.attachServiceImage(service),
                    ),
                );
                return { ...categoryWithIcon, children: servicesWithImages };
            }),
        );
        return { ...result, items: itemsWithIconAndImages };
    }

    /**
     * 根据ID获取服务项目详情
     */
    async getServiceById(id: string): Promise<ServiceDetail | null> {
        const detail = await this.serviceRepository.getServiceById(id);
        if (!detail) {
            return null;
        }
        const iconFileUrl = await this.resolveFileUrl(
            detail.category?.iconFileId ?? null,
        );
        const categoryWithIcon = detail.category
            ? ({
                  ...detail.category,
                  iconFileUrl,
              } as ServiceDetail['category'])
            : null;
        const serviceWithImage = await this.attachServiceImage(detail);
        return {
            ...serviceWithImage,
            category: categoryWithIcon,
        };
    }

    /**
     * 创建服务项目
     */
    async createService(data: CreateService): Promise<ServiceDetail> {
        const created = await this.serviceRepository.createService(data);
        const detail = await this.getServiceById(created.id);
        return detail ?? created;
    }

    /**
     * 更新服务项目
     */
    async updateService(
        id: string,
        data: Partial<UpdateService>,
    ): Promise<ServiceDetail | null> {
        const updated = await this.serviceRepository.updateService(id, data);
        if (!updated) {
            return null;
        }
        return await this.getServiceById(id);
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
