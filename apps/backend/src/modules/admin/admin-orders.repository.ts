import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AssignmentType, OrderStatus, PaymentStatus } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    orderAssignments,
    orders,
    payments,
} from 'src/common/database/schema/orders';
import { users } from 'src/common/database/schema/auth-user';
import { servicePersonnel } from 'src/common/database/schema/shops-service';
import { serviceCategories, services } from 'src/common/database/schema/server';

export type AdminOrderListFilters = {
    page: number;
    limit: number;
    orderSerial?: string;
    customerKeyword?: string;
    servicePersonnelKeyword?: string;
    status?: OrderStatus;
    assignmentType?: AssignmentType;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    sortBy: 'createdAt' | 'appointmentTime' | 'totalAmount';
    sortOrder: 'asc' | 'desc';
};

type CustomerRow = {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
};

type StaffRow = {
    id: string;
    name: string | null;
    phoneNumber: string | null;
} | null;

export type AdminOrderRecord = {
    order: typeof orders.$inferSelect;
    assignment: typeof orderAssignments.$inferSelect | null;
    customer: CustomerRow | null;
    staff: StaffRow;
    service: typeof services.$inferSelect | null;
    category: typeof serviceCategories.$inferSelect | null;
    paidAmount: string;
    latestPaymentStatus: PaymentStatus | null;
};

export type AdminOrderListResult = {
    items: AdminOrderRecord[];
    total: number;
    page: number;
    limit: number;
};

@Injectable()
export class AdminOrdersRepository {
    @Inject(DB)
    private readonly db: DbType;

    async findOrders(
        filters: AdminOrderListFilters,
    ): Promise<AdminOrderListResult> {
        const page = Math.max(filters.page, 1);
        const limit = Math.max(filters.limit, 1);
        const offset = (page - 1) * limit;
        const where = this.buildWhereClause(filters);
        const staffUsers = alias(users, 'staff_users');

        const sortColumn = this.getSortColumn(filters.sortBy);
        const orderByClause =
            filters.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

        const baseQuery = this.db
            .select({
                order: orders,
                assignment: orderAssignments,
                customer: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    phoneNumber: users.phoneNumber,
                },
                staff: {
                    id: staffUsers.id,
                    name: staffUsers.name,
                    phoneNumber: staffUsers.phoneNumber,
                },
                service: services,
                category: serviceCategories,
                paidAmount: sql<string>`COALESCE((
                    SELECT SUM(${payments.amount})
                    FROM ${payments}
                    WHERE ${payments.orderId} = ${orders.id}
                        AND ${payments.status} = 'succeeded'
                ), '0')`,
                latestPaymentStatus: sql<PaymentStatus | null>`(
                    SELECT ${payments.status}
                    FROM ${payments}
                    WHERE ${payments.orderId} = ${orders.id}
                    ORDER BY ${payments.createdAt} DESC
                    LIMIT 1
                )`,
            })
            .from(orders)
            .leftJoin(users, eq(users.id, orders.customerId))
            .leftJoin(orderAssignments, eq(orderAssignments.orderId, orders.id))
            .leftJoin(
                servicePersonnel,
                eq(
                    servicePersonnel.userId,
                    orderAssignments.servicePersonnelId,
                ),
            )
            .leftJoin(staffUsers, eq(staffUsers.id, servicePersonnel.userId))
            .leftJoin(services, eq(services.id, orders.serviceId))
            .leftJoin(
                serviceCategories,
                eq(serviceCategories.id, services.categoryId),
            );

        const rowsQuery = where ? baseQuery.where(where) : baseQuery;

        const countQuery = this.db
            .select({
                value: sql<number>`COUNT(*)::int`,
            })
            .from(orders)
            .leftJoin(users, eq(users.id, orders.customerId))
            .leftJoin(orderAssignments, eq(orderAssignments.orderId, orders.id))
            .leftJoin(
                servicePersonnel,
                eq(
                    servicePersonnel.userId,
                    orderAssignments.servicePersonnelId,
                ),
            )
            .leftJoin(staffUsers, eq(staffUsers.id, servicePersonnel.userId))
            .leftJoin(services, eq(services.id, orders.serviceId))
            .leftJoin(
                serviceCategories,
                eq(serviceCategories.id, services.categoryId),
            );

        const totalRows = await (where ? countQuery.where(where) : countQuery);
        const total = totalRows[0]?.value ?? 0;

        const rows = await rowsQuery
            .orderBy(orderByClause, desc(orders.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            items: rows.map((row) => ({
                order: row.order,
                assignment: row.assignment,
                customer: row.customer,
                staff: row.staff ?? null,
                service: row.service,
                category: row.category,
                paidAmount: row.paidAmount ?? '0',
                latestPaymentStatus: row.latestPaymentStatus ?? null,
            })),
            total,
            page,
            limit,
        };
    }

    private buildWhereClause(filters: AdminOrderListFilters): SQL | undefined {
        const conditions: SQL[] = [];

        if (filters.orderSerial) {
            conditions.push(
                ilike(orders.orderSerial, this.like(filters.orderSerial)),
            );
        }

        if (filters.status) {
            conditions.push(eq(orders.status, filters.status));
        }

        if (filters.customerKeyword) {
            const keyword = this.like(filters.customerKeyword);
            const customerCondition = or(
                ilike(users.name, keyword),
                ilike(users.email, keyword),
                ilike(users.phoneNumber, keyword),
            );

            if (customerCondition) {
                conditions.push(customerCondition);
            }
        }

        if (filters.servicePersonnelKeyword) {
            const staffUsers = alias(users, 'staff_filter');
            conditions.push(
                sql`EXISTS (
                    SELECT 1 FROM ${orderAssignments}
                    LEFT JOIN ${staffUsers}
                        ON ${staffUsers.id} = ${orderAssignments.servicePersonnelId}
                    WHERE ${orderAssignments.orderId} = ${orders.id}
                        AND (
                            ${staffUsers.name} ILIKE ${this.like(filters.servicePersonnelKeyword)}
                            OR ${staffUsers.phoneNumber} ILIKE ${this.like(filters.servicePersonnelKeyword)}
                        )
                )`,
            );
        }

        if (filters.assignmentType) {
            conditions.push(
                eq(orderAssignments.assignmentType, filters.assignmentType),
            );
        }

        if (filters.startDate) {
            conditions.push(sql`${orders.createdAt} >= ${filters.startDate}`);
        }

        if (filters.endDate) {
            conditions.push(sql`${orders.createdAt} <= ${filters.endDate}`);
        }

        if (typeof filters.minAmount === 'number') {
            conditions.push(
                sql`${orders.totalAmount} >= ${filters.minAmount.toFixed(2)}`,
            );
        }

        if (typeof filters.maxAmount === 'number') {
            conditions.push(
                sql`${orders.totalAmount} <= ${filters.maxAmount.toFixed(2)}`,
            );
        }

        if (!conditions.length) {
            return undefined;
        }

        return and(...conditions);
    }

    private like(value: string) {
        return `%${value}%`;
    }

    private getSortColumn(field: AdminOrderListFilters['sortBy']) {
        switch (field) {
            case 'appointmentTime':
                return orders.appointmentTime;
            case 'totalAmount':
                return orders.totalAmount;
            case 'createdAt':
            default:
                return orders.createdAt;
        }
    }
}
