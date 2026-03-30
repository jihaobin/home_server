import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PaymentMethod, WithdrawalStatus } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { users } from 'src/common/database/schema/auth-user';
import { withdrawals } from 'src/common/database/schema/financial';

export interface AdminWithdrawalFilters {
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    status?: WithdrawalStatus;
    method?: PaymentMethod;
    keyword?: string;
}

export interface AdminWithdrawalRecord {
    id: string;
    amount: string | null;
    currency: string | null;
    status: string;
    method: string;
    payeeAccount: string;
    payeeAccountType: string;
    payeeName: string | null;
    remark: string | null;
    reviewNote: string | null;
    requestedAt: Date | null;
    reviewedAt: Date | null;
    processedAt: Date | null;
    payoutReferenceId: string | null;
    providerState: string | null;
    providerAppId: string | null;
    providerBillNo: string | null;
    providerPackageInfo: string | null;
    providerMeta: Record<string, unknown> | null;
    failureReason: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    userPhoneNumber: string | null;
    reviewerId: string | null;
    reviewerName: string | null;
}

@Injectable()
export class AdminWithdrawalsRepository {
    @Inject(DB)
    private readonly db: DbType;

    async findWithdrawals(filters: AdminWithdrawalFilters) {
        const page = Math.max(filters.page, 1);
        const limit = Math.max(filters.limit, 1);
        const offset = (page - 1) * limit;
        const where = this.buildWhereClause(filters);
        const reviewer = alias(users, 'withdrawal_reviewer');

        const baseQuery = this.db
            .select({
                id: withdrawals.id,
                amount: withdrawals.amount,
                currency: withdrawals.currency,
                status: withdrawals.status,
                method: withdrawals.method,
                payeeAccount: withdrawals.payeeAccount,
                payeeAccountType: withdrawals.payeeAccountType,
                payeeName: withdrawals.payeeName,
                remark: withdrawals.remark,
                reviewNote: withdrawals.reviewNote,
                requestedAt: withdrawals.requestedAt,
                reviewedAt: withdrawals.reviewedAt,
                processedAt: withdrawals.processedAt,
                payoutReferenceId: withdrawals.payoutReferenceId,
                providerState: withdrawals.providerState,
                providerAppId: withdrawals.providerAppId,
                providerBillNo: withdrawals.providerBillNo,
                providerPackageInfo: withdrawals.providerPackageInfo,
                providerMeta: withdrawals.providerMeta,
                failureReason: withdrawals.failureReason,
                userId: users.id,
                userName: users.name,
                userEmail: users.email,
                userPhoneNumber: users.phoneNumber,
                reviewerId: reviewer.id,
                reviewerName: reviewer.name,
            })
            .from(withdrawals)
            .leftJoin(users, eq(users.id, withdrawals.userId))
            .leftJoin(reviewer, eq(reviewer.id, withdrawals.reviewedByAdminId));

        const rowsQuery =
            where !== undefined ? baseQuery.where(where) : baseQuery;
        const rows = await rowsQuery
            .orderBy(desc(withdrawals.requestedAt))
            .limit(limit)
            .offset(offset);

        const countBaseQuery = this.db
            .select({ value: sql<number>`COUNT(*)::int` })
            .from(withdrawals)
            .leftJoin(users, eq(users.id, withdrawals.userId));

        const countQuery =
            where !== undefined ? countBaseQuery.where(where) : countBaseQuery;
        const countRows = await countQuery;
        const total = countRows[0]?.value ?? 0;

        return { items: rows as AdminWithdrawalRecord[], total };
    }

    async findWithdrawalById(id: string) {
        const reviewer = alias(users, 'withdrawal_reviewer');
        const rows = await this.db
            .select({
                id: withdrawals.id,
                amount: withdrawals.amount,
                currency: withdrawals.currency,
                status: withdrawals.status,
                method: withdrawals.method,
                payeeAccount: withdrawals.payeeAccount,
                payeeAccountType: withdrawals.payeeAccountType,
                payeeName: withdrawals.payeeName,
                remark: withdrawals.remark,
                reviewNote: withdrawals.reviewNote,
                requestedAt: withdrawals.requestedAt,
                reviewedAt: withdrawals.reviewedAt,
                processedAt: withdrawals.processedAt,
                payoutReferenceId: withdrawals.payoutReferenceId,
                providerState: withdrawals.providerState,
                providerAppId: withdrawals.providerAppId,
                providerBillNo: withdrawals.providerBillNo,
                providerPackageInfo: withdrawals.providerPackageInfo,
                providerMeta: withdrawals.providerMeta,
                failureReason: withdrawals.failureReason,
                userId: users.id,
                userName: users.name,
                userEmail: users.email,
                userPhoneNumber: users.phoneNumber,
                reviewerId: reviewer.id,
                reviewerName: reviewer.name,
            })
            .from(withdrawals)
            .leftJoin(users, eq(users.id, withdrawals.userId))
            .leftJoin(reviewer, eq(reviewer.id, withdrawals.reviewedByAdminId))
            .where(eq(withdrawals.id, id))
            .limit(1);

        return rows[0] as AdminWithdrawalRecord | undefined;
    }

    private buildWhereClause(filters: AdminWithdrawalFilters): SQL | undefined {
        const conditions: SQL[] = [];

        if (filters.startDate) {
            conditions.push(gte(withdrawals.requestedAt, filters.startDate));
        }

        if (filters.endDate) {
            conditions.push(lte(withdrawals.requestedAt, filters.endDate));
        }

        if (typeof filters.minAmount === 'number') {
            conditions.push(sql`${withdrawals.amount} >= ${filters.minAmount}`);
        }

        if (typeof filters.maxAmount === 'number') {
            conditions.push(sql`${withdrawals.amount} <= ${filters.maxAmount}`);
        }

        if (filters.status) {
            conditions.push(eq(withdrawals.status, filters.status));
        }

        if (filters.method) {
            conditions.push(eq(withdrawals.method, filters.method));
        }

        if (filters.keyword) {
            const keyword = this.like(filters.keyword);
            const keywordCondition = or(
                ilike(users.name, keyword),
                ilike(users.email, keyword),
                ilike(users.phoneNumber, keyword),
                ilike(withdrawals.payeeAccount, keyword),
            );

            if (keywordCondition) {
                conditions.push(keywordCondition);
            }
        }

        if (conditions.length === 0) {
            return undefined;
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        return and(...conditions);
    }

    private like(value: string) {
        return `%${value}%`;
    }
}
