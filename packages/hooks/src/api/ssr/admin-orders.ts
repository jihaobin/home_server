import {
    AdminBulkUpdateOrderStatusResultSchema,
    AdminOrderListResponseSchema,
    AdminOrderListQuery,
    AdminUpdateOrderStatusSchema,
    OrderAssignmentsSchema,
    OrderDetailSchema,
    ServicePersonnelSchema,
    type AdminBulkUpdateOrderStatus,
    type AdminBulkUpdateOrderStatusResult,
    type AdminOrderListResponse,
    type OrderStatus,
} from '@repo/types';
import {
    QueryClient,
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
    type QueryKey,
} from '@tanstack/react-query';
import { z } from 'zod/v4';
import { getSsrApiClient } from './client';

const ADMIN_ORDERS_QUERY_KEY = ['admin-orders'] as const;

type SortField = NonNullable<AdminOrderListQuery['sortBy']>;
type SortOrder = NonNullable<AdminOrderListQuery['sortOrder']>;

export type NormalizedAdminOrdersQuery = {
    page: number;
    limit: number;
    orderSerial?: string;
    customerKeyword?: string;
    servicePersonnelKeyword?: string;
    status?: AdminOrderListQuery['status'];
    assignmentType?: AdminOrderListQuery['assignmentType'];
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    sortBy: SortField;
    sortOrder: SortOrder;
};

export type AdminOrdersQueryInput = Partial<AdminOrderListQuery>;

const adminOrdersResponseSchema = AdminOrderListResponseSchema;
type AdminOrdersResponse = z.infer<typeof adminOrdersResponseSchema>;

const AdminOrderServicePersonnelSchema = ServicePersonnelSchema.omit({
    geom: true,
});

const AdminOrderAssignmentSchema = z
    .object({
        ...OrderAssignmentsSchema.shape,
        servicePersonnel: AdminOrderServicePersonnelSchema,
    })
    .nullable();

const AdminOrderPaymentSchema = z.object({
    id: z.string(),
    amount: z.number(),
    paymentMethod: z.string(),
    status: z.string(),
    transactionId: z.string().nullable().optional(),
    paidAt: z.coerce.date().nullable(),
});

const AdminOrderDetailBaseSchema = OrderDetailSchema.extend({
    assignment: AdminOrderAssignmentSchema,
    payments: z.array(AdminOrderPaymentSchema).nullable(),
});

function normalizeDateValue(value: unknown) {
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
    }
    return value;
}

type AnyRecord = Record<string, unknown>;

function normalizeOrderDetailPayload(input: unknown) {
    if (!input || typeof input !== 'object') {
        return input;
    }

    const detail: AnyRecord = { ...(input as AnyRecord) };

    const topLevelDates = [
        'appointmentTime',
        'serviceStartedAt',
        'serviceCompletedAt',
        'cancelledAt',
        'createdAt',
        'updatedAt',
    ] as const;

    for (const key of topLevelDates) {
        if (key in detail) {
            detail[key] = normalizeDateValue(detail[key]);
        }
    }

    if (detail.assignment && typeof detail.assignment === 'object') {
        const assignment: AnyRecord = { ...(detail.assignment as AnyRecord) };
        assignment.assignedAt = normalizeDateValue(
            assignment.assignedAt,
        ) as Date;
        assignment.acceptedAt = normalizeDateValue(
            assignment.acceptedAt,
        ) as Date | null | undefined;

        if (
            assignment.servicePersonnel &&
            typeof assignment.servicePersonnel === 'object'
        ) {
            const staff: AnyRecord = {
                ...(assignment.servicePersonnel as AnyRecord),
            };
            staff.lastActiveAt = normalizeDateValue(staff.lastActiveAt);
            assignment.servicePersonnel = staff;
        }

        detail.assignment = assignment;
    }

    if (Array.isArray(detail.payments)) {
        detail.payments = detail.payments.map((payment) => {
            if (!payment || typeof payment !== 'object') {
                return payment;
            }
            const paymentRecord: AnyRecord = { ...(payment as AnyRecord) };
            paymentRecord.paymentMethod =
                (paymentRecord.paymentMethod as string | undefined) ??
                (paymentRecord.payment_method as string | undefined) ??
                'unknown';
            paymentRecord.transactionId =
                (paymentRecord.transactionId as string | null | undefined) ??
                (paymentRecord.transaction_id as string | null | undefined) ??
                null;
            paymentRecord.paidAt = normalizeDateValue(
                (paymentRecord.paidAt as unknown) ??
                    (paymentRecord.paid_at as unknown) ??
                    null,
            );
            return paymentRecord;
        });
    }

    return detail;
}

export const AdminOrderDetailSchema = z.preprocess(
    normalizeOrderDetailPayload,
    AdminOrderDetailBaseSchema,
);

export type AdminOrderDetail = z.infer<typeof AdminOrderDetailSchema>;

export function normalizeAdminOrdersQuery(
    input: AdminOrdersQueryInput = {},
): NormalizedAdminOrdersQuery {
    const page = typeof input.page === 'number' && input.page > 0 ? input.page : 1;
    const limit =
        typeof input.limit === 'number' && input.limit > 0 ? input.limit : 20;

    const normalized: NormalizedAdminOrdersQuery = {
        page,
        limit,
        sortBy: input.sortBy ?? 'createdAt',
        sortOrder: input.sortOrder ?? 'desc',
    };

    if (input.orderSerial?.trim()) {
        normalized.orderSerial = input.orderSerial.trim();
    }

    if (input.customerKeyword?.trim()) {
        normalized.customerKeyword = input.customerKeyword.trim();
    }

    if (input.servicePersonnelKeyword?.trim()) {
        normalized.servicePersonnelKeyword = input.servicePersonnelKeyword.trim();
    }

    if (input.status) {
        normalized.status = input.status;
    }

    if (input.assignmentType) {
        normalized.assignmentType = input.assignmentType;
    }

    if (input.startDate) {
        normalized.startDate = input.startDate;
    }

    if (input.endDate) {
        normalized.endDate = input.endDate;
    }

    if (typeof input.minAmount === 'number') {
        normalized.minAmount = Math.max(input.minAmount, 0);
    }

    if (typeof input.maxAmount === 'number') {
        normalized.maxAmount = Math.max(input.maxAmount, 0);
    }

    return normalized;
}

