import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq, type SQL, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { files, serviceCategories, services } from 'src/common/database/schema';

type ServiceCategorySelect = typeof serviceCategories.$inferSelect;
type ServiceCategoryInsert = typeof serviceCategories.$inferInsert;

export type AdminServiceCategoryRecord = ServiceCategorySelect & {
    iconFileUrl: string | null;
};

type CategoryRow = ServiceCategorySelect;

@Injectable()
export class AdminServiceCategoriesRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    private mapRow(row: CategoryRow): AdminServiceCategoryRecord {
        return {
            ...row,
            iconFileId: row.iconFileId ?? null,
            description: row.description ?? null,
            parentId: row.parentId ?? null,
            iconFileUrl: null,
        };
    }

    async findAll(): Promise<AdminServiceCategoryRecord[]> {
        const rows = await this.db
            .select({
                id: serviceCategories.id,
                parentId: serviceCategories.parentId,
                name: serviceCategories.name,
                description: serviceCategories.description,
                dep: serviceCategories.dep,
                isActive: serviceCategories.isActive,
                sortOrder: serviceCategories.sortOrder,
                iconFileId: serviceCategories.iconFileId,
            })
            .from(serviceCategories)
            .orderBy(
                asc(serviceCategories.dep),
                asc(serviceCategories.sortOrder),
                asc(serviceCategories.name),
            );

        return rows.map((row) => this.mapRow(row));
    }

    async findById(id: string): Promise<AdminServiceCategoryRecord | null> {
        const [row] = await this.db
            .select({
                id: serviceCategories.id,
                parentId: serviceCategories.parentId,
                name: serviceCategories.name,
                description: serviceCategories.description,
                dep: serviceCategories.dep,
                isActive: serviceCategories.isActive,
                sortOrder: serviceCategories.sortOrder,
                iconFileId: serviceCategories.iconFileId,
            })
            .from(serviceCategories)
            .where(eq(serviceCategories.id, id))
            .limit(1);

        return row ? this.mapRow(row) : null;
    }

    async create(
        data: Omit<ServiceCategoryInsert, 'id'>,
    ): Promise<AdminServiceCategoryRecord> {
        const [created] = await this.db
            .insert(serviceCategories)
            .values(data)
            .returning({
                id: serviceCategories.id,
            });

        if (!created) {
            throw new Error('创建服务分类失败');
        }

        const createdRecord = await this.findById(created.id);
        if (!createdRecord) {
            throw new Error('创建后查询服务分类失败');
        }

        return createdRecord;
    }

    async update(
        id: string,
        data: Partial<ServiceCategoryInsert>,
    ): Promise<AdminServiceCategoryRecord | null> {
        const [updated] = await this.db
            .update(serviceCategories)
            .set(data)
            .where(eq(serviceCategories.id, id))
            .returning({
                id: serviceCategories.id,
            });

        if (!updated) {
            return null;
        }

        return await this.findById(updated.id);
    }

    async delete(id: string): Promise<boolean> {
        const [deleted] = await this.db
            .delete(serviceCategories)
            .where(eq(serviceCategories.id, id))
            .returning({
                id: serviceCategories.id,
            });
        return Boolean(deleted);
    }

    async countChildren(id: string): Promise<number> {
        const [result] = await this.db
            .select({
                value: count(serviceCategories.id),
            })
            .from(serviceCategories)
            .where(eq(serviceCategories.parentId, id));

        return Number(result?.value ?? 0);
    }

    async countServices(id: string): Promise<number> {
        const [result] = await this.db
            .select({
                value: count(services.id),
            })
            .from(services)
            .where(eq(services.categoryId, id));

        return Number(result?.value ?? 0);
    }

    async getNextSortOrder(parentId: string | null): Promise<number> {
        const condition = this.buildParentCondition(parentId);
        const [result] = await this.db
            .select({
                value: sql<number>`COALESCE(MAX(${serviceCategories.sortOrder}), 0)`,
            })
            .from(serviceCategories)
            .where(condition);

        const maxValue = Number(result?.value ?? 0);
        return maxValue + 1;
    }

    private buildParentCondition(parentId: string | null): SQL {
        if (parentId === null) {
            return sql`${serviceCategories.parentId} IS NULL`;
        }
        return eq(serviceCategories.parentId, parentId);
    }

    async hasIconFile(fileId: string): Promise<boolean> {
        const [row] = await this.db
            .select({ id: files.id })
            .from(files)
            .where(eq(files.id, fileId))
            .limit(1);
        return Boolean(row);
    }
}
