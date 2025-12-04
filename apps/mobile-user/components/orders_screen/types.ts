import type { OrderListSimplifiedItem, ReviewerTargetItem } from "@repo/types";

type IconName = keyof typeof import("lucide-react-native").icons;

type OrderStatus = OrderListSimplifiedItem["status"];

type OrderTabId =
	| "all"
	| "pending"
	| "paid"
	| "finished"
	| "canceled"
	| "refunded"
	| "reviews";

type OrderTab = {
	id: OrderTabId;
	label: string;
	subLabel?: string;
};

type StatusSectionConfig = {
	sectionId: string;
	sectionTitle: string;
	sectionDescription: string;
	accentClassName: string;
	cardClassName: string;
	infoCardClassName: string;
	icon?: IconName;
	iconClassName?: string;
	badgeClassName?: string;
	statusBadgeClassName: string;
};

type OrdersSection = StatusSectionConfig & {
	badgeText: string;
	data: OrderListSimplifiedItem[];
};

type OrdersListRow =
	| {
			key: string;
			type: "header";
			section: OrdersSection;
	  }
	| {
			key: string;
			type: "order";
			section: OrdersSection;
			order: OrderListSimplifiedItem;
	  }
	| {
			key: string;
			type: "review";
			review: ReviewerTargetItem;
	  };

type TabItemProps = {
	item: OrderTab;
	isActive: boolean;
	onPress: (tab: OrderTab) => void;
};

type SectionHeaderProps = {
	section: OrdersSection;
	isFirst: boolean;
	isSticky: boolean;
};

type OrderCardProps = {
	order: OrderListSimplifiedItem;
	section: OrdersSection;
};

type ReviewCardProps = {
	review: ReviewerTargetItem;
};

export type {
	IconName,
	OrderStatus,
	OrderTabId,
	OrderTab,
	StatusSectionConfig,
	OrdersSection,
	OrdersListRow,
	TabItemProps,
	SectionHeaderProps,
	OrderCardProps,
	ReviewCardProps,
};
