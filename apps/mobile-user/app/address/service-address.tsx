import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { MapPin } from "@repo/mobile-ui/lib/icons/MapPin";
import { Edit } from "@repo/mobile-ui/lib/icons/Edit";
import { Card, CardContent } from "@repo/mobile-ui/components/ui/card";
import { X } from "@repo/mobile-ui/lib/icons/X";
import { UserAddresses } from "@repo/types";
import { useAddressEditStore } from "@/stores/address-store";
import { useDeleteAddress, useUserAddresses } from "@/hooks/api/address";
import { toast } from "sonner-native";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@repo/mobile-ui/components/ui/dialog";

// 服务地址项组件
const ServiceAddressItem = ({
    address,
    onEdit,
    onDelete,
}: {
        address: UserAddresses;
        onEdit: (address: UserAddresses) => void;
        onDelete?: (address: UserAddresses) => void;
}) => {
    return (
        <Card className="mx-4 mb-4 bg-white rounded-lg shadow-sm relative">
            <CardContent className="p-4">
                {/* 右上角关闭按钮 */}
                {onDelete && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <X size={16} className="text-gray-400  top-1 right-1 z-10" />
                        </DialogTrigger>
                        <DialogContent className="bg-white rounded-lg shadow-lg w-72">
                            <DialogHeader>
                                <DialogTitle>删除地址</DialogTitle>
                                <DialogDescription>
                                    确认删除此地址吗？
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">
                                        <Text>取消</Text>
                                    </Button>
                                </DialogClose>
                                <Button onPress={() => onDelete(address)}>
                                    <Text>确认</Text>
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                <View className="flex-row items-start justify-between pr-6">
                    <View className="flex-row items-start flex-1">
                        {/* 左侧定位图标 */}
                        <View className="mr-3 mt-0.5">
                            <MapPin size={20} className="text-primary" />
                        </View>

                        {/* 地址信息 */}
                        <View className="flex-1">
                            {/* 用户信息行 */}
                            <View className="flex-row items-center mb-2">
                                <Text className="text-base font-medium text-gray-900 mr-2">
                                    {address.recipientName}
                                </Text>
                                <Text className="text-sm bg-gray-100 mr-2">
                                    {address.isDefault ? "默认" : null}
                                </Text>
                                <Text className="text-sm bg-gray-100 mr-2">
                                    {address.sex ? "先生" : "女士"}
                                </Text>
                                <Text className="text-sm text-gray-900">
                                    {address.recipientPhone}
                                </Text>
                            </View>

                            {/* 地址行 */}
                            <Text className="text-sm text-gray-700 leading-5">
                                {address.detailedAddress}
                            </Text>
                        </View>
                    </View>

                    {/* 右侧编辑按钮 */}
                    <Pressable
                        onPress={() => onEdit(address)}
                        className="w-5 h-full flex items-center justify-center"
                    >
                        <Edit size={18} className="text-gray-400" />
                    </Pressable>
                </View>
            </CardContent>
        </Card>
    );
};

// 服务地址页面主组件
export default function ServiceAddressScreen() {
    const deleteAddress = useDeleteAddress();
    const { setSelectedAddress } = useAddressEditStore();

    const { data } = useUserAddresses();

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

    const handleDeleteAddress = (address: UserAddresses) => {
        deleteAddress.mutate(address.id, {
            onSuccess: () => {
                toast.success("删除地址成功");
            },
            onError: (error) => {
                toast.error("删除地址失败");
            }
        });
    };

    const handleAddAddress = () => {
    // 导航到添加地址页面
        router.push("./edit-address");
    };

    return (
        <View className="flex-1 bg-background">
            {/* 地址列表 */}
            <ScrollView className="flex-1">
                <View className="py-4">
                    {data.length > 0 ? (
                        data
                            .map((address) => (
                                <ServiceAddressItem
                                    key={address.id}
                                    address={address}
                                    onEdit={handleEditAddress}
                                    onDelete={handleDeleteAddress}
                                />
                            ))
                            .sort((a, b) =>
                                a.props.address.isDefault ===
                                    b.props.address.isDefault
                                    ? 0
                                    : a.props.address.isDefault
                                        ? -1
                                        : 1,
                            )
                    ) : (
                        <View className="flex-1 items-center justify-center py-20">
                            <MapPin size={48} className="text-gray-300 mb-4" />
                            <Text className="text-gray-500 text-base mb-2">
                                还没有服务地址
                            </Text>
                            <Text className="text-gray-400 text-sm">
                                点击下方按钮添加您的第一个服务地址
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* 底部添加按钮 */}
            <View className="p-4 bg-background border-t border-border">
                <Button
                    onPress={handleAddAddress}
                    className="h-12 rounded-full"
                >
                    <Text className="text-white text-base font-medium">
                        ⊕ 添加服务地址
                    </Text>
                </Button>
            </View>
        </View>
    );
}
