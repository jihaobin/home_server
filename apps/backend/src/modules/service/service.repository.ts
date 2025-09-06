import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import { serviceCategories } from 'src/common/database/schema';
import { CreateServiceCategory, UpdateServiceCategory } from '@repo/types';

// 定义服务分类基础类型
type ServiceCategory = {
    id: string;
    parentId: string | null;
    name: string;
    dep: number;
    description: string | null;
    isActive: boolean | null;
};

// 定义树状结构的服务分类类型
type ServiceCategoryTree = ServiceCategory & {
    children: ServiceCategoryTree[];
};

@Injectable()
export class ServiceRepository {
    @Inject(DB)
    private readonly db: DbType;

    private async isExist(id: string) {
        console.log('userId:', id);
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
        parentId?: string;
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
}
