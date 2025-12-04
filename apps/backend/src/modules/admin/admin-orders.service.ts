import { Injectable, Logger } from '@nestjs/common';
import type {
    AdminBulkUpdateOrderStatus,
    AdminBulkUpdateOrderStatusResult,
    AdminOrderListItem,
    AdminOrderListQuery,
    AdminUpdateOrderStatus,
    OrderDetail,
    OrderStatus,
    PaymentStatus,
    ServicePersonnel,
} from '@repo/types';
import { OrderService } from '../order/order.service';
import {
    AdminOrdersRepository,
    type AdminOrderListFilters,
    type AdminOrderRecord,
} from './admin-orders.repository';

type RawOrderDetail = Awaited<ReturnType<OrderService['getOrderById']>>;
type RawAssignment = NonNullable<RawOrderDetail['assignment']>;
type RawServicePersonnel = NonNullable<RawAssignment['servicePersonnel']>;
type SanitizedServicePersonnel = Omit<ServicePersonnel, 'geom'>;
type AdminOrderAssignment = Omit<
    NonNullable<RawOrderDetail['assignment']>,
    'servicePersonnel'
> & {
    servicePersonnel: SanitizedServicePersonnel;
};
export type AdminOrderDetail = Omit<OrderDetail, 'assignment'> & {
    assignment: AdminOrderAssignment | null;
};

@Injectable()
export class AdminOrdersService {
    private readonly logger = new Logger(AdminOrdersService.name);
    private readonly terminalStatuses = new Set<OrderStatus>([
        'cancelled',
        'payment_timeout',
        'refunded',
    ]);

    constructor(
        private readonly repository: AdminOrdersRepository,
        private readonly orderService: OrderService,
    ) {}

    async listOrders(query: AdminOrderListQuery) {
        const filters: AdminOrderListFilters = {
            page: query.page,
            limit: query.limit,
            orderSerial: query.orderSerial,
            customerKeyword: query.customerKeyword,
            servicePersonnelKeyword: query.servicePersonnelKeyword,
            status: query.status,
            assignmentType: query.assignmentType,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            minAmount: query.minAmount,
            maxAmount: query.maxAmount,
            sortBy: query.sortBy ?? 'createdAt',
            sortOrder: query.sortOrder ?? 'desc',
        };

        const result = await this.repository.findOrders(filters);

        return {
            items: result.items.map((item) => this.mapToAdminOrder(item)),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }

    async getOrderDetail(orderId: string): Promise<AdminOrderDetail> {
        const detail = await this.orderService.getOrderById(orderId);
        return this.normalizeOrderDetail(detail);
    }

    async updateOrderStatus(
        orderId: string,
        payload: AdminUpdateOrderStatus,
    ): Promise<AdminOrderDetail> {
        await this.orderService.updateOrderStatus(orderId, payload.status, {});
        const detail = await this.orderService.getOrderById(orderId);
        return this.normalizeOrderDetail(detail);
    }

    async bulkUpdateOrderStatus(
        payload: AdminBulkUpdateOrderStatus,
    ): Promise<AdminBulkUpdateOrderStatusResult> {
        const failed: AdminBulkUpdateOrderStatusResult['failed'] = [];
        let updated = 0;

        for (const orderId of payload.orderIds) {
            try {
                await this.orderService.updateOrderStatus(
                    orderId,
                    payload.status,
                    {},
                );
                updated += 1;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : '未知错误';
                failed.push({ orderId, message });
                this.logger.warn(
                    `批量更新订单状态失败: ${orderId} - ${message}`,
                );
            }
        }

        return { updated, failed };
    }

    private mapToAdminOrder(record: AdminOrderRecord): AdminOrderListItem {
        const currency = record.order.currency ?? 'CNY';
        const customer = record.customer ?? {
            id: record.order.customerId,
            name: null,
            email: '',
            phoneNumber: null,
        };
        const staffId =
            record.staff?.id ?? record.assignment?.servicePersonnelId ?? null;

        return {
            id: record.order.id,
            orderSerial: record.order.orderSerial,
            status: record.order.status,
            createdAt: (
                record.order.createdAt ??
                record.order.updatedAt ??
                new Date()
            ).toISOString(),
            appointmentTime: record.order.appointmentTime.toISOString(),
            totalAmount: {
                amount: this.roundCurrency(
                    this.toNumber(record.order.totalAmount),
                ),
                currency,
            },
            paidAmount: {
                amount: this.roundCurrency(this.toNumber(record.paidAmount)),
                currency,
            },
            paymentStatus: this.normalizePaymentStatus(
                record.latestPaymentStatus,
            ),
            assignmentType: record.assignment?.assignmentType ?? null,
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phoneNumber: customer.phoneNumber,
            },
            servicePersonnel: staffId
                ? {
                      id: staffId,
                      name: record.staff?.name ?? null,
                      phoneNumber: record.staff?.phoneNumber ?? null,
                  }
                : null,
            service: {
                id: record.service?.id ?? record.order.serviceId,
                name: record.service?.name ?? '未知服务',
                categoryId:
                    record.category?.id ?? record.service?.categoryId ?? null,
                categoryName: record.category?.name ?? null,
            },
            canUpdateStatus: this.canUpdateStatus(record.order.status),
        };
    }

