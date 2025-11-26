import { Injectable, NotFoundException } from '@nestjs/common';
import {
    type AdminUpdateUserRole,
    type AdminUpdateUserStatus,
    type AdminUserDetail,
    type AdminUserListItem,
    type AdminUserListQuery,
} from '@repo/types';
import {
    AdminUsersRepository,
    type AdminUserListFilters,
    type AdminUserRecord,
} from './admin-users.repository';

@Injectable()
export class AdminUsersService {
    constructor(private readonly repository: AdminUsersRepository) {}

    async listUsers(query: AdminUserListQuery) {
        const filters: AdminUserListFilters = {
            page: query.page,
            limit: query.limit,
            name: query.name,
            role: query.role,
            phone: query.phone,
            status: query.status,
        };

        const result = await this.repository.findUsers(filters);

        return {
            items: result.items.map((item) => this.mapToAdminUser(item)),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }

    async getUserDetail(userId: string): Promise<AdminUserDetail> {
        const user = await this.repository.findUserDetail(userId);

        if (!user) {
            throw new NotFoundException({
                code: 'USER_NOT_FOUND',
                message: '用户不存在或已被删除',
            });
        }

        return this.mapToAdminUser(user);
    }

    async updateUserStatus(
        userId: string,
        payload: AdminUpdateUserStatus,
    ): Promise<AdminUserDetail> {
        const user = await this.repository.updateUserStatus(
            userId,
            payload.isActive,
        );

        if (!user) {
            throw new NotFoundException({
                code: 'USER_NOT_FOUND',
                message: '用户不存在或已被删除',
            });
        }

        return this.mapToAdminUser(user);
    }

    async updateUserRole(
        userId: string,
        payload: AdminUpdateUserRole,
    ): Promise<AdminUserDetail> {
        const user = await this.repository.updateUserRole(userId, payload.role);

        if (!user) {
            throw new NotFoundException({
                code: 'USER_NOT_FOUND',
                message: '用户不存在或已被删除',
            });
        }

        return this.mapToAdminUser(user);
    }

    private mapToAdminUser(record: AdminUserRecord): AdminUserListItem {
        const updatedAt = record.updatedAt ?? record.createdAt;
        const profile =
            record.profileRealName || record.profileIdCardNumber
                ? {
                      realName: record.profileRealName,
                      idCardNumber: record.profileIdCardNumber,
                  }
                : undefined;

        return {
            id: record.id,
            name: record.name,
            email: record.email,
            phoneNumber: record.phoneNumber,
            role: record.role,
            isActive: record.isActive,
            createdAt: record.createdAt.toISOString(),
            updatedAt: updatedAt.toISOString(),
            emailVerified: record.emailVerified,
            phoneNumberVerified: record.phoneNumberVerified,
            profile,
            stats: {
                totalOrders: record.stats.totalOrders,
                completedOrders: record.stats.completedOrders,
                cancelledOrders: record.stats.cancelledOrders,
                totalSpent: {
                    amount: this.roundCurrency(record.stats.totalSpent),
                    currency: 'CNY',
                },
                lastOrderAt: record.stats.lastOrderAt
                    ? record.stats.lastOrderAt.toISOString()
                    : null,
            },
        };
    }

    private roundCurrency(value: number) {
        return Math.round(value * 100) / 100;
    }
}
