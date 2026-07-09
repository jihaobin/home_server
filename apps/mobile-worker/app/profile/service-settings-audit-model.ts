import type {
    WorkerServiceAuditLog as WorkerServiceTimelineItem,
    WorkerServiceDerivedStatus,
    WorkerServiceItem,
} from "@repo/types";

export type { WorkerServiceTimelineItem };

export type WorkerServiceTabKey =
    | "all"
    | "active"
    | "pending"
    | "rejected"
    | "takendown";

export type WorkerServiceStatusTone = "green" | "amber" | "red" | "slate";

export type WorkerServiceAuditStepKey = "submitted" | "reviewing" | "result";

export type WorkerServiceAuditStepState =
    | "done"
    | "current"
    | "waiting"
    | "withdrawn";

export type WorkerServiceAuditStepItem = {
    key: WorkerServiceAuditStepKey;
    label: string;
    at: Date | null;
    state: WorkerServiceAuditStepState;
    note?: string | null;
};

export const WORKER_SERVICE_TABS: {
    key: WorkerServiceTabKey;
    label: string;
}[] = [
    { key: "all", label: "全部" },
    { key: "active", label: "运营中" },
    { key: "pending", label: "审核中" },
    { key: "rejected", label: "未通过" },
    { key: "takendown", label: "已下架" },
];

type DateInput = Date | string | number | null | undefined;

type TimelineLike = WorkerServiceTimelineItem & {
    at?: DateInput;
    occurredAt?: DateInput;
};

type DraftLike = NonNullable<WorkerServiceItem["draft"]> & {
    submittedSnapshot?: {
        services?:
            | {
                  serviceId?: string | null;
              }[]
            | null;
    } | null;
};

type WorkerServiceLike = Omit<WorkerServiceItem, "draft"> & {
    draft?: DraftLike | null;
    offering?: {
        name?: string | null;
        takedownReason?: string | null;
    } | null;
};

type SensitiveServiceSnapshot = {
    description?: string | null;
    galleryFileIds?: readonly string[] | null;
    specifications?: unknown;
    specs?: unknown;
};

export type SensitiveServiceChangesInput = {
    current?: SensitiveServiceSnapshot | null;
    next?: SensitiveServiceSnapshot | null;
    before?: SensitiveServiceSnapshot | null;
    after?: SensitiveServiceSnapshot | null;
    original?: SensitiveServiceSnapshot | null;
    draft?: SensitiveServiceSnapshot | null;
};

export const hasPendingUpdateForTakenDownService = (
    item?: Pick<WorkerServiceLike, "derivedStatus" | "draft"> | null,
): boolean =>
    item?.derivedStatus === "takendown" && item.draft?.status === "pending";

export const getWorkerServiceTabKey = (
    status: WorkerServiceDerivedStatus,
): WorkerServiceTabKey => {
    if (status === "active") {
        return "active";
    }

    if (status === "pending" || status === "active_with_pending_update") {
        return "pending";
    }

    if (status === "rejected" || status === "active_with_rejected_update") {
        return "rejected";
    }

    return "takendown";
};

export const getWorkerServiceStatusLabel = (
    statusOrItem:
        | WorkerServiceDerivedStatus
        | Pick<WorkerServiceLike, "derivedStatus" | "draft">,
): string => {
    if (typeof statusOrItem !== "string") {
        if (hasPendingUpdateForTakenDownService(statusOrItem)) {
            return "下架中・已提交新审核";
        }
        return getWorkerServiceStatusLabel(statusOrItem.derivedStatus);
    }

    const status = statusOrItem;
    switch (status) {
        case "pending":
            return "审核中";
        case "active":
            return "运营中";
        case "active_with_pending_update":
            return "运营中・有更新待审";
        case "active_with_rejected_update":
            return "运营中・上次更新被驳回";
        case "rejected":
            return "审核未通过";
        case "takendown":
            return "已下架";
        default:
            return "已下架";
    }
};

export const getWorkerServiceStatusTone = (
    statusOrItem:
        | WorkerServiceDerivedStatus
        | Pick<WorkerServiceLike, "derivedStatus" | "draft">,
): WorkerServiceStatusTone => {
    if (typeof statusOrItem !== "string") {
        if (hasPendingUpdateForTakenDownService(statusOrItem)) {
            return "amber";
        }
        return getWorkerServiceStatusTone(statusOrItem.derivedStatus);
    }

    const status = statusOrItem;
    switch (status) {
        case "active":
            return "green";
        case "pending":
        case "active_with_pending_update":
            return "amber";
        case "rejected":
        case "active_with_rejected_update":
            return "red";
        default:
            return "slate";
    }
};

export const groupWorkerServicesByTab = <T extends WorkerServiceItem>(
    items: readonly T[],
): Record<WorkerServiceTabKey, T[]> => {
    const groups: Record<WorkerServiceTabKey, T[]> = {
        all: [...items],
        active: [],
        pending: [],
        rejected: [],
        takendown: [],
    };

    for (const item of items) {
        if (
            item.derivedStatus === "active_with_pending_update" ||
            item.derivedStatus === "active_with_rejected_update"
        ) {
            groups.active.push(item);
        }

        if (hasPendingUpdateForTakenDownService(item)) {
            groups.pending.push(item);
        }

        groups[getWorkerServiceTabKey(item.derivedStatus)].push(item);
    }

    return groups;
};

export const getWorkerServiceTitle = (item: WorkerServiceLike) =>
    item.offering?.name ??
    item.draft?.submittedSnapshot?.services?.[0]?.serviceId ??
    item.serviceName ??
    item.draft?.snapshot.services[0]?.serviceId ??
    "未命名服务";

