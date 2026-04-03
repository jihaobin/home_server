export function normalizeTransactionTimeInput(value: string | Date) {
    if (value instanceof Date) {
        return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return trimmedValue;
    }

    const hasPostgresStyleTimestamp =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/.test(
            trimmedValue,
        );

    if (!hasPostgresStyleTimestamp) {
        return trimmedValue;
    }

    return trimmedValue
        .replace(" ", "T")
        .replace(/([+-]\d{2})$/, "$1:00")
        .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

export function formatTransactionTime(value: string | Date) {
    const normalizedValue = normalizeTransactionTimeInput(value);
    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
    );

    let dayLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
    ).padStart(2, "0")}`;

    if (sameDay) {
        dayLabel = "今天";
    } else if (date.toDateString() === yesterday.toDateString()) {
        dayLabel = "昨天";
    }

    const timeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
    ).padStart(2, "0")}`;

    return `${dayLabel} ${timeLabel}`;
}

export function formatOptionalTransactionTime(value?: string | Date | null) {
    if (!value) {
        return "暂无";
    }

    return formatTransactionTime(value) || "暂无";
}
