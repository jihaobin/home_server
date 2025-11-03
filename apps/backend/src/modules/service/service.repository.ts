import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
    CreateService,
    CreateServiceCategory,
    ServiceCategory,
    ServiceCategoryTree,
    ServiceDetail,
    ServiceListRequest,
    ServiceStats,
    UpdateService,
    UpdateServiceCategory,
} from '@repo/types';
import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    lte,
    type SQL,
    sql,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { serviceCategories, services } from 'src/common/database/schema';

@Injectable()
export class ServiceRepository {
    @Inject(DB)
    private readonly db: DbType;

    private async isExist(id: string) {
        const s = sql`SELECT EXISTS (SELECT 1 FROM ${serviceCategories} WHERE ${serviceCategories.id} = ${id}) AS has_service_category`;
        const result = await this.db.execute<{
            has_service_category: boolean;
        }>(s);

        return result.rows[0].has_service_category;
    }

    /**
     * 检查在相同层级，相同父分类下存在相同的分类名称
     */
    private async createIsExist({
        dep,
        name,
        parentId: parendId,
    }: {
        dep: number;
        name: string;
        parentId?: string | null;
    }) {
        const parentId = parendId ? parendId : null;
        const s = sql`SELECT EXISTS (SELECT 1 FROM ${serviceCategories} WHERE ${serviceCategories.dep} = ${dep} AND ${serviceCategories.name} = ${name} AND ${serviceCategories.parentId} = ${parentId}) AS has_create_some_service_categories`;

        const result = await this.db.execute<{
            has_create_some_service_categories: boolean;
        }>(s);

        return result.rows[0].has_create_some_service_categories;
    }

    async getServiceCategories(
        dep?: number,
        keyword?: string,
    ): Promise<ServiceCategoryTree[] | ServiceCategory[]> {
        if (dep) {
            return await this.db
                .select()
                .from(serviceCategories)
                .where(eq(serviceCategories.dep, dep));
        }

        if (keyword) {
            const s = sql`${serviceCategories.name} &@~ ${keyword}`;

            if (dep) {
                s.append(sql`AND ${serviceCategories.dep} = ${dep}`);
            }
            // 模糊匹配
            return await this.db.select().from(serviceCategories).where(s);
        }

        // 返回树状结构的全部分类数据
        const categories = await this.db
            .select()
            .from(serviceCategories)
            .where(eq(serviceCategories.isActive, true));

        // 构建树状结构
        const categoryMap = new Map<string, ServiceCategoryTree>();
        const rootCategories: ServiceCategoryTree[] = [];

        // 先将所有分类转换为树节点格式
        categories.forEach((category) => {
            const treeNode: ServiceCategoryTree = {
                ...category,
                children: [],
            };
            categoryMap.set(category.id, treeNode);
        });

        // 构建父子关系
        categories.forEach((category) => {
            const treeNode = categoryMap.get(category.id)!;

            if (category.parentId) {
                // 有父节点，添加到父节点的children中
                const parent = categoryMap.get(category.parentId);
                if (parent) {
                    parent.children.push(treeNode);
                }
            } else {
                // 没有父节点，是根节点
                rootCategories.push(treeNode);
            }
        });

        return rootCategories;
    }

    async createServiceCategory(
        data: CreateServiceCategory,
    ): Promise<ServiceCategory> {
        // 确保 dep 有值，如果没有提供则默认为 1（根分类）
        const categoryData = {
            ...data,
            dep: data.dep ?? 1,
        };

        if (await this.createIsExist(categoryData)) {
            throw new BadRequestException('该分类下已存在名称相同的子分类');
        }

        const [created] = await this.db
            .insert(serviceCategories)
            .values(categoryData)
            .returning();
        return created;
    }

    async updateServiceCategory(
        id: string,
        data: Partial<UpdateServiceCategory>,
    ): Promise<ServiceCategory | null> {
        if (!(await this.isExist(id))) {
            throw new BadRequestException('当前分类不存在');
        }

        const [updated] = await this.db
            .update(serviceCategories)
            .set(data)
            .where(eq(serviceCategories.id, id))
            .returning();
        return updated || null;
    }

