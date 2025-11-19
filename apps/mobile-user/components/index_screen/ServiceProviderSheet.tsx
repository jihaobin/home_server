import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { MatchedPersonnel } from "@repo/types";
import { icons as lucideIconRegistry } from "lucide-react-native";
import {
    FlatList,
    type ListRenderItemInfo,
    Image,
    Pressable,
    View,
} from "react-native";

export interface ServiceItem {
    id: string;
    label: string;
    description: string | null;
    icon?: string | null;
}

export interface ServiceProviderSheetProps {
    service: ServiceItem;
    providers: MatchedPersonnel[];
    onClose: () => void;
    onProviderDetail?: (provider: MatchedPersonnel) => void;
}

const ICON_MAP = lucideIconRegistry;

function ServiceProviderCard({
    provider,
    onDetail,
}: {
    provider: MatchedPersonnel;
    onSelect?: (provider: MatchedPersonnel) => void;
    onDetail?: (provider: MatchedPersonnel) => void;
}) {
    // 格式化距离显示
    const formatDistance = () => {
        const distKm = Number(provider.distance ?? 0);
        if (Number.isNaN(distKm)) return null;

        if (distKm < 1) {
            const meters = Math.round(distKm * 1000);
            return `${meters}m`;
        }
        const kmStr = distKm < 10 ? distKm.toFixed(1) : Math.round(distKm).toString();
        return `${kmStr}km`;
    };

    // 格式化工作时间
    const formatWorkTime = () => {
        if (!provider.workStartTime || !provider.workEndTime) return null;

        const formatTime = (time: string) => {
            return time.length > 5 && time.includes(':') ? time.substring(0, 5) : time;
        };

        return `${formatTime(provider.workStartTime)}-${formatTime(provider.workEndTime)}`;
    };

    // 格式化工作日
    const formatWorkDays = () => {
        if (!provider.workDays) return null;

        const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
        return provider.workDays
            .split('')
            .map(d => {
                const dayNum = Number.parseInt(d, 10);
                return `周${dayNames[dayNum - 1]}`;
            })
            .join('、');
    };

    // 简介
    const bio = provider.bio || `专业服务人员，拥有${provider.yearsOfExperience}年经验`;
    const experience = bio.length > 50 ? `${bio.slice(0, 50)}...` : bio;

    // 格式化好评率
    const formatGoodReviewRate = () => {
        const rate = provider.goodReviewRate || 0;
        return rate;
    };

    // 判断是否有评价
    const hasReviews = (provider.reviewCount || 0) > 0;

    const distance = formatDistance();
    const workTime = formatWorkTime();
    const workDays = formatWorkDays();

    return (
        <View
            className="mb-3 rounded-2xl border border-border bg-card p-4 shadow-2xl flex flex-col gap-2"
        >
            {/* 头部：头像、姓名、经验 */}
            <View className="flex-row items-start">
                <View className="mr-3 h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                    {provider.avatarUrl ? (
                        <Image
                            source={{ uri: provider.avatarUrl }}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                            }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-2xl font-semibold text-primary">
                            {provider.name.slice(0, 1)}
                        </Text>
                    )}
                </View>

                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-lg font-semibold text-foreground">
                            {provider.name}
                        </Text>
                        {provider.yearsOfExperience > 0 && (
                            <View className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5">
                                <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    {provider.yearsOfExperience}年经验
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* 评价信息 */}
                    {hasReviews && (
                        <View className="flex-row items-center mb-1.5">
                            <Icon
                                as={ICON_MAP.Star}
                                size={14}
                                className="text-amber-500 mr-1"
                            />
                            <Text className="text-xs font-medium text-foreground">
                                {formatGoodReviewRate()}% 好评
                            </Text>
                            <Text className="text-xs text-muted-foreground ml-1">
                                ({provider.reviewCount}条评价)
                            </Text>
                        </View>
                    )}

                    <Text className="text-xs text-muted-foreground leading-relaxed">
                        {experience}
                    </Text>
                </View>
            </View>


            {/* 信息区域：距离、位置、工作时间 */}
            <View className="flex-col gap-1">
                {/* 距离和位置 */}
                {(distance || provider.detailedAddress) && (
                    <View className="flex-row items-center flex gap-1">
                        <Icon
                            as={ICON_MAP.MapPin}
                            size={14}
                            className="text-muted-foreground mr-1.5"
                        />
                        <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                            {distance && (
                                <Text className="font-medium text-primary">{distance}</Text>
                            )}
                            {distance && provider.detailedAddress && (
                                <Text className="text-muted-foreground"> · </Text>
                            )}
                            {provider.detailedAddress && (
                                <Text className="text-muted-foreground">
                                    {provider.detailedAddress}
                                </Text>
                            )}
                        </Text>
                    </View>
                )}

                {/* 工作时间 */}
                {workTime && (
                    <View className="flex-row items-center flex gap-1">
                        <Icon
                            as={ICON_MAP.Clock}
                            size={14}
                            className="text-muted-foreground mr-1.5"
                        />
                        <Text className="text-sm text-foreground">
                            <Text className="font-medium">{workTime}</Text>
                        </Text>
                    </View>
                )}

                {/* 工作日 */}
                {workDays && (
                    <View className="flex-row items-center flex gap-1">
                        <Icon
                            as={ICON_MAP.Calendar}
                            size={14}
                            className="text-muted-foreground mr-1.5"
                        />
                        <Text className="text-sm text-muted-foreground">{workDays}</Text>
                    </View>
                )}
            </View>


            {/* 底部：价格和操作按钮 */}
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-baseline">
                    <Text className="text-2xl font-bold text-primary">
                        ¥{provider.price}
                    </Text>
                    <Text className="ml-1 text-xs text-muted-foreground">/次</Text>
                </View>

                <View className="flex-row gap-2">
                    <Button
                        className="items-center justify-center rounded-lg border border-primary bg-primary/5 px-4 py-2"
                        onPress={() => onDetail?.(provider)}
                    >
                        <Text className="text-sm font-medium text-primary">详情</Text>
                    </Button>
                </View>
            </View>
        </View>
    );
}

