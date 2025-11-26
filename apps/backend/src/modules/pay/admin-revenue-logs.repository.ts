import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { AdminRevenueDirection, TransactionType } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    financialTransactions,
    orders,
    users,
    withdrawals,
} from 'src/common/database/schema';

export interface AdminRevenueLogFilters {
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    transactionType?: TransactionType;
    direction?: AdminRevenueDirection;
}

export interface AdminRevenueLogRecord {
    id: string;
    amount: string | null;
    currency: string | null;
    description: string | null;
    referenceId: string | null;
    transactionType: TransactionType;
    createdAt: Date | null;
    metadata: string | null;
    orderId: string | null;
    orderSerial: string | null;
    orderStatus: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    userPhoneNumber: string | null;
    withdrawalId: string | null;
    withdrawalStatus: string | null;
}

@Injectable()
export class AdminRevenueLogsRepository {
    @Inject(DB)
    private readonly db: DbType;

    async findRevenueLogs(filters: AdminRevenueLogFilters) {
        const { page, limit } = filters;
        const offset = (page - 1) * limit;
        const conditions: SQL<unknown>[] = [];

        if (filters.transactionType) {
            conditions.push(
                eq(
                    financialTransactions.transactionType,
                    filters.transactionType,
                ),
            );
        }

        if (filters.startDate) {
            conditions.push(
                gte(financialTransactions.createdAt, filters.startDate),
            );
        }

        if (filters.endDate) {
            conditions.push(
                lte(financialTransactions.createdAt, filters.endDate),
            );
        }

        if (typeof filters.minAmount === 'number') {
            conditions.push(
                sql`ABS(${financialTransactions.amount}) >= ${filters.minAmount}`,
            );
        }

        if (typeof filters.maxAmount === 'number') {
            conditions.push(
                sql`ABS(${financialTransactions.amount}) <= ${filters.maxAmount}`,
            );
        }

        if (filters.direction === 'income') {
            conditions.push(sql`${financialTransactions.amount} >= 0`);
        } else if (filters.direction === 'expense') {
            conditions.push(sql`${financialTransactions.amount} < 0`);
        }

        const whereClause = this.buildWhereClause(conditions);

        const baseListQuery = this.db
            .select({
                id: financialTransactions.id,
                amount: financialTransactions.amount,
                currency: financialTransactions.currency,
                description: financialTransactions.description,
                referenceId: financialTransactions.referenceId,
                transactionType: financialTransactions.transactionType,
                createdAt: financialTransactions.createdAt,
                metadata: financialTransactions.metadata,
                orderId: financialTransactions.orderId,
                orderSerial: orders.orderSerial,
                orderStatus: orders.status,
                userId: financialTransactions.userId,
                userName: users.name,
                userEmail: users.email,
                userPhoneNumber: users.phoneNumber,
                withdrawalId: financialTransactions.withdrawalId,
                withdrawalStatus: withdrawals.status,
            })
            .from(financialTransactions)
            .leftJoin(orders, eq(financialTransactions.orderId, orders.id))
            .leftJoin(users, eq(financialTransactions.userId, users.id))
            .leftJoin(
                withdrawals,
                eq(financialTransactions.withdrawalId, withdrawals.id),
            );
        const listQuery = whereClause
            ? baseListQuery.where(whereClause)
            : baseListQuery;

        const rows = await listQuery
            .orderBy(desc(financialTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        const baseCountQuery = this.db
            .select({
                count: sql<string>`COUNT(*)`,
            })
            .from(financialTransactions);

        const countQuery = whereClause
            ? baseCountQuery.where(whereClause)
            : baseCountQuery;

        const countResult = await countQuery;
        const total = Number(countResult[0]?.count ?? 0);

        return {
            items: rows as AdminRevenueLogRecord[],
            total,
        };
    }

    private buildWhereClause(
        conditions: SQL<unknown>[],
    ): SQL<unknown> | undefined {
        if (conditions.length === 0) {
            return undefined;
        }
        if (conditions.length === 1) {
            return conditions[0];
        }
        return and(...conditions);
    }
}
