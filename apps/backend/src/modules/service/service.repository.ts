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
import { and, asc, count, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    orders,
    serviceCategories,
    serviceTags,
    services,
} from 'src/common/database/schema';

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

    private async getCategoryDescendantIds(
        categoryId: string,
    ): Promise<string[]> {
        const normalized = categoryId.trim();
        if (!normalized) return [];

        const s = sql`
            WITH RECURSIVE category_tree AS (
                SELECT id
                FROM service_categories
                WHERE id = ${normalized}

                UNION ALL

                SELECT sc.id
                FROM service_categories sc
                INNER JOIN category_tree ct ON sc.parent_id = ct.id
            )
            SELECT id FROM category_tree
        `;

        const result = await this.db.execute<{ id: string }>(s);
        return result.rows.map((r) => r.id);
    }

    async getServiceCategories(
        dep?: number,
        keyword?: string,
    ): Promise<ServiceCategoryTree[] | ServiceCategory[]> {
        if (dep) {
            return await this.db
                .select()
                .from(serviceCategories)
                .where(eq(serviceCategories.dep, dep))
                .orderBy(
                    asc(serviceCategories.sortOrder),
                    asc(serviceCategories.name),
                );
        }

        if (keyword) {
            const s = sql`${serviceCategories.name} &@~ ${keyword}`;

            if (dep) {
                s.append(sql`AND ${serviceCategories.dep} = ${dep}`);
            }
            // 模糊匹配
            return await this.db
                .select()
                .from(serviceCategories)
                .where(s)
                .orderBy(
                    asc(serviceCategories.dep),
                    asc(serviceCategories.sortOrder),
                    asc(serviceCategories.name),
                );
        }

        // 返回树状结构分类（仅包含 services.category_id 关联到的分类 + 它们的祖先链）。
        // 说明：home/base 需要的“父分类/子分类”不应该由 dep 推断，而应该由真实上架服务所覆盖到的分类集合推导出来。
        // 规则：如果某个叶子分类的任一祖先分类被停用（is_active=false）或缺失，则该叶子分类及其链路不应展示（不做“提升为根节点”的兜底）。
        const categories = await this.db
            .select()
            .from(serviceCategories)
            .orderBy(
                asc(serviceCategories.dep),
                asc(serviceCategories.sortOrder),
                asc(serviceCategories.name),
            );

        const serviceCategoryIdRows = await this.db.execute<{
            category_id: string;
        }>(sql`
            SELECT DISTINCT category_id
            FROM services
            WHERE is_active = true
        `);

        const categoryById = new Map(
            categories.map((category) => [category.id, category]),
        );

        const includedCategoryIds = new Set<string>();
        for (const row of serviceCategoryIdRows.rows) {
            const chain: string[] = [];
            let current = categoryById.get(row.category_id);

            // category 不存在：跳过
            if (!current) {
                continue;
            }

            // 叶子分类停用：跳过
            if (current.isActive === false) {
                continue;
            }

            // 向上补齐祖先链；任一祖先缺失或停用 -> 整条链不纳入
            let valid = true;
            while (current) {
                if (current.isActive === false) {
                    valid = false;
                    break;
                }
                chain.push(current.id);

                if (!current.parentId) {
                    break;
                }
                const next = categoryById.get(current.parentId);
                if (!next) {
                    valid = false;
                    break;
                }
                current = next;
            }

            if (!valid) {
                continue;
            }

            for (const id of chain) {
                includedCategoryIds.add(id);
            }
        }

        const filteredCategories = categories.filter(
            (category) =>
                category.isActive === true &&
                includedCategoryIds.has(category.id),
        );

        // 构建树状结构
        const categoryMap = new Map<string, ServiceCategoryTree>();
        const rootCategories: ServiceCategoryTree[] = [];

        filteredCategories.forEach((category) => {
            categoryMap.set(category.id, {
                ...category,
                children: [],
            });
        });

        filteredCategories.forEach((category) => {
            const treeNode = categoryMap.get(category.id)!;

            if (category.parentId) {
                // 祖先链要求完整且启用，所以这里父节点缺失时直接丢弃（不提升为根）。
                const parent = categoryMap.get(category.parentId);
                if (!parent) {
                    return;
                }
                parent.children.push(treeNode);
                return;
            }

            rootCategories.push(treeNode);
        });

        return rootCategories;
    }

    async createServiceCategory(
        data: CreateServiceCategory,
    ): Promise<ServiceCategory> {
        // 暂时仅允许创建 dep=1 的一级分类。
        // 后续会考虑移除 dep/parent_id 以消除父子关系。
        if (data.parentId) {
            throw new BadRequestException('暂不支持创建子分类');
        }
        if (data.dep !== undefined && data.dep !== 1) {
            throw new BadRequestException('暂不支持创建非一级分类');
        }

        // 确保 dep 有值，如果没有提供则默认为 1（根分类）
        const categoryData = {
            ...data,
            dep: data.dep ?? 1,
            sortOrder: data.sortOrder ?? 0,
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

    async getActiveServicesByCategoryIds(categoryIds: string[]) {
        if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
            return [] as (typeof services.$inferSelect)[];
        }

        return await this.db
            .select()
            .from(services)
            .where(
                and(
                    eq(services.isActive, true),
                    inArray(services.categoryId, categoryIds),
                ),
            );
    }

    async searchActiveServicesByKeyword(keyword: string, limit = 10) {
        const normalizedKeyword = keyword.trim();
        if (!normalizedKeyword) {
            return [];
        }

        return await this.db
            .select({
                id: services.id,
                name: services.name,
                categoryId: services.categoryId,
            })
            .from(services)
            .where(
                and(
                    eq(services.isActive, true),
                    sql`${services.name} &@~ ${normalizedKeyword} OR ${services.description} &@~ ${normalizedKeyword}`,
                ),
            )
            .orderBy(asc(services.name), asc(services.id))
            .limit(limit);
    }

    async findExactActiveServiceByName(keyword: string) {
        const normalizedKeyword = keyword.trim().replace(/\s+/g, ' ');
        if (!normalizedKeyword) {
            return null;
        }

        const rows = await this.db
            .select({
                id: services.id,
                name: services.name,
                categoryId: services.categoryId,
            })
            .from(services)
            .where(
                and(
                    eq(services.isActive, true),
                    sql`regexp_replace(trim(${services.name}), '\s+', ' ', 'g') = ${normalizedKeyword}`,
                ),
            )
            .limit(2);

        return rows.length === 1 ? rows[0] : null;
    }

    async findActiveServiceById(serviceId: string) {
        const [service] = await this.db
            .select({
                id: services.id,
                name: services.name,
                categoryId: services.categoryId,
            })
            .from(services)
            .where(and(eq(services.id, serviceId), eq(services.isActive, true)))
            .limit(1);

        return service ?? null;
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

    private async hasOrdersByServiceId(id: string): Promise<boolean> {
        const [result] = await this.db
            .select({ id: orders.id })
            .from(orders)
            .where(eq(orders.serviceId, id))
            .limit(1);

        return Boolean(result);
    }

    /**
     * 获取服务项目列表（以分类为单位，支持分页和筛选）
     */
    async getServices({
        categoryId,
        serviceTagId,
        keyword,
        isActive,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    }: ServiceListRequest) {
        // 构建服务查询条件
        const serviceConditions: SQL[] = [];

        if (keyword) {
            // 使用PGroonga全文搜索
            // 1. 先找出匹配搜索词的分类（包括父分类）
            const matchedCategoryIds = await this.db
                .execute<{ id: string }>(
                    sql`
        WITH RECURSIVE category_matches AS (
            -- 直接匹配关键词的分类
            SELECT id, parent_id
            FROM service_categories
            WHERE name &@~ ${keyword} AND is_active = true

            UNION

            -- 匹配分类的子分类（递归）
            SELECT sc.id, sc.parent_id
            FROM service_categories sc
            INNER JOIN category_matches cm ON sc.parent_id = cm.id
            WHERE sc.is_active = true
        )
        SELECT id FROM category_matches
    `,
                )
                .then((r) => r.rows.map((r) => r.id));

            // 2. 构建OR条件：服务名称/描述 匹配，或 分类ID在匹配集合中
            const searchCondition = sql`
        ${services.name} &@~ ${keyword}
        OR ${services.description} &@~ ${keyword}
        ${
            matchedCategoryIds.length > 0
                ? sql`OR ${services.categoryId} IN (${sql.join(matchedCategoryIds)})`
                : sql``
        }
    `;
            serviceConditions.push(searchCondition);
        }

        // 注意：minPrice和maxPrice筛选已移除，因为价格现在存储在servicePersonnelPricing表中
        // 如果需要按价格筛选，需要join servicePersonnelPricing表

        if (isActive !== undefined) {
            serviceConditions.push(eq(services.isActive, isActive));
        }

        if (serviceTagId) {
            serviceConditions.push(eq(services.serviceTagId, serviceTagId));
        }

        // categoryId：聚合 category 子树下的全部服务，返回单个分类节点（前端取 items[0].children 做 Tab）
        if (categoryId) {
            const [rootCategory] = await this.db
                .select()
                .from(serviceCategories)
                .where(eq(serviceCategories.id, categoryId))
                .limit(1);

            if (!rootCategory) {
                return { items: [], total: 0, page, limit };
            }

            const descendantIds =
                await this.getCategoryDescendantIds(categoryId);
            if (descendantIds.length === 0) {
                return { items: [], total: 0, page, limit };
            }

            serviceConditions.push(inArray(services.categoryId, descendantIds));

            const serviceWhereCondition =
                serviceConditions.length > 0
                    ? and(...serviceConditions)
                    : undefined;

            const allServices = await this.db
                .select()
                .from(services)
                .where(serviceWhereCondition);

            const sortedServices = [...allServices].sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'name':
                        comparison = a.name.localeCompare(b.name);
                        break;
                    case 'createdAt':
                    default:
                        comparison = a.name.localeCompare(b.name);
                        break;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });

            const total = 1;
            const offset = (page - 1) * limit;
            const items =
                offset === 0
                    ? [{ ...rootCategory, children: sortedServices }]
                    : [];

            return {
                items,
                total,
                page,
                limit,
            };
        }

        const serviceWhereCondition =
            serviceConditions.length > 0
                ? and(...serviceConditions)
                : undefined;

        // 构建分类查询条件
        const categoryWhereCondition = and(
            eq(serviceCategories.isActive, true),
        );

        // 先查询所有符合条件的分类
        const allCategories = await this.db
            .select()
            .from(serviceCategories)
            .where(categoryWhereCondition);

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

        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        return {
            items: paginatedItems,
            total,
            page,
            limit,
        };
    }

    /**
     * 根据ID获取服务项目详情
     * 注意：定价、时长、币种已从service表移除
     * 价格与时长信息存储在servicePersonnelPricing表中
     */
    async getServiceById(id: string): Promise<ServiceDetail | null> {
        const [service] = await this.db
            .select({
                id: services.id,
                categoryId: services.categoryId,
                serviceTagId: services.serviceTagId,
                name: services.name,
                description: services.description,
                imageFileId: services.imageFileId,
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

    async findServiceTagById(id: string) {
        const [tag] = await this.db
            .select({
                id: serviceTags.id,
                isActive: serviceTags.isActive,
                domain: serviceTags.domain,
            })
            .from(serviceTags)
            .where(eq(serviceTags.id, id))
            .limit(1);

        return tag ?? null;
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

        const hasRelatedOrders = await this.hasOrdersByServiceId(id);

        if (hasRelatedOrders) {
            throw new BadRequestException('该服务已关联订单，无法删除');
        }

        try {
            const result = await this.db
                .delete(services)
                .where(eq(services.id, id));

            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error
            ) {
                const dbError = error as {
                    code?: string;
                    constraint?: string;
                };

                if (dbError.code === '23503') {
                    if (
                        dbError.constraint ===
                        'orders_service_id_services_id_fk'
                    ) {
                        throw new BadRequestException(
                            '该服务已关联订单，无法删除',
                        );
                    }

                    throw new BadRequestException(
                        '该服务已被其他业务数据引用，无法删除',
                    );
                }
            }

            throw error;
        }
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
