import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { UserRole } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { orders, userProfiles, users } from 'src/common/database/schema';

export type AdminUserListFilters = {
    page: number;
    limit: number;
    name?: string;
    role?: UserRole;
    phone?: string;
    status?: 'active' | 'inactive';
};

type UserRow = {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date | null;
    emailVerified: boolean;
    phoneNumberVerified: boolean;
    profileRealName: string | null;
    profileIdCardNumber: string | null;
};

type OrderStats = {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalSpent: number;
    lastOrderAt: Date | null;
};

export type AdminUserRecord = UserRow & {
    stats: OrderStats;
};

export type AdminUserListResult = {
    items: AdminUserRecord[];
    total: number;
    page: number;
    limit: number;
};

@Injectable()
export class AdminUsersRepository {
    @Inject(DB)
    private readonly db: DbType;

    async findUsers(
        filters: AdminUserListFilters,
    ): Promise<AdminUserListResult> {
        const page = Math.max(filters.page, 1);
        const limit = Math.max(filters.limit, 1);
        const offset = (page - 1) * limit;
        const where = this.buildWhere(filters);

        const baseQuery = this.db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                phoneNumber: users.phoneNumber,
                role: users.role,
                isActive: users.isActive,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                emailVerified: users.emailVerified,
                phoneNumberVerified: users.phoneNumberVerified,
                profileRealName: userProfiles.realName,
                profileIdCardNumber: userProfiles.idCardNumber,
            })
            .from(users)
            .leftJoin(userProfiles, eq(userProfiles.userId, users.id));

        const rowsQuery = where ? baseQuery.where(where) : baseQuery;

        const rows = await rowsQuery
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);

        const total = await this.db.$count(users, where);
        const statsMap = await this.buildOrderStatsMap(
            rows.map((row) => row.id),
        );

        return {
            items: rows.map((row) => ({
                ...row,
                role: row.role ?? 'customer',
                isActive: row.isActive ?? false,
                emailVerified: row.emailVerified ?? false,
                phoneNumberVerified: row.phoneNumberVerified ?? false,
                stats: statsMap.get(row.id) ?? this.createEmptyStats(),
            })),
            total,
            page,
            limit,
        };
    }

    async findUserDetail(userId: string): Promise<AdminUserRecord | null> {
        const query = this.db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                phoneNumber: users.phoneNumber,
                role: users.role,
                isActive: users.isActive,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                emailVerified: users.emailVerified,
                phoneNumberVerified: users.phoneNumberVerified,
                profileRealName: userProfiles.realName,
                profileIdCardNumber: userProfiles.idCardNumber,
            })
            .from(users)
            .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
            .where(eq(users.id, userId))
            .limit(1);

        const rows = await query;

        const row = rows[0];
        if (!row) {
            return null;
        }

        const statsMap = await this.buildOrderStatsMap([row.id]);
        return {
            ...row,
            role: row.role ?? 'customer',
            isActive: row.isActive ?? false,
            emailVerified: row.emailVerified ?? false,
            phoneNumberVerified: row.phoneNumberVerified ?? false,
            stats: statsMap.get(row.id) ?? this.createEmptyStats(),
        };
    }

    async updateUserStatus(
        userId: string,
        isActive: boolean,
    ): Promise<AdminUserRecord | null> {
        const result = await this.db
            .update(users)
            .set({ isActive })
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        if (!result[0]) {
            return null;
        }

        return this.findUserDetail(userId);
    }

    async updateUserRole(
        userId: string,
        role: UserRole,
    ): Promise<AdminUserRecord | null> {
        const result = await this.db
            .update(users)
            .set({ role })
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        if (!result[0]) {
            return null;
        }

        return this.findUserDetail(userId);
    }

    private buildWhere(filters: AdminUserListFilters): SQL | undefined {
        const conditions: SQL[] = [];

        if (filters.name) {
            conditions.push(ilike(users.name, `%${filters.name}%`));
        }

        if (filters.phone) {
            conditions.push(ilike(users.phoneNumber, `%${filters.phone}%`));
        }

        if (filters.role) {
            conditions.push(eq(users.role, filters.role));
        }

        if (filters.status === 'active') {
            conditions.push(eq(users.isActive, true));
        } else if (filters.status === 'inactive') {
            conditions.push(eq(users.isActive, false));
        }

        if (!conditions.length) {
            return undefined;
        }

        return and(...conditions);
    }

    private async buildOrderStatsMap(userIds: string[]) {
        if (!userIds.length) {
            return new Map<string, OrderStats>();
        }

        const completedStatus = 'completed';
        const rows = await this.db
            .select({
                userId: orders.customerId,
                totalOrders: sql<number>`COUNT(${orders.id})::int`,
                completedOrders: sql<number>`
                    COUNT(*) FILTER (WHERE ${orders.status} = ${completedStatus})::int
                `,
                cancelledOrders: sql<number>`
                    COUNT(*) FILTER (
                        WHERE ${orders.status} IN ('cancelled', 'payment_timeout')
                    )::int
                `,
                totalSpent: sql<string>`COALESCE(SUM(${orders.totalAmount}), '0')`,
                lastOrderAt: sql<Date | null>`MAX(${orders.createdAt})`,
            })
            .from(orders)
            .where(inArray(orders.customerId, userIds))
            .groupBy(orders.customerId);

        return new Map<string, OrderStats>(
            rows.map((row) => [
                row.userId,
                {
                    totalOrders: row.totalOrders ?? 0,
                    completedOrders: row.completedOrders ?? 0,
                    cancelledOrders: row.cancelledOrders ?? 0,
                    totalSpent: this.toNumber(row.totalSpent),
                    lastOrderAt: row.lastOrderAt
                        ? new Date(row.lastOrderAt)
                        : null,
                },
            ]),
        );
    }

    private createEmptyStats(): OrderStats {
        return {
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            totalSpent: 0,
            lastOrderAt: null,
        };
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