/**
 * 服务人员列表 Sheet 内容组件
 *
 * @example
 * ```tsx
 * <BottomSheetModal visible={visible} onClose={onClose}>
 *   <ServiceProviderSheet
 *     service={selectedService}
 *     providers={providers}
 *     onClose={onClose}
 *     onProviderSelect={(provider) => console.log('选择:', provider)}
 *   />
 * </BottomSheetModal>
 * ```
 */
export function ServiceProviderSheet({
    service,
    providers,
    onClose,
    onProviderDetail,
}: ServiceProviderSheetProps) {
    const renderProviderItem = ({
        item,
    }: ListRenderItemInfo<MatchedPersonnel>) => (
        <ServiceProviderCard provider={item} onDetail={onProviderDetail} />
    );

    const listHeader = (
        <View className="pb-3">
            <View className="pb-2 border-b border-border/50">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                        <Text className="text-2xl font-bold text-foreground">
                            {service.label}
                        </Text>
                        <Text className="mt-1 text-sm text-muted-foreground">
                            {service.description ?? "选择服务人员"}
                        </Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="h-9 w-9 items-center justify-center rounded-full bg-muted/80 active:bg-muted"
                        hitSlop={8}
                    >
                        <Icon as={ICON_MAP.X} size={20} className="text-muted-foreground" />
                    </Pressable>
                </View>
            </View>

            <View className="mt-3 flex-row items-center justify-between rounded-xl bg-muted/30 px-4 py-2">
                <Text className="text-sm font-medium text-muted-foreground">
                    找到 {providers.length} 位服务人员
                </Text>
                <Pressable className="flex-row items-center">
                    <Text className="text-sm text-primary">综合排序</Text>
                    <Icon as={ICON_MAP.ChevronDown} size={16} className="ml-1 text-primary" />
                </Pressable>
            </View>
        </View>
    );

    const emptyComponent = (
        <View className="items-center justify-center py-12">
            <Icon as={ICON_MAP.Users} size={48} className="text-muted-foreground/40" />
            <Text className="mt-4 text-base font-medium text-muted-foreground">暂无服务人员</Text>
            <Text className="mt-2 text-xs text-muted-foreground">
                该服务正在招募服务人员,敬请期待
            </Text>
        </View>
    );

    return (
        <View className="flex-1">
            <FlatList
                data={providers}
                keyExtractor={(item) => item.userId}
                renderItem={renderProviderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={emptyComponent}
                contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 32,
                    flexGrow: 1,
                }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
