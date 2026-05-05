import type { OrderStatus, OrderTab, OrderTabId, StatusSectionConfig } from "./types";

const ORDER_TABS: OrderTab[] = [
	{ id: "all", label: "所有订单", subLabel: "最近更新" },
	{ id: "pending", label: "待支付订单", subLabel: "支付提醒" },
	{ id: "paid", label: "待确认/待服务", subLabel: "等待上门" },
	{ id: "finished", label: "已完成订单", subLabel: "记录评价" },
	{ id: "canceled", label: "已取消订单", subLabel: "取消详情" },
	{ id: "refunded", label: "已退款订单", subLabel: "资金进度" },
	{ id: "reviews", label: "我的评价", subLabel: "历史记录" },
];

const TAB_STATUS_MAP: Record<OrderTabId, OrderStatus[]> = {
	all: [
		"pending_payment",
		"payment_timeout",
        "pending_acceptance",
		"paid",
		"completed",
		"cancelled",
		"refunded",
        "staff_rejected",
	],
	pending: ["pending_payment"],
	paid: ["pending_acceptance", "paid"],
	finished: ["completed"],
	canceled: ["cancelled", "payment_timeout", "staff_rejected"],
	refunded: ["refunded"],
	reviews: [], // Reviews tab doesn't filter by order status
};

const SECTION_ORDER = [
	"pending-payment",
    "pending-acceptance",
	"paid-ready",
	"completed",
    "staff-rejected",
	"payment-timeout",
	"cancelled",
	"refunded",
];

const STATUS_LABEL_MAP: Record<OrderStatus, string> = {
	pending_payment: "待支付",
	payment_timeout: "支付超时",
    pending_acceptance: "待接单确认",
	paid: "待服务",
	completed: "已完成",
	cancelled: "已取消",
	refunded: "已退款",
    staff_rejected: "服务人员已拒绝",
};