    private canUpdateStatus(status: OrderStatus) {
        return !this.terminalStatuses.has(status);
    }

    private roundCurrency(value: number) {
        return Math.round(value * 100) / 100;
    }

    private toNumber(input?: string | number | null) {
        if (typeof input === 'number') {
            return input;
        }
        if (typeof input === 'string') {
            const parsed = Number(input);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    private normalizePaymentStatus(
        status: PaymentStatus | null,
    ): PaymentStatus {
        return status ?? 'pending';
    }

    private normalizeOrderDetail(detail: RawOrderDetail): AdminOrderDetail {
        const normalized: AdminOrderDetail = {
            ...detail,
            createdAt: this.ensureDate(detail.createdAt),
            updatedAt: this.ensureDate(detail.updatedAt),
            couponCode: detail.couponCode ?? undefined,
            service: detail.service
                ? {
                      id: detail.service.id,
                      name: detail.service.name,
                      description: detail.service.description,
                  }
                : null,
            address: detail.address
                ? {
                      id: detail.address.id,
                      detailedAddress: detail.address.detailedAddress ?? '',
                      recipientName: detail.address.recipientName ?? '',
                      recipientPhone: detail.address.recipientPhone ?? '',
                  }
                : null,
            assignment: this.normalizeAssignment(detail),
            originalAmount: this.toNumber(detail.originalAmount),
            discountAmount: this.toNumber(detail.discountAmount ?? 0),
            totalAmount: this.toNumber(detail.totalAmount),
            payments:
                detail.payments?.map((payment) => ({
                    ...payment,
                    amount: this.toNumber(payment.amount),
                })) ?? [],
        };

        this.logger.debug(
            `订单详情已标准化（ID: ${detail.id}，包含指派：${Boolean(normalized.assignment)})`,
        );

        return normalized;
    }

    private normalizeAssignment(
        detail: RawOrderDetail,
    ): AdminOrderDetail['assignment'] {
        const assignment = detail.assignment;
        if (!assignment || !assignment.servicePersonnel) {
            return null;
        }

        return {
            ...assignment,
            assignedAt:
                assignment.assignedAt ??
                this.ensureDate(detail.createdAt ?? detail.updatedAt),
            servicePersonnelId:
                assignment.servicePersonnelId ??
                assignment.servicePersonnel.userId,
            servicePersonnel: this.normalizeServicePersonnel(
                assignment.servicePersonnel,
            ),
        };
    }

    private normalizeServicePersonnel(
        personnel: RawServicePersonnel,
    ): SanitizedServicePersonnel {
        const { geom: _geom, ...rest } = personnel;
        return {
            ...rest,
            bio: rest.bio ?? undefined,
            district: rest.district ?? undefined,
            county: rest.county ?? undefined,
            detailedAddress: rest.detailedAddress ?? '',
            yearsOfExperience: rest.yearsOfExperience ?? 0,
            workDays: rest.workDays ?? '1234567',
            currentStatus: rest.currentStatus ?? 'available',
        };
    }

    private ensureDate(value?: Date | null): Date {
        return value ?? new Date();
    }
}
