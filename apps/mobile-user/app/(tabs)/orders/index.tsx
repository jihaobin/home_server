import { Text } from "@repo/mobile-ui/components/ui/text";
import type { OrderStatus } from "@repo/types";
import { FlashList, type RenderTarget } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, type ListRenderItemInfo, View } from "react-native";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { ORDER_TABS, TAB_STATUS_MAP } from "@/components/orders_screen/mock";
import type { OrdersListRow, OrderTab, OrderTabId } from "@/components/orders_screen/types";
import {
	buildSections,
	flattenSectionsToRows,
} from "@/components/orders_screen/utils";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useOrdersListInfinite } from "@repo/hooks/api/order";
import { TabItem } from "@/components/orders_screen/components/TabItem";
import { SectionHeader } from "@/components/orders_screen/components/SectionHeader";
import { OrderCard } from "@/components/orders_screen/components/OrderCard";
import { ReviewCard } from "@/components/orders_screen/components/ReviewCard";
import { useLocalSearchParams } from "expo-router";

const ORDER_STATUS_WHITELIST = new Set<OrderStatus>(
	Object.values(TAB_STATUS_MAP).flat() as OrderStatus[],
);

export default function OrdersScreen() {
	const params = useLocalSearchParams<{
		tab?: OrderTabId;
		status?: OrderStatus;
		requestId?: string;
	}>();
	const paramTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
	const paramStatus = Array.isArray(params.status)
		? params.status[0]
		: params.status;
	const paramRequestId = Array.isArray(params.requestId)
		? params.requestId[0]
		: params.requestId;
	const [activeTab, setActiveTab] = useState<OrderTab>(ORDER_TABS[0]);
	const [quickFilterStatus, setQuickFilterStatus] = useState<OrderStatus>();
	const { session } = useSession();

	useEffect(() => {
		if (!paramTab && !paramStatus) {
			setQuickFilterStatus(undefined);
			return;
		}

		if (paramTab) {
			const targetTab = ORDER_TABS.find((tab) => tab.id === paramTab);
			if (targetTab) {
				setActiveTab(targetTab);
			}
		}

		if (paramStatus && ORDER_STATUS_WHITELIST.has(paramStatus)) {
			setQuickFilterStatus(paramStatus);
		}
	}, [paramTab, paramStatus, paramRequestId]);

	const handleTabPress = useCallback((tab: OrderTab) => {
		setQuickFilterStatus(undefined);
		setActiveTab(tab);
	}, []);

	// 根据tab获取对应的状态筛选
	const tabStatusFilter = useMemo<OrderStatus | undefined>(() => {
		if (activeTab.id === "all") {
			return undefined; // 不传状态则获取所有
		}
		const statuses = TAB_STATUS_MAP[activeTab.id];
		// 如果该tab只对应一个状态，则传该状态
		// 如果对应多个状态（如"paid"包括"paid"和"in_progress"），则不传status参数，在前端过滤
		if (statuses && statuses.length === 1) {
			return statuses[0] as OrderStatus;
		}
		return undefined;
	}, [activeTab.id]);
	const statusFilter = quickFilterStatus ?? tabStatusFilter;

	// 获取订单列表数据
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
	} = useOrdersListInfinite({
		customerId: session?.user?.id || "",
		status: statusFilter,
		sortOrder: "desc",
	});
	const [isRefreshing, setIsRefreshing] = useState(false);

	// 将所有页的数据合并，并根据tab筛选
	const allOrders = useMemo(() => {
		if (!session?.user?.id) {
			return [];
		}
		let orders = data?.pages.flatMap((page) => page.data) ?? [];

		// 如果该tab对应多个状态，需要在前端过滤
		if (activeTab.id !== "all") {
			const targetStatuses = TAB_STATUS_MAP[activeTab.id];
			if (targetStatuses && targetStatuses.length > 1 && !quickFilterStatus) {
				orders = orders.filter((order) =>
					targetStatuses.includes(order.status as OrderStatus),
				);
			}
		}

		if (quickFilterStatus) {
			orders = orders.filter((order) => order.status === quickFilterStatus);
		}

		return orders;
	}, [data, session?.user?.id, activeTab.id, quickFilterStatus]);

	const sections = useMemo(
		() => buildSections(allOrders, activeTab.id),
		[allOrders, activeTab.id],
	);

	const { rows: listRows, stickyHeaderIndices } = useMemo(() => {
		const flattened = flattenSectionsToRows(sections);
		return {
			rows: flattened.rows,
			stickyHeaderIndices: flattened.stickyHeaderIndices,
		};
	}, [sections]);

	const renderTab = useCallback(
		({ item }: ListRenderItemInfo<OrderTab>) => (
			<TabItem
				item={item}
				isActive={item.id === activeTab.id}
				onPress={handleTabPress}
			/>
		),
		[activeTab.id, handleTabPress],
	);

	const tabKeyExtractor = useCallback((item: OrderTab) => item.id, []);

	const renderRow = useCallback(
		({
			item,
			index,
			target,
		}: {
			item: OrdersListRow;
			index: number;
			target: RenderTarget;
		}) => {
			if (item.type === "header") {
				return (
					<SectionHeader
						section={item.section}
						isFirst={index === 0}
						isSticky={target === "StickyHeader"}
					/>
				);
			}

			if (item.type === "order") {
				return <OrderCard order={item.order} section={item.section} />;
			}

			return <ReviewCard review={item.review} />;
		},
		[],
	);

	const rowKeyExtractor = useCallback((item: OrdersListRow) => item.key, []);

	// 加载更多
	const handleLoadMore = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetch({
				throwOnError: false,
			});
		} finally {
			setIsRefreshing(false);
		}
	}, [refetch]);

	const listHeaderComponent = useCallback(() => {
		return (
			<View>
				<View className="px-4 pb-4 pt-10">
					<Text
						className="text-2xl font-semibold text-foreground"
						numberOfLines={1}
					>
						订单中心
					</Text>
					<Text
						className="mt-1 text-sm text-muted-foreground"
						numberOfLines={2}
					>
						随时掌握服务进度，查看支付、门禁、售后等信息，安心等待上门。
					</Text>
				</View>

				<View className="border-b border-border px-4 pb-3">
					<FlatList
						data={ORDER_TABS}
						horizontal
						showsHorizontalScrollIndicator={false}
						renderItem={renderTab}
						keyExtractor={tabKeyExtractor}
						contentContainerStyle={{ paddingRight: 16 }}
					/>
				</View>
			</View>
		);
	}, [renderTab, tabKeyExtractor]);

	return (
		<RequireAuth>
			<View className="flex-1 bg-bakcground">
				<FlashList
					data={listRows}
					renderItem={renderRow}
					keyExtractor={rowKeyExtractor}
					stickyHeaderIndices={stickyHeaderIndices}
					getItemType={(item) => item.type}
					showsVerticalScrollIndicator={false}
					onEndReached={handleLoadMore}
					onEndReachedThreshold={0.5}
					ListHeaderComponent={listHeaderComponent}
					refreshing={isRefreshing}
					onRefresh={handleRefresh}
					contentContainerStyle={{
						paddingHorizontal: 16,
						paddingBottom: 24,
					}}
					ListEmptyComponent={
						isLoading ? (
							<View className="flex-1 items-center justify-center px-8 py-24">
								<Text className="text-center text-sm text-muted-foreground">
									加载中...
								</Text>
							</View>
						) : (
							<View className="flex-1 items-center justify-center px-8 py-24">
								<Text
									className="text-sm font-medium text-muted-foreground"
									numberOfLines={1}
								>
									暂无此分类的订单
								</Text>
								<Text
									className="mt-1 text-xs text-muted-foreground"
									numberOfLines={2}
								>
									可以尝试切换分类或返回首页挑选新的服务项目。
								</Text>
							</View>
						)
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View className="py-4">
								<Text className="text-center text-sm text-muted-foreground">
									加载中...
								</Text>
							</View>
						) : null
					}
				/>
			</View>
		</RequireAuth>
	);
}