const STATUS_SECTION_CONFIG: Record<OrderStatus, StatusSectionConfig> = {
	pending_payment: {
		sectionId: "pending-payment",
		sectionTitle: "待支付提醒",
		sectionDescription:
			"支付完成后系统会立即锁定档期，如需延时可先联系客服协助。",
		accentClassName: "bg-orange-400/90 dark:bg-orange-500/80",
		cardClassName: "border-orange-200/70 dark:border-orange-800/60 bg-orange-50/60 dark:bg-orange-950/40",
		infoCardClassName: "bg-orange-100/50 dark:bg-orange-900/20",
		icon: "AlarmClock",
		iconClassName: "text-orange-600 dark:text-orange-400",
		badgeClassName: "bg-orange-100/80 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200",
		statusBadgeClassName: "bg-orange-500/90 dark:bg-orange-600/80 text-white dark:text-orange-50",
	},
    pending_acceptance: {
        sectionId: "pending-acceptance",
        sectionTitle: "服务人员确认中",
        sectionDescription:
            "订单已支付，正在与服务人员确认档期，请耐心等待或联系客服调整时间。",
        accentClassName: "bg-amber-400/90 dark:bg-amber-500/80",
        cardClassName:
            "border-amber-200/70 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30",
        infoCardClassName: "bg-amber-100/60 dark:bg-amber-900/20",
        icon: "BellRing",
        iconClassName: "text-amber-600 dark:text-amber-400",
        badgeClassName:
            "bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200",
        statusBadgeClassName:
            "bg-amber-500/90 dark:bg-amber-600/80 text-white dark:text-amber-50",
    },
	paid: {
		sectionId: "paid-ready",
		sectionTitle: "已支付待服务",
		sectionDescription:
			"服务人员将在上门前与您确认门禁与停车信息，请保持电话畅通。",
		accentClassName: "bg-cyan-500/80 dark:bg-cyan-500/70",
		cardClassName: "border-cyan-200/70 dark:border-cyan-800/60 bg-cyan-50/60 dark:bg-cyan-950/40",
		infoCardClassName: "bg-cyan-100/50 dark:bg-cyan-900/20",
		icon: "CalendarClock",
		iconClassName: "text-cyan-600 dark:text-cyan-400",
		badgeClassName: "bg-cyan-100/80 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200",
		statusBadgeClassName: "bg-cyan-500/90 dark:bg-cyan-600/80 text-white dark:text-cyan-50",
	},
	completed: {
		sectionId: "completed",
		sectionTitle: "已完成记录",
		sectionDescription:
			"可查看历史订单详情、再次预约或补充评价，积分奖励实时到账。",
		accentClassName: "bg-emerald-500/80 dark:bg-emerald-500/70",
		cardClassName: "border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40",
		infoCardClassName: "bg-emerald-100/50 dark:bg-emerald-900/20",
		icon: "BadgeCheck",
		iconClassName: "text-emerald-600 dark:text-emerald-400",
		badgeClassName: "bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200",
		statusBadgeClassName: "bg-emerald-500/90 dark:bg-emerald-600/80 text-white dark:text-emerald-50",
	},
	payment_timeout: {
		sectionId: "payment-timeout",
		sectionTitle: "支付超时提醒",
		sectionDescription:
			"支付超时后订单档期已释放，如仍需服务请重新下单，客服可协助保留原预约信息。",
		accentClassName: "bg-rose-500/80 dark:bg-rose-500/70",
		cardClassName: "border-rose-200/70 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/40",
		infoCardClassName: "bg-rose-100/50 dark:bg-rose-900/20",
		icon: "AlarmClockOff",
		iconClassName: "text-rose-600 dark:text-rose-400",
		badgeClassName: "bg-rose-100/80 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200",
		statusBadgeClassName: "bg-rose-500/90 dark:bg-rose-600/80 text-white dark:text-rose-50",
	},
	cancelled: {
		sectionId: "cancelled",
		sectionTitle: "已取消订单",
		sectionDescription:
			"记录取消原因，必要时可重新下单或联系客服协调新的服务时间。",
		accentClassName: "bg-slate-400/70 dark:bg-slate-500/60",
		cardClassName: "border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40",
		infoCardClassName: "bg-slate-100/50 dark:bg-slate-800/20",
		icon: "Ban",
		iconClassName: "text-slate-600 dark:text-slate-400",
		badgeClassName: "bg-slate-100/80 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200",
		statusBadgeClassName: "bg-slate-400/90 dark:bg-slate-600/80 text-white dark:text-slate-50",
	},
	refunded: {
		sectionId: "refunded",
		sectionTitle: "退款进度",
		sectionDescription:
			"退款已原路退回或正在处理中，请留意银行短信与平台通知。",
		accentClassName: "bg-purple-500/80 dark:bg-purple-500/70",
		cardClassName: "border-purple-200/70 dark:border-purple-800/60 bg-purple-50/60 dark:bg-purple-950/40",
		infoCardClassName: "bg-purple-100/50 dark:bg-purple-900/20",
		icon: "CircleDollarSign",
		iconClassName: "text-purple-600 dark:text-purple-400",
		badgeClassName: "bg-purple-100/80 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200",
		statusBadgeClassName: "bg-purple-500/90 dark:bg-purple-600/80 text-white dark:text-purple-50",
	},
    staff_rejected: {
        sectionId: "staff-rejected",
        sectionTitle: "服务人员无法接单",
        sectionDescription:
            "原服务人员暂时无法提供服务，已为您开通重新预约入口，客服也会协助联系其他师傅。",
        accentClassName: "bg-slate-400/70 dark:bg-slate-500/60",
        cardClassName:
            "border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40",
        infoCardClassName: "bg-slate-100/50 dark:bg-slate-800/20",
        icon: "UserX",
        iconClassName: "text-slate-600 dark:text-slate-400",
        badgeClassName:
            "bg-slate-100/80 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200",
        statusBadgeClassName:
            "bg-slate-500/90 dark:bg-slate-600/80 text-white dark:text-slate-50",
    },
};

export const WEEKDAY_MAP: Record<string, string> = {
	"1": "周一",
	"2": "周二",
	"3": "周三",
	"4": "周四",
	"5": "周五",
	"6": "周六",
	"7": "周日",
};

export {
	ORDER_TABS,
	TAB_STATUS_MAP,
    SECTION_ORDER,
    STATUS_LABEL_MAP,
    STATUS_SECTION_CONFIG,
};
