import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { Button } from '@repo/mobile-ui/components/ui/button';
import { ArrowLeft } from '@repo/mobile-ui/lib/icons/ArrowLeft';
import { MapPin } from '@repo/mobile-ui/lib/icons/MapPin';
import { Edit } from "@repo/mobile-ui/lib/icons/Edit";
import { Card, CardContent } from '@repo/mobile-ui/components/ui/card';
import { X } from "@repo/mobile-ui/lib/icons/X"; // Assuming you have an X icon for delete

// 服务地址类型定义
interface ServiceAddress {
  id: string;
  userName: string;
  userTitle: string;
  phone: string;
  address: string;
}

// 服务地址项组件
const ServiceAddressItem = ({
  address,
  onEdit,
  onDelete
}: {
  address: ServiceAddress;
  onEdit: (address: ServiceAddress) => void;
  onDelete?: (address: ServiceAddress) => void;
}) => {
  return (
    <Card className="mx-4 mb-4 bg-white rounded-lg shadow-sm relative">
      <CardContent className="p-4">
        {/* 右上角关闭按钮 */}
        {onDelete && (
          <Pressable
            onPress={() => onDelete(address)}
            className="absolute top-1 right-1 z-10"
          >
            <X size={16} className="text-gray-400" />
          </Pressable>
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
                  {address.userName}
                </Text>
                <Text className="text-sm bg-gray-100 mr-2">
                  {address.userTitle}
                </Text>
                <Text className="text-sm text-gray-900">
                  {address.phone}
                </Text>
              </View>

              {/* 地址行 */}
              <Text className="text-sm text-gray-700 leading-5">
                {address.address}
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
  // 模拟数据
  const [addresses, setAddresses] = useState<ServiceAddress[]>([
    {
      id: '1',
      userName: 'u6154',
      userTitle: '先生',
      phone: '19090416306',
      address: '黄冈武穴市兴雨科技大楼hh'
    }
  ]);

  const handleGoBack = () => {
    router.back();
  };

  const handleEditAddress = (address: ServiceAddress) => {
    // 导航到编辑地址页面，传递地址ID
    router.push({
      pathname: './edit-address',
      params: { addressId: address.id }
    });
  };

  const handleDeleteAddress = (address: ServiceAddress) => {
    // 删除地址
    console.log('删除地址:', address);
    setAddresses(prev => prev.filter(addr => addr.id !== address.id));
    // TODO: 这里可以添加确认对话框和API调用
  };

  const handleAddAddress = () => {
    // 导航到添加地址页面
    router.push('./edit-address');
  };

  return (
    <View className="flex-1 bg-background">
      {/* 头部导航 */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable
          onPress={handleGoBack}
          className="mr-4 p-2 -ml-2"
        >
          <ArrowLeft size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-lg font-medium text-foreground">
          服务地址
        </Text>
      </View>

      {/* 地址列表 */}
      <ScrollView className="flex-1">
        <View className="py-4">
          {addresses.length > 0 ? (
            addresses.map((address) => (
              <ServiceAddressItem
                key={address.id}
                address={address}
                onEdit={handleEditAddress}
                onDelete={handleDeleteAddress}
              />
            ))
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
