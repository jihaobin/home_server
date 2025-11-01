import type { OrderListResponseItem } from "@repo/types";
import {
	type LucideIcon,
	icons as lucideIconRegistry,
} from "lucide-react-native";
import {
	SECTION_ORDER,
	STATUS_SECTION_CONFIG,
	TAB_STATUS_MAP,
	WEEKDAY_MAP,
} from "./mock";
import type {
	IconName,
	OrdersListRow,
	OrdersSection,
	OrderTabId,
    StatusSectionConfig,
} from "./types";

const toDate = (
	value: Date | string | null | undefined,
): Date | null => {
	if (!value) {
		return null;
	}
	return value instanceof Date ? value : new Date(value);
};

const formatDateTime = (value: Date | string | null | undefined) => {
	const date = toDate(value);
	if (!date || Number.isNaN(date.getTime())) {
		return "--";
	}
	try {
		return new Intl.DateTimeFormat("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			weekday: "short",
		}).format(date);
	} catch {
		return date.toLocaleString();
	}
};

const formatDate = (value: Date | string | null | undefined) => {
	const date = toDate(value);
	if (!date || Number.isNaN(date.getTime())) {
		return "--";
	}
	try {
		return new Intl.DateTimeFormat("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(date);
	} catch {
		return date.toDateString();
	}
};

const formatCurrency = (amount: number, currency: string = "CNY") => {
	if (Number.isNaN(amount)) {
		return "--";
	}
	try {
		return new Intl.NumberFormat("zh-CN", {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
		}).format(amount);
	} catch {
		const symbol = currency === "CNY" ? "¥" : "";
		return `${symbol}${amount.toFixed(2)}`;
	}
};

const formatPhone = (phone: string) =>
	phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

const formatWorkDays = (workDays: string) => {
	const uniqueDays = Array.from(new Set(workDays.split("")));
	const labels = uniqueDays.map((day) => WEEKDAY_MAP[day] ?? day);
	return labels.join("、");
};

const getIconComponent = (name?: IconName): LucideIcon | undefined => {
	if (!name) {
		return undefined;
	}

	return lucideIconRegistry[name] as LucideIcon | undefined;
};

const buildSections = (
    orders: OrderListResponseItem[],
    activeTab: OrderTabId,
): OrdersSection[] => {
    const targetStatuses = TAB_STATUS_MAP[activeTab];
    const filtered =
        activeTab === "all"
            ? orders
            : orders.filter((order) => targetStatuses.includes(order.status));

    const grouped = new Map<
        string,
        {
            config: StatusSectionConfig;
            items: OrderListResponseItem[];
        }
    >();

    filtered.forEach((order) => {
        const config = STATUS_SECTION_CONFIG[order.status];
        const section = grouped.get(config.sectionId) ?? {
            config,
            items: [] as OrderListResponseItem[],
        };
        section.items.push(order);
        grouped.set(config.sectionId, section);
    });

    return SECTION_ORDER.map((sectionId) => {
        const group = Array.from(grouped.values()).find(
            (item) => item.config.sectionId === sectionId
        );

        if (!group) {
            return null;
        }

        const sortedItems = group.items.sort(
            (a, b) => toDate(a.appointmentTime)?.getTime() ??
                0 - (toDate(b.appointmentTime)?.getTime() ?? 0)
        );

        return {
            ...group.config,
            badgeText: `${sortedItems.length} 笔`,
            data: sortedItems,
        };
    }).filter(Boolean) as unknown as OrdersSection[];
};

const flattenSectionsToRows = (
	sections: OrdersSection[],
): { rows: OrdersListRow[]; stickyHeaderIndices: number[] } => {
	const rows: OrdersListRow[] = [];
	const stickyHeaderIndices: number[] = [];

	sections.forEach((section) => {
		const headerIndex = rows.length;
		rows.push({
			key: `${section.sectionId}-header`,
			type: "header",
			section,
		});
		stickyHeaderIndices.push(headerIndex);

		section.data.forEach((order) => {
			rows.push({
				key: `${section.sectionId}-${order.id}`,
				type: "order",
				section,
				order,
			});
		});
	});

	return { rows, stickyHeaderIndices };
};

export { formatDateTime, formatDate, formatCurrency, formatPhone, formatWorkDays, getIconComponent, buildSections, flattenSectionsToRows };