    /**
     *
     * 删除分类
     */
    async deleteServiceCategory(id: string) {
        if (!(await this.isExist(id))) {
            throw new BadRequestException('当前分类不存在');
        }

        const result = await this.db
            .delete(serviceCategories)
            .where(eq(serviceCategories.id, id));
        return result;
    }

    async getServiceCategoryById(id: string): Promise<ServiceCategory | null> {
        const [category] = await this.db
            .select()
            .from(serviceCategories)
            .where(eq(serviceCategories.id, id));
        return category || null;
    }

    // ========== 服务项目相关方法 ==========

    /**
     * 检查服务项目是否存在
     */
    private async isServiceExist(id: string): Promise<boolean> {
        const s = sql`SELECT EXISTS (SELECT 1 FROM ${services} WHERE ${services.id} = ${id}) AS has_service`;
        const result = await this.db.execute<{
            has_service: boolean;
        }>(s);

        return result.rows[0].has_service;
    }

    /**
     * 获取服务项目列表（以分类为单位，支持分页和筛选）
     */
    async getServices({
        categoryId,
        keyword,
        minPrice,
        maxPrice,
        isActive,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    }: ServiceListRequest) {
        // 构建分类查询条件
        const categoryConditions: SQL[] = [
            eq(serviceCategories.isActive, true),
        ];

        if (categoryId) {
            categoryConditions.push(eq(serviceCategories.id, categoryId));
        }

        const categoryWhereCondition =
            categoryConditions.length > 0
                ? and(...categoryConditions)
                : undefined;

        // 先查询所有符合条件的分类
        const allCategories = await this.db
            .select()
            .from(serviceCategories)
            .where(categoryWhereCondition);

        // 构建服务查询条件
        const serviceConditions: SQL[] = [];

        if (keyword) {
            // 使用PGroonga全文搜索
            const searchCondition = sql`${services.name} &@~ ${keyword} OR ${services.description} &@~ ${keyword}`;
            serviceConditions.push(searchCondition);
        }

        // 注意：minPrice和maxPrice筛选已移除，因为价格现在存储在servicePersonnelPricing表中
        // 如果需要按价格筛选，需要join servicePersonnelPricing表

        if (isActive !== undefined) {
            serviceConditions.push(eq(services.isActive, isActive));
        }

        const serviceWhereCondition =
            serviceConditions.length > 0
                ? and(...serviceConditions)
                : undefined;

        // 查询所有符合条件的服务
        const allServices = await this.db
            .select()
            .from(services)
            .where(serviceWhereCondition);

        // 将服务按分类ID分组
        const servicesByCategory = new Map<string, typeof allServices>();
        for (const service of allServices) {
            const categoryId = service.categoryId;
            if (!servicesByCategory.has(categoryId)) {
                servicesByCategory.set(categoryId, []);
            }
            servicesByCategory.get(categoryId)!.push(service);
        }

        // 构建分类带服务的结果，只保留有服务的分类
        const categoriesWithServices = allCategories
            .filter((category) => servicesByCategory.has(category.id))
            .map((category) => {
                const categoryServices =
                    servicesByCategory.get(category.id) || [];

                // 根据sortBy和sortOrder对服务进行排序
                const sortedServices = [...categoryServices].sort((a, b) => {
                    let comparison = 0;
                    switch (sortBy) {
                        case 'name':
                            comparison = a.name.localeCompare(b.name);
                            break;
                        case 'basePrice':
                            // 注意：basePrice排序已移除，因为价格现在在servicePersonnelPricing表中
                            // 如果需要按价格排序，需要join并获取价格数据
                            comparison = a.name.localeCompare(b.name);
                            break;
                        case 'createdAt':
                        default:
                            comparison = a.name.localeCompare(b.name);
                            break;
                    }
                    return sortOrder === 'asc' ? comparison : -comparison;
                });

                return {
                    ...category,
                    children: sortedServices,
                };
            });

        // 应用分页
        const total = categoriesWithServices.length;
        const offset = (page - 1) * limit;
        const paginatedItems = categoriesWithServices.slice(
            offset,
            offset + limit,
        );

        return {
            items: paginatedItems,
            total,
            page,
            limit,
        };
    }

