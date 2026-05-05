import type {
    AssignmentDecisionStatus,
    OrderStatus,
    StaffOrderListItem,
} from '@repo/types';

export type StaffOrderPriorityGroupKey =
    | 'pending_acceptance'
    | 'paid'
    | 'completed'
    | 'archived';

export type StaffOrderPriorityGroup = {
    key: StaffOrderPriorityGroupKey;
    title: string;
    count: number;
    items: StaffOrderListItem[];
};

const HALF_HOUR_MS = 30 * 60 * 1000;

const GROUP_ORDER: StaffOrderPriorityGroupKey[] = [
    'pending_acceptance',
    'paid',
    'completed',
    'archived',
];

const GROUP_TITLE: Record<StaffOrderPriorityGroupKey, string> = {
    pending_acceptance: '待接单',
    paid: '待服务',
    completed: '已完成',
    archived: '其他',
};

function normalizeDateToMs(value?: string | Date | null) {
    if (!value) {
        return null;
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    const ms = date.getTime();
    return Number.isNaN(ms) ? null : ms;
}

function compareTimeAsc(a: number | null, b: number | null) {
    if (a === null && b === null) {
        return 0;
    }
    if (a === null) {
        return 1;
    }
    if (b === null) {
        return -1;
    }
    return a - b;
}

function compareTimeDesc(a: number | null, b: number | null) {
    if (a === null && b === null) {
        return 0;
    }
    if (a === null) {
        return 1;
    }
    if (b === null) {
        return -1;
    }
    return b - a;
}

function compareIdAsc(a: StaffOrderListItem, b: StaffOrderListItem) {
    return String(a.id).localeCompare(String(b.id));
}

function resolvePendingUrgencyBucket(
    order: StaffOrderListItem,
    nowMs: number,
) {
    const appointmentMs = normalizeDateToMs(order.appointmentTime);
    if (appointmentMs === null) {
        return 2;
    }
    const diff = appointmentMs - nowMs;
    if (diff <= 0) {
        return 0;
    }
    if (diff <= HALF_HOUR_MS) {
        return 1;
    }
    return 2;
}

function resolveGroup(order: StaffOrderListItem): StaffOrderPriorityGroupKey {
    if (
        order.status === 'pending_acceptance' &&
        order.decisionStatus === 'pending'
    ) {
        return 'pending_acceptance';
    }
    if (
        order.status === 'paid' ||
        (order.status === 'pending_acceptance' &&
            order.decisionStatus === 'accepted')
    ) {
        return 'paid';
    }
    if (order.status === 'completed') {
        return 'completed';
    }
    return 'archived';
}

function comparePendingAcceptanceOrders(
    a: StaffOrderListItem,
    b: StaffOrderListItem,
    nowMs: number,
) {
    const bucketDiff =
        resolvePendingUrgencyBucket(a, nowMs) -
        resolvePendingUrgencyBucket(b, nowMs);
    if (bucketDiff !== 0) {
        return bucketDiff;
    }
    const appointmentDiff = compareTimeAsc(
        normalizeDateToMs(a.appointmentTime),
        normalizeDateToMs(b.appointmentTime),
    );
    if (appointmentDiff !== 0) {
        return appointmentDiff;
    }
    const createdDiff = compareTimeAsc(
        normalizeDateToMs(a.createdAt),
        normalizeDateToMs(b.createdAt),
    );
    if (createdDiff !== 0) {
        return createdDiff;
    }
    return compareIdAsc(a, b);
}

function comparePaidOrders(a: StaffOrderListItem, b: StaffOrderListItem) {
    const appointmentDiff = compareTimeAsc(
        normalizeDateToMs(a.appointmentTime),
        normalizeDateToMs(b.appointmentTime),
    );
    if (appointmentDiff !== 0) {
        return appointmentDiff;
    }
    const acceptedDiff = compareTimeAsc(
        normalizeDateToMs(a.acceptedAt),
        normalizeDateToMs(b.acceptedAt),
    );
    if (acceptedDiff !== 0) {
        return acceptedDiff;
    }
    return compareIdAsc(a, b);
}

function compareCompletedOrders(
    a: StaffOrderListItem,
    b: StaffOrderListItem,
) {
    const completedDiff = compareTimeDesc(
        normalizeDateToMs(a.serviceCompletedAt),
        normalizeDateToMs(b.serviceCompletedAt),
    );
    if (completedDiff !== 0) {
        return completedDiff;
    }
    const appointmentDiff = compareTimeDesc(
        normalizeDateToMs(a.appointmentTime),
        normalizeDateToMs(b.appointmentTime),
    );
    if (appointmentDiff !== 0) {
        return appointmentDiff;
    }
    return compareIdAsc(a, b);
}

function compareArchivedOrders(a: StaffOrderListItem, b: StaffOrderListItem) {
    const rejectedDiff = compareTimeDesc(
        normalizeDateToMs(a.rejectedAt),
        normalizeDateToMs(b.rejectedAt),
    );
    if (rejectedDiff !== 0) {
        return rejectedDiff;
    }
    const createdDiff = compareTimeDesc(
        normalizeDateToMs(a.createdAt),
        normalizeDateToMs(b.createdAt),
    );
    if (createdDiff !== 0) {
        return createdDiff;
    }
    const appointmentDiff = compareTimeDesc(
        normalizeDateToMs(a.appointmentTime),
        normalizeDateToMs(b.appointmentTime),
    );
    if (appointmentDiff !== 0) {
        return appointmentDiff;
    }
    return compareIdAsc(a, b);
}

function compareWithinGroup(
    group: StaffOrderPriorityGroupKey,
    a: StaffOrderListItem,
    b: StaffOrderListItem,
    nowMs: number,
) {
    switch (group) {
        case 'pending_acceptance':
            return comparePendingAcceptanceOrders(a, b, nowMs);
        case 'paid':
            return comparePaidOrders(a, b);
        case 'completed':
            return compareCompletedOrders(a, b);
        case 'archived':
        default:
            return compareArchivedOrders(a, b);
    }
}

export function buildStaffOrderPriorityGroups(
    orders: StaffOrderListItem[],
    now: Date = new Date(),
): StaffOrderPriorityGroup[] {
    const nowMs = now.getTime();
    const grouped = new Map<StaffOrderPriorityGroupKey, StaffOrderListItem[]>();
    for (const key of GROUP_ORDER) {
        grouped.set(key, []);
    }

    for (const order of orders) {
        const group = resolveGroup(order);
        grouped.get(group)?.push(order);
    }

    const result: StaffOrderPriorityGroup[] = [];
    for (const key of GROUP_ORDER) {
        const items = grouped.get(key) ?? [];
        if (!items.length) {
            continue;
        }
        items.sort((a, b) => compareWithinGroup(key, a, b, nowMs));
        result.push({
            key,
            title: GROUP_TITLE[key],
            count: items.length,
            items,
        });
    }
    return result;
}

export function sortStaffOrdersByPriority(
    orders: StaffOrderListItem[],
    options: {
        statusFilter?: OrderStatus;
        decisionStatusFilter?: AssignmentDecisionStatus;
        now?: Date;
    } = {},
) {
    const { statusFilter, decisionStatusFilter, now = new Date() } = options;
    const nowMs = now.getTime();
    const filtered = orders.filter((order) => {
        if (statusFilter && order.status !== statusFilter) {
            return false;
        }
        if (
            decisionStatusFilter &&
            order.decisionStatus !== decisionStatusFilter
        ) {
            return false;
        }
        return true;
    });

    if (!statusFilter) {
        return buildStaffOrderPriorityGroups(filtered, now).flatMap(
            (group) => group.items,
        );
    }

    const sorted = [...filtered];
    if (statusFilter === 'pending_acceptance') {
        sorted.sort((a, b) =>
            comparePendingAcceptanceOrders(a, b, nowMs),
        );
        return sorted;
    }

    if (statusFilter === 'paid') {
        sorted.sort(comparePaidOrders);
        return sorted;
    }

    if (statusFilter === 'completed') {
        sorted.sort(compareCompletedOrders);
        return sorted;
    }

    sorted.sort(compareArchivedOrders);
    return sorted;
}
