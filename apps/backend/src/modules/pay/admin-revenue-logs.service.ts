import { Injectable } from '@nestjs/common';
import type {
    AdminRevenueDirection,
    AdminRevenueLog,
    AdminRevenueLogListQuery,
    AdminRevenueLogListResponse,
    OrderStatus,
    WithdrawalStatus,
} from '@repo/types';
import {
    AdminRevenueLogsRepository,
    type AdminRevenueLogFilters,
    type AdminRevenueLogRecord,
} from './admin-revenue-logs.repository';

@Injectable()
export class AdminRevenueLogsService {
    constructor(private readonly repository: AdminRevenueLogsRepository) {}

    async listRevenueLogs(
        query: AdminRevenueLogListQuery,
    ): Promise<AdminRevenueLogListResponse> {
        const normalized = this.normalizeQuery(query);
        const result = await this.repository.findRevenueLogs(
            normalized.filters,
        );

        const items = result.items.map((record) => this.mapRecordToLog(record));
        const totalPages = Math.ceil(result.total / normalized.limit) || 0;

        return {
            items,
            meta: {
                page: normalized.page,
                limit: normalized.limit,
                total: result.total,
                totalPages,
                hasNext: normalized.page < totalPages,
                hasPrev: normalized.page > 1,
            },
        };
    }

    private normalizeQuery(query: AdminRevenueLogListQuery | undefined) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));

        const filters: AdminRevenueLogFilters = {
            page,
            limit,
            startDate: query?.startDate ? new Date(query.startDate) : undefined,
            endDate: query?.endDate ? new Date(query.endDate) : undefined,
            minAmount:
                typeof query?.minAmount === 'number'
                    ? query.minAmount
                    : undefined,
            maxAmount:
                typeof query?.maxAmount === 'number'
                    ? query.maxAmount
                    : undefined,
            transactionType: query?.transactionType,
            direction: query?.direction,
        };

        return { page, limit, filters };
    }

    private mapRecordToLog(record: AdminRevenueLogRecord): AdminRevenueLog {
        const amountValue = Number(record.amount ?? 0) || 0;
        const currency = record.currency ?? 'CNY';
        const direction: AdminRevenueDirection =
            amountValue >= 0 ? 'income' : 'expense';

        const normalizedAmount = this.roundCurrency(amountValue);

        return {
            id: record.id,
            transactionType: record.transactionType,
            direction,
            amount: {
                amount: normalizedAmount,
                currency,
            },
            description: record.description ?? null,
            referenceId: record.referenceId ?? null,
            createdAt: (record.createdAt ?? new Date()).toISOString(),
            metadata: record.metadata ?? null,
            order: record.orderId
                ? {
                      id: record.orderId,
                      orderSerial: record.orderSerial ?? null,
                      status: (record.orderStatus as OrderStatus) ?? null,
                  }
                : null,
            user: record.userId
                ? {
                      id: record.userId,
                      name: record.userName ?? null,
                      email: record.userEmail ?? null,
                      phoneNumber: record.userPhoneNumber ?? null,
                  }
                : null,
            withdrawal: record.withdrawalId
                ? {
                      id: record.withdrawalId,
                      status:
                          (record.withdrawalStatus as WithdrawalStatus) ??
                          'pending',
                  }
                : null,
        };
    }

    private roundCurrency(value: number) {
        return Math.round(value * 100) / 100;
    }
}
