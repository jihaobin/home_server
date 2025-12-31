import { Button } from "@repo/mobile-ui/components/ui/button";
import { Card, CardContent } from "@repo/mobile-ui/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/mobile-ui/components/ui/dialog";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Edit } from "@repo/mobile-ui/lib/icons/Edit";
import { MapPin } from "@repo/mobile-ui/lib/icons/MapPin";
import { X } from "@repo/mobile-ui/lib/icons/X";
import type { UserAddresses } from "@repo/types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { toast } from "sonner-native";
import { useDeleteAddress, useUserAddresses } from "@repo/hooks/api/address";
import { useAddressEditStore } from "@/stores/address-store";

// 服务地址项组件
const ServiceAddressItem = ({
    address,
    onEdit,
    onDelete,
    onSelect,
    selectable = false,
}: {
        address: UserAddresses;
        onEdit: (address: UserAddresses) => void;
        onDelete?: (address: UserAddresses) => void;
        onSelect?: (address: UserAddresses) => void;
        selectable?: boolean;
}) => {
    return (
        <Card className="mx-4 mb-3 bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden relative p-0">
            {/* 右上角关闭按钮 - 固定在卡片顶端 */}
            {onDelete && (
                <Dialog>
                    <DialogTrigger asChild>
                        <Pressable className="absolute top-3 right-3 z-20 p-1.5 bg-muted/80 rounded-full shadow-sm">
                            <X size={14} className="text-muted-foreground" />
                        </Pressable>
                    </DialogTrigger>
                    <DialogContent className="bg-card rounded-2xl shadow-xl w-80 border border-border">
                        <DialogHeader>
                            <DialogTitle className="text-foreground">删除地址</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                确认删除此地址吗?删除后将无法恢复。
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex-row gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" className="flex-1 rounded-xl">
                                    <Text className="text-foreground">取消</Text>
                                </Button>
                            </DialogClose>
                            <Button onPress={() => onDelete(address)} className="flex-1 rounded-xl bg-destructive">
                                <Text className="text-destructive-foreground">确认删除</Text>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <Pressable
                onPress={() => selectable && onSelect?.(address)}
                disabled={!selectable}
                className={selectable ? "active:opacity-70 active:scale-[0.98]" : ""}
            >
                <CardContent className="p-0">
                    <View className="relative p-4 pr-16">
                        <View className="flex-row items-start flex-1 pr-2">
                            {/* 左侧定位图标容器 */}
                            <View className="mr-3 mt-1 bg-primary/10 rounded-full p-2">
                                <MapPin size={18} className="text-primary" />
                            </View>

                            {/* 地址信息 */}
                            <View className="flex-1">
                                {/* 用户信息行 */}
                                <View className="flex-row items-center mb-2 flex-wrap">
                                    <Text className="text-base font-semibold text-foreground mr-2">
                                        {address.recipientName}
                                    </Text>
                                    {address.isDefault && (
                                        <View className="bg-primary/15 px-2 py-0.5 rounded-full mr-2">
                                            <Text className="text-xs font-medium text-primary">默认</Text>
                                        </View>
                                    )}
                                    <View className="bg-accent/80 px-2 py-0.5 rounded-full mr-2">
                                        <Text className="text-xs font-medium text-accent-foreground">
                                            {address.sex ? "先生" : "女士"}
                                        </Text>
                                    </View>
                                </View>

                                {/* 电话号码 */}
                                <Text className="text-sm text-muted-foreground mb-2 font-medium">
                                    {address.recipientPhone}
                                </Text>

                                {/* 地址行 */}
                                <Text className="text-sm text-foreground/80 leading-5" numberOfLines={2}>
                                    {address.detailedAddress}
                                </Text>
                            </View>
                        </View>

                        {/* 右侧编辑按钮 - 居右居中 */}
                        {!selectable && (
                            <Pressable
                                onPress={() => onEdit(address)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-muted/50 rounded-full active:bg-muted"
                            >
                                <Edit size={16} className="text-muted-foreground" />
                            </Pressable>
                        )}
                    </View>

                    {/* 选择模式提示 */}
                    {selectable && (
                        <View className="mt-3 pt-3 border-t border-border/50">
                            <Text className="text-xs text-primary text-center font-medium">
                                点击选择此地址
                            </Text>
                        </View>
                    )}
                </CardContent>
            </Pressable>
        </Card>
    );
};

// 服务地址页面主组件
export default function ServiceAddressScreen() {
    const deleteAddress = useDeleteAddress();
    const { setSelectedAddress } = useAddressEditStore();
    const params = useLocalSearchParams<{ mode?: string }>();

    const {
        data,
        refetch: refetchAddresses,
        isFetching: isFetchingAddresses,
    } = useUserAddresses();

    // 判断是否为选择模式（从订单确认页跳转过来）
    const isSelectMode = params.mode === "select";

    const handleEditAddress = (address: UserAddresses) => {
        // 导航到编辑地址页面，传递地址ID
        setSelectedAddress({
            ...address,
            lat: address.geom![0],
            lng: address.geom![1],
        });
        router.push({
            pathname: "./edit-address",
        });
    };

    const handleSelectAddress = (address: UserAddresses) => {
        // 选择地址模式：保存选中的地址并返回
        setSelectedAddress({
            ...address,
            lat: address.geom![0],
            lng: address.geom![1],
        });
        router.back();
    };

    const handleDeleteAddress = (address: UserAddresses) => {
        deleteAddress.mutate(address.id, {
            onSuccess: () => {
                toast.success("删除地址成功");
            },
            onError: (error) => {
                toast.error("删除地址失败");
            },
        });
    };

    const handleAddAddress = () => {
        // 导航到添加地址页面
        router.push("./edit-address");
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refetchAddresses({
                throwOnError: false,
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [refetchAddresses]);

    const refreshingState = isRefreshing || isFetchingAddresses;

    return (
        <View className="flex-1 bg-background">
            {/* 顶部说明卡片 */}
            {isSelectMode && data.length > 0 && (
                <View className="mx-4 mt-4 mb-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <Text className="text-sm text-primary text-center font-medium">
                        请选择服务地址
                    </Text>
                </View>
            )}

            {/* 地址列表 */}
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshingState}
                        onRefresh={handleRefresh}
                    />
                }
            >
                <View className="py-4">
                    {data.length > 0 ? (
                        data
                            .sort((a, b) =>
                                a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1
                            )
                            .map((address) => (
                                <ServiceAddressItem
                                    key={address.id}
                                    address={address}
                                    onEdit={handleEditAddress}
                                    onDelete={isSelectMode ? undefined : handleDeleteAddress}
                                    onSelect={isSelectMode ? handleSelectAddress : undefined}
                                    selectable={isSelectMode}
                                />
                            ))
                    ) : (
                        <View className="flex-1 items-center justify-center py-20 px-6">
                            <View className="bg-muted/30 rounded-full p-6 mb-4">
                                <MapPin size={48} className="text-muted-foreground" />
                            </View>
                            <Text className="text-foreground text-lg font-semibold mb-2">
                                还没有服务地址
                            </Text>
                            <Text className="text-muted-foreground text-sm text-center">
                                点击下方按钮添加您的第一个服务地址
                            </Text>
                        </View>
                    )}
                </View>

                {/* 底部安全区域 */}
                <View className="h-20" />
            </ScrollView>

            {/* 底部添加按钮 - 固定在底部 */}
            <View className="p-4 bg-background/95 backdrop-blur-sm border-t border-border/50">
                <Button
                    onPress={handleAddAddress}
                    className="h-12 rounded-xl shadow-sm"
                >
                    <Text className="text-primary-foreground text-base font-semibold">
                        ⊕ 添加服务地址
                    </Text>
                </Button>
            </View>
        </View>
    );
}
