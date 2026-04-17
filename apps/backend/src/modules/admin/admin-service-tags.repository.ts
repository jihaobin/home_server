import { Inject, Injectable } from '@nestjs/common';
import type { AdminServiceTag, ServiceTagDomain } from '@repo/types';
import {
    and,
    asc,
    count,
    eq,
    ilike,
    or,
    type SQL,
} from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { serviceTags, services } from 'src/common/database/schema';

type ServiceTagSelect = typeof serviceTags.$inferSelect;
type ServiceTagInsert = typeof serviceTags.$inferInsert;

type ServiceTagListRow = {
    id: string;
    name: string;
    slug: string;
    domain: string;
    sortOrder: number;
    isActive: boolean;
    description: string | null;
    serviceCount: number | string | bigint;
};

export type AdminServiceTagRecord = ServiceTagSelect & {
    description: string | null;
};

type FindAllParams = {
    domain?: ServiceTagDomain;
    keyword?: string;
    status?: 'all' | 'active' | 'inactive';
};

@Injectable()
export class AdminServiceTagsRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async findAll(params: FindAllParams): Promise<AdminServiceTag[]> {
        const conditions: SQL[] = [];

        if (params.domain) {
            conditions.push(eq(serviceTags.domain, params.domain));
        }

        const keyword = params.keyword?.trim();
        if (keyword) {
            conditions.push(
                or(
                    ilike(serviceTags.name, `%${keyword}%`),
                    ilike(serviceTags.slug, `%${keyword}%`),
                ) as SQL,
            );
        }

        if (params.status === 'active') {
            conditions.push(eq(serviceTags.isActive, true));
        } else if (params.status === 'inactive') {
            conditions.push(eq(serviceTags.isActive, false));
        }

        const rows = await this.db
            .select({
                id: serviceTags.id,
                name: serviceTags.name,
                slug: serviceTags.slug,
                domain: serviceTags.domain,
                sortOrder: serviceTags.sortOrder,
                isActive: serviceTags.isActive,
                description: serviceTags.description,
                serviceCount: count(services.id),
            })
            .from(serviceTags)
            .leftJoin(services, eq(services.serviceTagId, serviceTags.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(
                serviceTags.id,
                serviceTags.name,
                serviceTags.slug,
                serviceTags.domain,
                serviceTags.sortOrder,
                serviceTags.isActive,
                serviceTags.description,
            )
            .orderBy(asc(serviceTags.sortOrder), asc(serviceTags.id));

        return rows.map((row) => this.mapListRow(row));
    }

    async findById(id: string): Promise<AdminServiceTagRecord | null> {
        const [row] = await this.db
            .select()
            .from(serviceTags)
            .where(eq(serviceTags.id, id))
            .limit(1);

        return row ? this.mapRecord(row) : null;
    }

    async findByDomainAndSlug(
        domain: ServiceTagDomain,
        slug: string,
    ): Promise<AdminServiceTagRecord | null> {
        const [row] = await this.db
            .select()
            .from(serviceTags)
            .where(
                and(eq(serviceTags.domain, domain), eq(serviceTags.slug, slug)),
            )
            .limit(1);

        return row ? this.mapRecord(row) : null;
    }

    async countReferencedServices(id: string): Promise<number> {
        const [result] = await this.db
            .select({
                value: count(services.id),
            })
            .from(services)
            .where(eq(services.serviceTagId, id));

        return Number(result?.value ?? 0);
    }

    async create(
        data: Omit<ServiceTagInsert, 'id'>,
    ): Promise<AdminServiceTagRecord> {
        const [created] = await this.db
            .insert(serviceTags)
            .values(data)
            .returning({
                id: serviceTags.id,
            });

        if (!created) {
            throw new Error('创建服务标签失败');
        }

        const createdRecord = await this.findById(created.id);
        if (!createdRecord) {
            throw new Error('创建后查询服务标签失败');
        }

        return createdRecord;
    }

    async update(
        id: string,
        data: Partial<ServiceTagInsert>,
    ): Promise<AdminServiceTagRecord | null> {
        const [updated] = await this.db
            .update(serviceTags)
            .set(data)
            .where(eq(serviceTags.id, id))
            .returning({
                id: serviceTags.id,
            });

        if (!updated) {
            return null;
        }

        return await this.findById(updated.id);
    }

    async delete(id: string): Promise<boolean> {
        const [deleted] = await this.db
            .delete(serviceTags)
            .where(eq(serviceTags.id, id))
            .returning({
                id: serviceTags.id,
            });

        return Boolean(deleted);
    }

    private mapRecord(row: ServiceTagSelect): AdminServiceTagRecord {
        return {
            ...row,
            description: row.description ?? null,
        };
    }

    private mapListRow(row: ServiceTagListRow): AdminServiceTag {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            domain: row.domain as ServiceTagDomain,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
            description: row.description ?? null,
            serviceCount: Number(row.serviceCount ?? 0),
        };
    }
}