function buildQueryParams(params: NormalizedAdminOrdersQuery) {
    const query: Record<string, string | number> = {
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    };

    if (params.orderSerial) {
        query.orderSerial = params.orderSerial;
    }
    if (params.customerKeyword) {
        query.customerKeyword = params.customerKeyword;
    }
    if (params.servicePersonnelKeyword) {
        query.servicePersonnelKeyword = params.servicePersonnelKeyword;
    }
    if (params.status) {
        query.status = params.status;
    }
    if (params.assignmentType) {
        query.assignmentType = params.assignmentType;
    }
    if (params.startDate) {
        query.startDate = params.startDate;
    }
    if (params.endDate) {
        query.endDate = params.endDate;
    }
    if (typeof params.minAmount === 'number') {
        query.minAmount = params.minAmount;
    }
    if (typeof params.maxAmount === 'number') {
        query.maxAmount = params.maxAmount;
    }

    return query;
}

export const adminOrdersQueryKey = (input: NormalizedAdminOrdersQuery) =>
    [ADMIN_ORDERS_QUERY_KEY, input] as QueryKey;

export const adminOrdersQueryOptions = (input: AdminOrdersQueryInput = {}) => {
    const normalized = normalizeAdminOrdersQuery(input);

    return queryOptions({
        queryKey: adminOrdersQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminOrdersResponse>(
                '/admin/orders',
                {
                    query: buildQueryParams(normalized),
                    schema: adminOrdersResponseSchema,
                },
            );

            if (!response.data) {
                throw new Error('订单列表为空');
            }

            return response.data;
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: '订单列表加载失败',
        },
    });
};

export function useAdminOrders(input: AdminOrdersQueryInput = {}) {
    return useSuspenseQuery(adminOrdersQueryOptions(input));
}

const ADMIN_ORDER_DETAIL_QUERY_KEY = ['admin-order-detail'] as const;

export const adminOrderDetailQueryKey = (orderId: string) =>
    [ADMIN_ORDER_DETAIL_QUERY_KEY, orderId] as const;

export const adminOrderDetailQueryOptions = (orderId: string) =>
    queryOptions({
        queryKey: adminOrderDetailQueryKey(orderId),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminOrderDetail>(
                `/admin/orders/${orderId}`,
                {
                    schema: AdminOrderDetailSchema,
                },
            );

            if (!response.data) {
                throw new Error('订单详情为空');
            }

            return response.data;
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: '订单详情加载失败',
        },
    });

export function useAdminOrderDetail(orderId: string) {
    return useSuspenseQuery(adminOrderDetailQueryOptions(orderId));
}

export function useUpdateAdminOrderStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            orderId,
            status,
        }: {
            orderId: string;
            status: z.infer<typeof AdminUpdateOrderStatusSchema>['status'];
        }) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.patch<AdminOrderDetail>(
                `/admin/orders/${orderId}/status`,
                { status },
                {
                    schema: AdminOrderDetailSchema,
                },
            );

            if (!response.data) {
                throw new Error('订单状态更新失败');
            }

            return response.data;
        },
        onSuccess: (updatedOrder) => {
            if (!updatedOrder) {
                return;
            }

            queryClient.setQueryData(
                adminOrderDetailQueryKey(updatedOrder.id),
                updatedOrder,
            );
            updateOrderListCache(queryClient, updatedOrder);
        },
        meta: {
            errorMessage: '更新订单状态失败',
        },
    });
}

export function useBulkUpdateAdminOrderStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: AdminBulkUpdateOrderStatus) => {
            const apiClient = getSsrApiClient();
            const response =
                await apiClient.patch<AdminBulkUpdateOrderStatusResult>(
                    '/admin/orders/status/bulk',
                    payload,
                    {
                        schema: AdminBulkUpdateOrderStatusResultSchema,
                    },
                );

            if (!response.data) {
                throw new Error('批量更新订单状态失败');
            }

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
        },
        meta: {
            errorMessage: '批量更新订单状态失败',
        },
    });
}

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
    'cancelled',
    'payment_timeout',
    'refunded',
]);

function canAdminOrderUpdate(status: OrderStatus) {
    return !TERMINAL_ORDER_STATUSES.has(status);
}

function updateOrderListCache(
    queryClient: QueryClient,
    updatedOrder: AdminOrderDetail,
) {
    const queries = queryClient.getQueriesData<AdminOrderListResponse>({
        queryKey: ADMIN_ORDERS_QUERY_KEY,
    });

    for (const [queryKey, cached] of queries) {
        if (!cached) continue;

        let hasMatch = false;
        const nextItems = cached.items.map((item) => {
            if (item.id !== updatedOrder.id) {
                return item;
            }
            hasMatch = true;
            return {
                ...item,
                status: updatedOrder.status,
                assignmentType:
                    updatedOrder.assignment?.assignmentType ?? item.assignmentType,
                canUpdateStatus: canAdminOrderUpdate(updatedOrder.status),
            };
        });

        if (hasMatch) {
            queryClient.setQueryData(queryKey, {
                ...cached,
                items: nextItems,
            });
        }
    }
}