    /**
     * 根据ID获取服务项目详情
     * 注意：basePrice和estimatedDurationMinutes已从service表移除
     * 这些信息现在存储在servicePersonnelPricing表中
     */
    async getServiceById(id: string): Promise<ServiceDetail | null> {
        const [service] = await this.db
            .select({
                id: services.id,
                categoryId: services.categoryId,
                name: services.name,
                description: services.description,
                // basePrice和estimatedDurationMinutes已从service表移除
                currency: services.currency,
                isActive: services.isActive,
                category: {
                    id: serviceCategories.id,
                    parentId: serviceCategories.parentId,
                    name: serviceCategories.name,
                    description: serviceCategories.description,
                    dep: serviceCategories.dep,
                    isActive: serviceCategories.isActive,
                },
            })
            .from(services)
            .innerJoin(
                serviceCategories,
                eq(services.categoryId, serviceCategories.id),
            )
            .where(eq(services.id, id));

        return (service as ServiceDetail | null) || null;
    }

    /**
     * 创建服务项目
     */
    async createService(data: CreateService): Promise<ServiceDetail> {
        // 检查分类是否存在
        if (!(await this.isExist(data.categoryId))) {
            throw new BadRequestException('指定的服务分类不存在');
        }

        const [created] = await this.db
            .insert(services)
            .values(data)
            .returning();

        // 返回包含分类信息的详情
        const serviceDetail = await this.getServiceById(created.id);
        if (!serviceDetail) {
            throw new BadRequestException('创建服务失败');
        }

        return serviceDetail;
    }

    /**
     * 更新服务项目
     */
    async updateService(
        id: string,
        data: Partial<UpdateService>,
    ): Promise<ServiceDetail | null> {
        if (!(await this.isServiceExist(id))) {
            throw new BadRequestException('服务项目不存在');
        }

        // 如果更新分类，检查分类是否存在
        if (data.categoryId && !(await this.isExist(data.categoryId))) {
            throw new BadRequestException('指定的服务分类不存在');
        }

        const [updated] = await this.db
            .update(services)
            .set(data)
            .where(eq(services.id, id))
            .returning();

        if (!updated) {
            return null;
        }

        // 返回包含分类信息的详情
        return await this.getServiceById(id);
    }

    /**
     * 删除服务项目
     */
    async deleteService(id: string): Promise<boolean> {
        if (!(await this.isServiceExist(id))) {
            throw new BadRequestException('服务项目不存在');
        }

        const result = await this.db
            .delete(services)
            .where(eq(services.id, id));

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * 获取服务统计信息
     * 注意：平均价格计算已移除，因为价格现在存储在servicePersonnelPricing表中
     */
    async getServiceStats(): Promise<ServiceStats> {
        // 总服务数量
        const totalServicesResult = await this.db
            .select({ count: count() })
            .from(services);

        // 激活服务数量
        const activeServicesResult = await this.db
            .select({ count: count() })
            .from(services)
            .where(eq(services.isActive, true));

        // 分类数量
        const categoriesCountResult = await this.db
            .select({ count: count() })
            .from(serviceCategories)
            .where(eq(serviceCategories.isActive, true));

        // 平均价格计算已移除，因为价格现在在servicePersonnelPricing表中
        // 如果需要平均价格，应该从servicePersonnelPricing表计算

        return {
            totalServices: totalServicesResult[0].count,
            activeServices: activeServicesResult[0].count,
            categoriesCount: categoriesCountResult[0].count,
            // averagePrice: 0, // 暂时返回0，需要从servicePersonnelPricing表计算
        };
    }
}