export const getWorkerServiceReason = (item: WorkerServiceLike) => {
    if (item.derivedStatus === "takendown") {
        return (
            item.offering?.takedownReason ??
            item.takenDownReason ??
            item.statusReason ??
            "平台已下架该服务"
        );
    }

    if (
        item.derivedStatus === "rejected" ||
        item.derivedStatus === "active_with_rejected_update"
    ) {
        return item.draft?.rejectionReason ?? item.statusReason ?? "审核未通过";
    }

    return null;
};

export const formatAuditElapsed = (date: DateInput) => {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
        return "—";
    }

    const elapsedMs = Date.now() - normalizedDate.getTime();
    const elapsedHours = Math.floor(Math.max(0, elapsedMs) / 3_600_000);

    if (elapsedHours < 1) {
        return "刚刚";
    }

    if (elapsedHours < 24) {
        return `${elapsedHours}h`;
    }

    return `${Math.floor(elapsedHours / 24)}d`;
};

export const buildStepItems = (
    timeline: readonly TimelineLike[],
): WorkerServiceAuditStepItem[] => {
    const submitted = findLatestTimelineItem(timeline, [
        "submitted",
        "updated",
    ]);
    const currentAttemptTimeline = getCurrentAttemptTimeline(
        timeline,
        submitted,
    );
    const withdrawn = findLatestTimelineItem(currentAttemptTimeline, [
        "withdrawn",
    ]);
    const result = findLatestTimelineItem(currentAttemptTimeline, [
        "approved",
        "rejected",
        "takendown",
    ]);

    const hasResult = Boolean(result);
    const hasWithdrawn = Boolean(withdrawn);
    const isReviewing = Boolean(submitted) && !hasResult && !hasWithdrawn;

    return [
        {
            key: "submitted",
            label: submitted?.type === "updated" ? "更新已提交" : "已提交",
            at: getTimelineDate(submitted),
            state: submitted ? "done" : "waiting",
            note: submitted?.note ?? null,
        },
        {
            key: "reviewing",
            label: hasWithdrawn
                ? "审核已终止"
                : hasResult
                  ? "平台已审核"
                  : "审核中",
            at: null,
            state:
                hasResult || hasWithdrawn
                    ? "done"
                    : isReviewing
                      ? "current"
                      : "waiting",
        },
        {
            key: "result",
            label: hasWithdrawn ? "已撤回" : getResultStepLabel(result),
            at: getTimelineDate(withdrawn ?? result),
            state: hasWithdrawn ? "withdrawn" : hasResult ? "done" : "waiting",
            note: withdrawn?.note ?? result?.note ?? null,
        },
    ];
};

export const hasSensitiveServiceChanges = (
    input: SensitiveServiceChangesInput,
) => {
    const before = input.current ?? input.before ?? input.original ?? null;
    const after = input.next ?? input.after ?? input.draft ?? null;

    return (
        normalizeDescription(before?.description) !==
            normalizeDescription(after?.description) ||
        normalizeGalleryFileIds(before?.galleryFileIds) !==
            normalizeGalleryFileIds(after?.galleryFileIds) ||
        normalizeSpecs(before) !== normalizeSpecs(after)
    );
};

const normalizeDate = (date: DateInput) => {
    if (date === null || date === undefined) {
        return null;
    }

    const parsedDate = date instanceof Date ? date : new Date(date);

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getTimelineDate = (item?: TimelineLike | null) =>
    normalizeDate(item?.at ?? item?.occurredAt);

const findLatestTimelineItem = (
    timeline: readonly TimelineLike[],
    types: readonly TimelineLike["type"][],
) => {
    let latestItem: TimelineLike | null = null;
    let latestTime = Number.NEGATIVE_INFINITY;

    for (const item of timeline) {
        if (!types.includes(item.type)) {
            continue;
        }

        const itemDate = getTimelineDate(item);
        const itemTime = itemDate?.getTime() ?? Number.NEGATIVE_INFINITY;

        if (itemTime >= latestTime) {
            latestItem = item;
            latestTime = itemTime;
        }
    }

    return latestItem;
};

const getCurrentAttemptTimeline = (
    timeline: readonly TimelineLike[],
    attemptStart?: TimelineLike | null,
) => {
    if (!attemptStart) {
        return timeline;
    }

    const attemptStartDate = getTimelineDate(attemptStart);
    const attemptStartIndex = timeline.indexOf(attemptStart);

    return timeline.filter((item, index) => {
        if (attemptStartDate) {
            const itemDate = getTimelineDate(item);

            return itemDate
                ? itemDate.getTime() >= attemptStartDate.getTime()
                : index >= attemptStartIndex;
        }

        return index >= attemptStartIndex;
    });
};

const getResultStepLabel = (item?: TimelineLike | null) => {
    switch (item?.type) {
        case "approved":
            return "审核通过";
        case "rejected":
            return "审核未通过";
        case "takendown":
            return "已下架";
        default:
            return "等待结果";
    }
};

const normalizeDescription = (description?: string | null) =>
    (description ?? "").trim();

const normalizeGalleryFileIds = (galleryFileIds?: readonly string[] | null) =>
    (galleryFileIds ?? []).join("|");

const normalizeSpecs = (snapshot?: SensitiveServiceSnapshot | null) => {
    const specs = snapshot?.specs ?? snapshot?.specifications ?? [];
    if (!Array.isArray(specs)) {
        return JSON.stringify(specs);
    }

    return JSON.stringify(
        specs
            .map((spec) =>
                spec && typeof spec === "object"
                    ? sortObjectKeys(spec as Record<string, unknown>)
                    : spec,
            )
            .sort((left, right) =>
                JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
    );
};

const sortObjectKeys = (value: Record<string, unknown>) =>
    Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
    );
