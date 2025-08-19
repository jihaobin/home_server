import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router, Link } from 'expo-router';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { ChevronDown } from '@repo/mobile-ui/lib/icons/ChevronDown';
import { MapPin } from '@repo/mobile-ui/lib/icons/MapPin';
import { useAddressTip } from '@/hooks/api/address';


// 地址项组件
function AddressItem({
    title,
    address,
    tag,
    isCurrent = false,
    onPress
}: {
    title: string;
    address: string;
    tag?: string;
    isCurrent?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} className="py-4 px-4 border-b border-border">
            <View className="flex-row items-start">
                <MapPin size={20} className="text-red-500 mr-3 mt-1" />
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-base font-medium text-foreground mr-2">
                            {title}
                        </Text>
                        {tag && (
                            <View className={`px-2 py-1 rounded ${isCurrent ? 'bg-red-500' : 'bg-orange-500'}`}>
                                <Text className="text-xs text-white">{tag}</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-sm text-muted-foreground mt-1">
                        {address}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

export default function SelectAddressScreen() {
    const [searchText, setSearchText] = useState('')

    const addressTipResult = useAddressTip(searchText)

    const handleSelectAddress = (address: string) => {
        // TODO: 返回选中的地址到上一页
        console.log('选中地址:', address);
        router.back();
    };

    const handleRelocate = () => {
        console.log('重新定位');
    };

    return (
        <View className="flex-1 bg-background">
            {/* 搜索区域 */}
            <View className="px-4 py-3 bg-background">
                <View className="flex-row items-center gap-2">
                    {/* 城市选择 */}
                    <Link
                        className="flex-row items-center py-2" href={'./select-city'} prefetch
                    >
                        <Text className="text-base text-foreground mr-1">黄冈</Text>
                        <ChevronDown size={16} className="text-muted-foreground" />
                    </Link>

                    {/* 搜索框 */}
                    <View className="flex-1">
                        <Input
                            placeholder="搜索小区名/大厦名"
                            value={searchText}
                            onChangeText={setSearchText}
                            className="h-10 rounded-full border-border focus:border-primary"
                        />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1">
                {/* 地址建议结果 */}
                {searchText && addressTipResult &&
                 !Array.isArray(addressTipResult.data) &&
                 addressTipResult.data?.data &&
                 addressTipResult.data.data.length > 0 && (
                    <View className="bg-white absolute z-10 w-full">
                        <View className="bg-gray-100 px-4 py-2">
                            <Text className="text-sm text-muted-foreground">搜索结果</Text>
                        </View>
                        {addressTipResult.data.data.map((item: any, index: number) => (
                            <AddressItem
                                key={`suggestion-${index}`}
                                title={item.title}
                                address={item.address || item.title}
                                onPress={() => handleSelectAddress(item.title)}
                            />
                        ))}
                    </View>
                )}

                {/* 常用服务地址 */}
                <View className="bg-gray-100 px-4 py-2">
                    <Text className="text-sm text-muted-foreground">常用服务地址</Text>
                </View>

                <View className="px-4 py-4 border-b border-border">
                    <View className="flex-row items-center">
                        <Text className="text-base font-medium text-foreground mr-3">u6154</Text>
                        <Text className="text-sm text-muted-foreground mr-3">先生</Text>
                        <Text className="text-sm text-muted-foreground">19090416306</Text>
                    </View>
                    <Text className="text-sm text-muted-foreground mt-1">
                        黄冈武穴市兴雨科技大楼hh
                    </Text>
                </View>

                {/* 附近地址 */}
                <View className="bg-gray-100 px-4 py-2 flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">附近地址</Text>
                    <Pressable onPress={handleRelocate} className="flex-row items-center">
                        <Text className="text-sm text-red-500 mr-1">重新定位</Text>
                        <View className="w-3 h-3 rounded-full border border-red-500"></View>
                    </Pressable>
                </View>

                {/* 地址列表 */}
                <AddressItem
                    title="柏曼酒店(黄冈武穴利江大道店)"
                    address="利江大道35号"
                    tag="3位邻居"
                    onPress={() => handleSelectAddress('柏曼酒店(黄冈武穴利江大道店)')}
                />

                <AddressItem
                    title="兴雨科技大楼"
                    address="湖北省黄冈市武穴市利江大道59号"
                    tag="当前"
                    isCurrent={true}
                    onPress={() => handleSelectAddress('兴雨科技大楼')}
                />

                <AddressItem
                    title="添才翰格猎服集团(黄冈武穴分公司)"
                    address="黄冈市武穴市利江大道实验小学(大桥分校)东北..."
                    onPress={() => handleSelectAddress('添才翰格猎服集团(黄冈武穴分公司)')}
                />

                <AddressItem
                    title="太子庙路-道路"
                    address="武穴市"
                    onPress={() => handleSelectAddress('太子庙路-道路')}
                />

                <AddressItem
                    title="聚贤小区"
                    address="武穴市"
                    onPress={() => handleSelectAddress('聚贤小区')}
                />

                <AddressItem
                    title="芳刚服饰厂"
                    address="武穴市"
                    onPress={() => handleSelectAddress('芳刚服饰厂')}
                />

                <AddressItem
                    title="武穴市梅园小区"
                    address="黄冈市武穴市利江大道40号东北方向180米"
                    onPress={() => handleSelectAddress('武穴市梅园小区')}
                />

                <AddressItem
                    title="丽枫酒店(武穴利江大道店)"
                    address="湖北省黄冈市武穴市利江大道锦路"
                    onPress={() => handleSelectAddress('丽枫酒店(武穴利江大道店)')}
                />
            </ScrollView>
        </View>
    );
}
