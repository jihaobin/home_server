import { Ionicons } from "@expo/vector-icons";
import { useServiceList } from "@repo/hooks/api/service";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { ServiceListResponse, ServicePersonnelProfile } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ServiceCategory = ServiceListResponse["items"][number];
type ServiceOption = ServiceCategory["children"][number];

const MASSAGE_KEYWORD = "按摩";

export default function ServiceSettingsManageRedesignScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: string }>();
    const { session } = useSession();
    const userId = session?.user?.id;
    const [search, setSearch] = useState("");

    const {
        data: profile,
        isFetching: isFetchingProfile,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);

    const selectedServiceIds = useMemo(() => {
        return new Set(profile?.services.map((service) => service.serviceId) ?? []);
    }, [profile?.services]);

    const hasQualification = Boolean(
        profile?.merchantQualificationImage || profile?.vocationalQualificationImage,
    );

    const isAddMode = params.mode !== "manage";

    const openServiceDetail = (input: {
        serviceId: string;
        categoryId?: string;
        categoryName?: string;
        serviceName?: string;
        serviceDescription?: string | null;
    }) => {
        router.push({
            pathname: "/profile/service-settings-detail-redesign",
            params: {
                serviceId: input.serviceId,
                categoryId: input.categoryId,
                categoryName: input.categoryName,
                serviceName: input.serviceName,
                serviceDescription: input.serviceDescription,
            },
        } as never);
    };

    const isLoading = isFetchingProfile && !profile;

    return (
        <SafeAreaView className="flex-1 bg-[#F5F6F8]" edges={["top", "bottom"]}>
            <View className="flex-row items-center px-5 pb-4 pt-3">
                <Pressable hitSlop={10} onPress={() => router.back()}>
                    <Text className="text-[22px] leading-[33px] text-black">‹</Text>
                </Pressable>
                <Text className="flex-1 text-center text-[17px] leading-[26px] text-black">
                    {isAddMode ? "添加服务" : "管理服务"}
                </Text>
                <View className="w-[22px] items-end">
                    {isFetchingProfile ? (
                        <ActivityIndicator size="small" color="#2B6EF5" />
                    ) : null}
                </View>
            </View>

            <View className="px-4 pb-3">
                <View className="flex-row items-center rounded-full bg-white px-5 py-3">
                    <Input
                        className="h-6 flex-1 border-0 bg-transparent px-0 py-0 text-sm leading-[21px] shadow-none"
                        value={search}
                        placeholder="搜索服务名称"
                        placeholderTextColor="#99A1AF"
                        onChangeText={setSearch}
                    />
                    <Ionicons name="search-outline" size={16} color="#99A1AF" />
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#2B6EF5" />
                </View>
            ) : (
                <Suspense
                    fallback={
                        <View className="flex-1 items-center justify-center py-16">
                            <ActivityIndicator size="large" color="#2B6EF5" />
                        </View>
                    }
                >
                    <ServiceCategoryList
                        search={search}
                        profile={profile ?? null}
                        selectedServiceIds={selectedServiceIds}
                        hasQualification={hasQualification}
                        onServicePress={openServiceDetail}
                        refetchProfile={refetchProfile}
                        userId={userId}
                    />
                </Suspense>
            )}

            <View className="flex-row items-center justify-center gap-2 border-t border-[#F3F4F6] bg-white px-4 pb-3 pt-3">
                <Ionicons name="information-circle-outline" size={14} color="#6A7282" />
                <Text className="text-xs leading-[18px] text-[#6A7282]">
                    点击服务可直接进入编辑页面完善信息
                </Text>
            </View>
        </SafeAreaView>
    );
}

function ServiceCategoryList(props: {
    search: string;
    profile: ServicePersonnelProfile | null;
    selectedServiceIds: Set<string>;
    hasQualification: boolean;
    onServicePress: (input: {
        serviceId: string;
        categoryId?: string;
        categoryName?: string;
        serviceName?: string;
        serviceDescription?: string | null;
    }) => void;
    refetchProfile: () => Promise<unknown>;
    userId?: string;
}) {
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
        () => new Set(),
    );

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch: refetchCategories,
    } = useServiceList({
        keyword: props.search.trim() || undefined,
        limit: 25,
        sortOrder: "asc",
    });

    const allCategories = useMemo(
        () => data.pages.flatMap((page) => page.items),
        [data.pages],
    );

    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                props.userId ? props.refetchProfile() : Promise.resolve(),
                refetchCategories({ throwOnError: false }),
            ]),
    });

    const visibleCategories = useMemo(() => {
        if (!props.search.trim()) {
            return allCategories;
        }
        return allCategories.filter((category) => category.children.length > 0);
    }, [props.search, allCategories]);

    const isCategoryExpanded = (categoryId: string, index: number) => {
        if (expandedCategoryIds.has(categoryId)) {
            return true;
        }
        return expandedCategoryIds.size === 0 && index === 0;
    };

    const toggleCategory = (categoryId: string) => {
        setExpandedCategoryIds((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    return (
        <FlatList
            className="flex-1"
            data={visibleCategories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 24,
                flexGrow: visibleCategories.length === 0 ? 1 : undefined,
            }}
            renderItem={({ item: category, index }) => (
                <View className="mb-3">
                    <ServiceCategoryCard
                        category={category}
                        profile={props.profile}
                        expanded={isCategoryExpanded(category.id, index)}
                        selectedServiceIds={props.selectedServiceIds}
                        hasQualification={props.hasQualification}
                        onToggle={() => toggleCategory(category.id)}
                        onServicePress={(service) =>
                            props.onServicePress({
                                serviceId: service.id,
                                categoryId: category.id,
                                categoryName: category.name,
                                serviceName: service.name,
                                serviceDescription: service.description,
                            })
                        }
                    />
                </View>
            )}
            ListEmptyComponent={
                <View className="items-center rounded-2xl bg-white px-5 py-8">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1F5]">
                        <Ionicons name="search-outline" size={24} color="#99A1AF" />
                    </View>
                    <Text className="mt-3 text-[15px] leading-[23px] text-black">
                        暂无可选服务
                    </Text>
                    <Text className="mt-1 text-center text-xs leading-[18px] text-[#6A7282]">
                        换个服务名称试试
                    </Text>
                </View>
            }
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                        void onRefresh();
                    }}
                    tintColor="#2B6EF5"
                />
            }
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                isFetchingNextPage ? (
                    <View className="items-center py-4">
                        <ActivityIndicator size="small" color="#2B6EF5" />
                    </View>
                ) : null
            }
            showsVerticalScrollIndicator={false}
        />
    );
}

