import { Injectable } from '@nestjs/common';
import type { AdminDashboardOverview, AdminDashboardRange } from '@repo/types';
import { AdminDashboardRepository } from './admin-dashboard.repository';

type DateRange = {
    start: Date;
    end: Date;
};

@Injectable()
export class AdminDashboardService {
    private readonly rangeDaysMap: Record<AdminDashboardRange, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
    };

    constructor(private readonly repository: AdminDashboardRepository) {}

    async getOverview(
        range: AdminDashboardRange = '30d',
    ): Promise<AdminDashboardOverview> {
        const rangeInfo = this.resolveRange(range);

        const [
            registeredUsers,
            servicePersonnel,
            totalRevenue,
            periodOrders,
            periodRevenue,
            ordersTrend,
            revenueTrend,
        ] = await Promise.all([
            this.repository.countActiveUsers(),
            this.repository.countServicePersonnel(),
            this.repository.sumRevenue(),
            this.repository.countOrders(rangeInfo),
            this.repository.sumRevenue(rangeInfo),
            this.repository.getOrderTrend(rangeInfo),
            this.repository.getRevenueTrend(rangeInfo),
        ]);

        const orderMap = new Map(
            ordersTrend.map((row) => [row.date, row.count] as const),
        );
        const revenueMap = new Map(
            revenueTrend.map((row) => [row.date, row.amount] as const),
        );

        const daily = Array.from({ length: rangeInfo.days }).map((_, index) => {
            const date = new Date(rangeInfo.start);
            date.setUTCDate(date.getUTCDate() + index);
            const key = this.formatDateKey(date);

            return {
                date: key,
                orderCount: orderMap.get(key) ?? 0,
                revenue: this.roundToTwoDecimals(revenueMap.get(key) ?? 0),
            };
        });

        return {
            totals: {
                registeredUsers,
                servicePersonnel,
                totalRevenue: {
                    amount: this.roundToTwoDecimals(totalRevenue),
                    currency: 'CNY',
                },
            },
            period: {
                range,
                startDate: rangeInfo.start.toISOString(),
                endDate: rangeInfo.end.toISOString(),
                orderCount: periodOrders,
                revenue: {
                    amount: this.roundToTwoDecimals(periodRevenue),
                    currency: 'CNY',
                },
            },
            charts: {
                daily,
            },
            generatedAt: new Date().toISOString(),
        };
    }

    private resolveRange(range: AdminDashboardRange): DateRange & {
        days: number;
    } {
        const days = this.rangeDaysMap[range] ?? this.rangeDaysMap['30d'];
        const now = new Date();
        const end = new Date(now);
        const start = new Date(end);
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - (days - 1));

        return { start, end, days };
    }

    private formatDateKey(date: Date) {
        const year = date.getUTCFullYear();
        const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${date.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private roundToTwoDecimals(value: number) {
        return Math.round(value * 100) / 100;
    }
}
