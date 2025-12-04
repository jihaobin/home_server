import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    financialTransactions,
    orders,
    servicePersonnel,
    users,
} from 'src/common/database/schema';

type DateRange = {
    start: Date;
    end: Date;
};

type RevenueTransactionType =
    (typeof financialTransactions.transactionType.enumValues)[number];

@Injectable()
export class AdminDashboardRepository {
    @Inject(DB)
    private readonly db: DbType;

    private readonly revenueTransactionTypes: RevenueTransactionType[] = [
        'payment_received',
        'refund_paid',
    ];

    async countActiveUsers(): Promise<number> {
        const result = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(users)
            .where(eq(users.isActive, true));

        return result[0]?.count ?? 0;
    }

    async countServicePersonnel(): Promise<number> {
        const result = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(servicePersonnel)
            .innerJoin(users, eq(servicePersonnel.userId, users.id))
            .where(eq(users.isActive, true));

        return result[0]?.count ?? 0;
    }

    async sumRevenue(range?: DateRange): Promise<number> {
        const conditions = [
            inArray(
                financialTransactions.transactionType,
                this.revenueTransactionTypes,
            ),
        ];

        if (range) {
            conditions.push(
                gte(financialTransactions.createdAt, range.start),
                lte(financialTransactions.createdAt, range.end),
            );
        }

        const result = await this.db
            .select({
                amount: sql<string>`COALESCE(SUM(${financialTransactions.amount}), '0')`,
            })
            .from(financialTransactions)
            .where(and(...conditions));

        return this.toNumber(result[0]?.amount);
    }

    async countOrders(range: DateRange): Promise<number> {
        const result = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(orders)
            .where(
                and(
                    gte(orders.createdAt, range.start),
                    lte(orders.createdAt, range.end),
                    ne(orders.status, 'cancelled'),
                    ne(orders.status, 'payment_timeout'),
                ),
            );

        return result[0]?.count ?? 0;
    }

    async getOrderTrend(range: DateRange) {
        const bucket = sql<string>`DATE_TRUNC('day', ${orders.createdAt})::date`;

        const rows = await this.db
            .select({
                date: bucket,
                count: sql<number>`COUNT(*)::int`,
            })
            .from(orders)
            .where(
                and(
                    gte(orders.createdAt, range.start),
                    lte(orders.createdAt, range.end),
                    ne(orders.status, 'cancelled'),
                    ne(orders.status, 'payment_timeout'),
                ),
            )
            .groupBy(bucket)
            .orderBy(bucket);

        return rows.map((row) => ({
            date: row.date,
            count: row.count ?? 0,
        }));
    }

    async getRevenueTrend(range: DateRange) {
        const bucket = sql<string>`DATE_TRUNC('day', ${financialTransactions.createdAt})::date`;

        const rows = await this.db
            .select({
                date: bucket,
                amount: sql<string>`COALESCE(SUM(${financialTransactions.amount}), '0')`,
            })
            .from(financialTransactions)
            .where(
                and(
                    inArray(
                        financialTransactions.transactionType,
                        this.revenueTransactionTypes,
                    ),
                    gte(financialTransactions.createdAt, range.start),
                    lte(financialTransactions.createdAt, range.end),
                ),
            )
            .groupBy(bucket)
            .orderBy(bucket);

        return rows.map((row) => ({
            date: row.date,
            amount: this.toNumber(row.amount),
        }));
    }

    private toNumber(value?: string | number | null) {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        return 0;
    }
}