function ServiceCategoryCard(props: {
    category: ServiceCategory;
    profile: ServicePersonnelProfile | null;
    expanded: boolean;
    selectedServiceIds: Set<string>;
    hasQualification: boolean;
    onToggle: () => void;
    onServicePress: (service: ServiceOption) => void;
}) {
    const serviceCount = props.category.children.length;

    return (
        <View className="overflow-hidden rounded-2xl bg-white">
            <Pressable
                className="flex-row items-center gap-3 p-4"
                onPress={props.onToggle}
            >
                <View className="flex-1">
                    <Text className="text-[15px] leading-[23px] text-black">
                        {props.category.name}
                    </Text>
                    <Text className="mt-0.5 text-xs leading-[18px] text-[#6A7282]">
                        共 {serviceCount} 项服务
                    </Text>
                </View>
                <Text
                    className="text-sm leading-[21px] text-[#99A1AF]"
                    style={{ transform: [{ rotate: props.expanded ? "180deg" : "0deg" }] }}
                >
                    ▾
                </Text>
            </Pressable>

            {props.expanded ? (
                <View className="border-t border-[#F3F4F6] bg-[#FAFBFC]">
                    {props.category.children.length > 0 ? (
                        props.category.children.map((service, index) => (
                            <ServiceOptionRow
                                key={service.id}
                                service={service}
                                profile={props.profile}
                                selected={props.selectedServiceIds.has(service.id)}
                                needsQualification={
                                    !props.hasQualification &&
                                    `${props.category.name}${service.name}`.includes(
                                        MASSAGE_KEYWORD,
                                    )
                                }
                                isLast={index === props.category.children.length - 1}
                                onPress={props.onServicePress}
                            />
                        ))
                    ) : (
                        <Text className="px-6 py-4 text-xs leading-[18px] text-[#6A7282]">
                            该分类下暂无具体服务
                        </Text>
                    )}
                </View>
            ) : null}
        </View>
    );
}

function ServiceOptionRow(props: {
    service: ServiceOption;
    profile: ServicePersonnelProfile | null;
    selected: boolean;
    needsQualification: boolean;
    isLast: boolean;
    onPress: (service: ServiceOption) => void;
}) {
    const imageUrl = props.service.imageFileUrl;
    const status = getServiceStatus({
        selected: props.selected,
        needsQualification: props.needsQualification,
    });

    return (
        <Pressable
            className="flex-row items-center gap-3 px-4 py-3"
            style={
                props.isLast
                    ? undefined
                    : { borderBottomColor: "#F3F4F6", borderBottomWidth: 1 }
            }
            onPress={() => props.onPress(props.service)}
        >
            <View className="h-10 w-10 overflow-hidden rounded-[14px] bg-[#EEF1F5]">
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        contentFit="cover"
                        className="h-full w-full"
                    />
                ) : (
                    <View className="h-full w-full items-center justify-center">
                        <Ionicons name="briefcase-outline" size={18} color="#99A1AF" />
                    </View>
                )}
            </View>

            <View className="flex-1">
                <Text className="text-sm leading-[21px] text-black">
                    {props.service.name}
                </Text>
                <Text className="mt-px text-[11px] leading-[17px] text-[#6A7282]" numberOfLines={1}>
                    {status.description}
                </Text>
            </View>

            <View
                className="min-w-[60px] items-center rounded-lg px-3 py-1.5"
                style={{ backgroundColor: status.backgroundColor }}
            >
                <Text className="text-xs leading-[18px]" style={{ color: status.color }}>
                    {status.label}
                </Text>
            </View>
        </Pressable>
    );
}

function getServiceStatus(input: { selected: boolean; needsQualification: boolean }) {
    if (input.selected) {
        return {
            label: "已添加",
            description: "已加入草稿",
            color: "#2B6EF5",
            backgroundColor: "#EEF1F5",
        };
    }

    if (input.needsQualification) {
        return {
            label: "需资质",
            description: "需资质后才能启用",
            color: "#FF5252",
            backgroundColor: "#EEF1F5",
        };
    }

    return {
        label: "添加",
        description: "可直接加入草稿",
        color: "#22C55E",
        backgroundColor: "#E6F7EA",
    };
}
