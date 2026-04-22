import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { AdminMerchantJoinRequestContactStatus } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { merchantJoinRequests } from 'src/common/database/schema';

export type MerchantJoinRequestRecord = typeof merchantJoinRequests.$inferSelect;

export type AdminMerchantJoinRequestListFilters = {
    page: number;
    limit: number;
    keyword?: string;
    contactStatus?: AdminMerchantJoinRequestContactStatus;
};

export type AdminMerchantJoinRequestListResult = {
    items: MerchantJoinRequestRecord[];
    total: number;
    page: number;
    limit: number;
};

@Injectable()
export class AdminMerchantJoinRequestsRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async findAll(
        filters: AdminMerchantJoinRequestListFilters,
    ): Promise<AdminMerchantJoinRequestListResult> {
        const page = Math.max(filters.page, 1);
        const limit = Math.max(filters.limit, 1);
        const offset = (page - 1) * limit;
        const where = this.buildWhereClause(filters);

        const baseQuery = this.db.select().from(merchantJoinRequests);
        const countQuery = this.db.$count(merchantJoinRequests, where);

        const items = await (where ? baseQuery.where(where) : baseQuery)
            .orderBy(desc(merchantJoinRequests.createdAt), desc(merchantJoinRequests.id))
            .limit(limit)
            .offset(offset);

        const total = await countQuery;

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async findById(id: string): Promise<MerchantJoinRequestRecord | null> {
        const [record] = await this.db
            .select()
            .from(merchantJoinRequests)
            .where(eq(merchantJoinRequests.id, id))
            .limit(1);

        return record ?? null;
    }

    async update(
        id: string,
        input: {
            isContacted?: boolean;
            adminRemark?: string | null;
            contactedAt?: Date | null;
        },
    ): Promise<MerchantJoinRequestRecord | null> {
        const [updated] = await this.db
            .update(merchantJoinRequests)
            .set({
                isContacted: input.isContacted,
                adminRemark: input.adminRemark,
                contactedAt: input.contactedAt,
                updatedAt: new Date(),
            })
            .where(eq(merchantJoinRequests.id, id))
            .returning();

        return updated ?? null;
    }

    async findAllForExport(): Promise<MerchantJoinRequestRecord[]> {
        return await this.db
            .select()
            .from(merchantJoinRequests)
            .orderBy(desc(merchantJoinRequests.createdAt), desc(merchantJoinRequests.id));
    }

    private buildWhereClause(
        filters: AdminMerchantJoinRequestListFilters,
    ): SQL | undefined {
        const conditions: SQL[] = [];

        if (filters.keyword?.trim()) {
            const keyword = `%${filters.keyword.trim()}%`;
            const keywordCondition = or(
                ilike(merchantJoinRequests.merchantName, keyword),
                ilike(merchantJoinRequests.phone, keyword),
                ilike(merchantJoinRequests.intentCity, keyword),
            );

            if (keywordCondition) {
                conditions.push(keywordCondition);
            }
        }

        if (filters.contactStatus === 'contacted') {
            conditions.push(eq(merchantJoinRequests.isContacted, true));
        }

        if (filters.contactStatus === 'uncontacted') {
            conditions.push(eq(merchantJoinRequests.isContacted, false));
        }

        if (!conditions.length) {
            return undefined;
        }

        return and(...conditions);
    }
}
