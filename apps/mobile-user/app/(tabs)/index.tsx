import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/mobile-ui/components/ui/card";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { router } from "expo-router";
import { useState } from "react";
import {
	Image,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { LogoutButton } from "@/components/LogoutButton";
import { useOrderCheckin } from "@/hooks/api/order";
import { useSession } from "@/hooks/useAuth";

export default function HomeScreen() {
	const [refreshing, setRefreshing] = useState(false);
	const { data: session, refetch } = useSession();

	// 从 session 中获取用户信息
	const user = session?.user;

	const { data: chieckIndata } = useOrderCheckin("fspiuan9dfy1t30");

	const onRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	return (
		<ScrollView
			className="flex-1 bg-background"
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
		>
			<View className="px-6 py-8">
				{/* Header */}
				<View className="flex-row justify-between items-center mb-6">
					<View>
						<Text className="text-2xl font-bold text-foreground">
							欢迎回来！
						</Text>
						{user && (
							<Text className="text-muted-foreground mt-1">
								{user.name || user.email}
							</Text>
						)}
					</View>
					<LogoutButton variant="outline" size="sm" />
				</View>

				{/* Services Grid */}
				<View className="mb-6">
					<Text className="text-lg font-semibold text-foreground mb-4">
						热门服务
					</Text>
					<View className="flex-row flex-wrap gap-3">
						<Card className="flex-1 min-w-[140px]">
							<CardContent className="p-4 items-center">
								<View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-3">
									<Text className="text-blue-600 text-xl">🔧</Text>
								</View>
								<Text className="font-medium text-center">家电维修</Text>
							</CardContent>
						</Card>

						<Card className="flex-1 min-w-[140px]">
							<CardContent className="p-4 items-center">
								<View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-3">
									<Text className="text-green-600 text-xl">🧹</Text>
								</View>
								<Text className="font-medium text-center">清洁保洁</Text>
							</CardContent>
						</Card>
					</View>

					<View className="flex-row flex-wrap gap-3 mt-3">
						<Card className="flex-1 min-w-[140px]">
							<CardContent className="p-4 items-center">
								<View className="w-12 h-12 rounded-full bg-purple-100 items-center justify-center mb-3">
									<Text className="text-purple-600 text-xl">🔨</Text>
								</View>
								<Text className="font-medium text-center">装修安装</Text>
							</CardContent>
						</Card>

						<Card className="flex-1 min-w-[140px]">
							<CardContent className="p-4 items-center">
								<View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center mb-3">
									<Text className="text-orange-600 text-xl">🚗</Text>
								</View>
								<Text className="font-medium text-center">搬家服务</Text>
							</CardContent>
						</Card>
					</View>
				</View>

				{/* Recent Orders */}
				<View className="mb-6">
					<Text className="text-lg font-semibold text-foreground mb-4">
						最近订单
					</Text>
					<Card>
						<CardContent className="p-4">
							<View className="items-center py-8">
								<Text className="text-muted-foreground text-center">
									暂无订单记录
								</Text>
								<Text className="text-sm text-muted-foreground text-center mt-2">
									预约服务后，订单将显示在这里
								</Text>
							</View>
						</CardContent>
					</Card>
				</View>

				{/* Quick Actions */}
				<View>
					<Text className="text-lg font-semibold text-foreground mb-4">
						快捷操作
					</Text>
					<View className="space-y-3">
						<Pressable onPress={() => router.push("/address/service-address")}>
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base">服务地址</CardTitle>
									<CardDescription>管理您的服务地址信息</CardDescription>
								</CardHeader>
							</Card>
						</Pressable>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">查看附近服务</CardTitle>
								<CardDescription>找到您周围的优质服务提供者</CardDescription>
							</CardHeader>
						</Card>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">我的收藏</CardTitle>
								<CardDescription>管理您收藏的服务和商家</CardDescription>
							</CardHeader>
						</Card>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">客服中心</CardTitle>
								<CardDescription>遇到问题？联系我们的客服团队</CardDescription>
							</CardHeader>
						</Card>
					</View>
				</View>
			</View>

			<Image
				source={{ uri: chieckIndata?.qrCodeDataUrl }}
				style={{ width: 200, height: 200 }}
				resizeMode="contain"
			/>
		</ScrollView>
	);
}
