import type { StaffOrderListResponse } from "@repo/types";

type StaffOrder = StaffOrderListResponse["items"][number];

type WorkerOrderGroupKey =
    | "pending_acceptance"
    | "in_progress"
    | "paid"
    | "completed"
    | "archived";

export type WorkerOrderGroup = {
    key: WorkerOrderGroupKey;
    title: string;
    items: StaffOrder[];
};

const HALF_HOUR_MS = 30 * 60 * 1000;

const GROUP_ORDER: WorkerOrderGroupKey[] = [
    "pending_acceptance",
    "in_progress",
    "paid",
    "completed",
    "archived",
];

const GROUP_TITLE: Record<WorkerOrderGroupKey, string> = {
    pending_acceptance: "待接单",
    in_progress: "服务中",
    paid: "待服务",
    completed: "已完成",
    archived: "其他",
};

function normalizeDateToMs(value?: string | Date | null) {
    if (!value) {
        return null;
    }
    const date = typeof value === "string" ? new Date(value) : value;
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

function compareIdAsc(a: StaffOrder, b: StaffOrder) {
    return String(a.id).localeCompare(String(b.id));
}

function resolvePendingUrgencyBucket(order: StaffOrder, nowMs: number) {
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

function resolveAllGroup(order: StaffOrder): WorkerOrderGroupKey {
    if (
        order.status === "pending_acceptance" &&
        order.decisionStatus === "pending"
    ) {
        return "pending_acceptance";
    }
    if (order.status === "in_progress") {
        return "in_progress";
    }
    if (
        order.status === "paid" ||
        (order.status === "pending_acceptance" &&
            order.decisionStatus === "accepted")
    ) {
        return "paid";
    }
    if (order.status === "completed") {
        return "completed";
    }
    return "archived";
}

function comparePendingAcceptanceOrders(
    a: StaffOrder,
    b: StaffOrder,
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

function compareInProgressOrders(a: StaffOrder, b: StaffOrder) {
    const startedDiff = compareTimeAsc(
        normalizeDateToMs(a.serviceStartedAt),
        normalizeDateToMs(b.serviceStartedAt),
    );
    if (startedDiff !== 0) {
        return startedDiff;
    }
    const appointmentDiff = compareTimeAsc(
        normalizeDateToMs(a.appointmentTime),
        normalizeDateToMs(b.appointmentTime),
    );
    if (appointmentDiff !== 0) {
        return appointmentDiff;
    }
    return compareIdAsc(a, b);
}

function comparePaidOrders(a: StaffOrder, b: StaffOrder) {
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

function compareCompletedOrders(a: StaffOrder, b: StaffOrder) {
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

function compareArchivedOrders(a: StaffOrder, b: StaffOrder) {
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
    group: WorkerOrderGroupKey,
    a: StaffOrder,
    b: StaffOrder,
    nowMs: number,
) {
    switch (group) {
        case "pending_acceptance":
            return comparePendingAcceptanceOrders(a, b, nowMs);
        case "in_progress":
            return compareInProgressOrders(a, b);
        case "paid":
            return comparePaidOrders(a, b);
        case "completed":
            return compareCompletedOrders(a, b);
        case "archived":
        default:
            return compareArchivedOrders(a, b);
    }
}

export function buildWorkerOrderGroups(orders: StaffOrder[]) {
    const nowMs = Date.now();
    const grouped = new Map<WorkerOrderGroupKey, StaffOrder[]>();
    for (const key of GROUP_ORDER) {
        grouped.set(key, []);
    }

    for (const order of orders) {
        const group = resolveAllGroup(order);
        grouped.get(group)?.push(order);
    }

    const result: WorkerOrderGroup[] = [];
    for (const key of GROUP_ORDER) {
        const items = grouped.get(key) ?? [];
        if (!items.length) {
            continue;
        }
        items.sort((a, b) => compareWithinGroup(key, a, b, nowMs));
        result.push({
            key,
            title: GROUP_TITLE[key],
            items,
        });
    }
    return result;
}

export function sortWorkerOrdersForTab(
    orders: StaffOrder[],
    options: {
        statusFilter?: string;
        decisionStatusFilter?: StaffOrder["decisionStatus"];
    },
) {
    const nowMs = Date.now();
    const { statusFilter, decisionStatusFilter } = options;

    const filtered = orders.filter((order) => {
        if (statusFilter && order.status !== statusFilter) {
            return false;
        }
        if (decisionStatusFilter && order.decisionStatus !== decisionStatusFilter) {
            return false;
        }
        return true;
    });

    if (!statusFilter) {
        return buildWorkerOrderGroups(filtered).flatMap((group) => group.items);
    }

    const sorted = [...filtered];
    if (statusFilter === "pending_acceptance") {
        sorted.sort((a, b) =>
            comparePendingAcceptanceOrders(a, b, nowMs),
        );
        return sorted;
    }

    if (statusFilter === "in_progress") {
        sorted.sort(compareInProgressOrders);
        return sorted;
    }

    if (statusFilter === "paid") {
        sorted.sort(comparePaidOrders);
        return sorted;
    }

    if (statusFilter === "completed") {
        sorted.sort(compareCompletedOrders);
        return sorted;
    }

    sorted.sort(compareArchivedOrders);
    return sorted;
}

export function selectTopPendingWorkOrders(
    orders: StaffOrder[],
    limit = 5,
) {
    const nowMs = Date.now();
    const processingOrders = orders.filter((order) => {
        const group = resolveAllGroup(order);
        return (
            group === "pending_acceptance" ||
            group === "in_progress" ||
            group === "paid"
        );
    });

    const processingGroupRank: Record<
        "pending_acceptance" | "in_progress" | "paid",
        number
    > = {
        pending_acceptance: 0,
        in_progress: 1,
        paid: 2,
    };

    processingOrders.sort((a, b) => {
        const groupA = resolveAllGroup(a) as
            | "pending_acceptance"
            | "in_progress"
            | "paid";
        const groupB = resolveAllGroup(b) as
            | "pending_acceptance"
            | "in_progress"
            | "paid";

        const rankDiff = processingGroupRank[groupA] - processingGroupRank[groupB];
        if (rankDiff !== 0) {
            return rankDiff;
        }

        return compareWithinGroup(groupA, a, b, nowMs);
    });

    return processingOrders.slice(0, limit);
}
