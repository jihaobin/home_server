import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { View } from "react-native";

const ICON_MAP = lucideIconRegistry;

interface PersonnelIntroProps {
    bio?: string | null;
    yearsOfExperience?: number;
    servicedCount?: number;
}

export function PersonnelIntro({
    bio,
    yearsOfExperience,
    servicedCount,
}: PersonnelIntroProps) {
    return (
        <View className="mx-4 mb-4">
            {/* 标题 */}
            <View className="mb-3 flex-row items-center">
                <View className="h-4 w-1 rounded-full bg-primary" />
                <Text className="ml-2 text-base font-bold text-foreground">
                    服务人员介绍
                </Text>
            </View>

            {/* 资质卡片 */}
            <View className="mb-3 flex-row gap-3">
                {yearsOfExperience !== undefined && yearsOfExperience > 0 && (
                    <View className="flex-1 rounded-xl border border-border bg-card p-4">
                        <View className="flex-row items-center">
                            <Icon
                                as={ICON_MAP.Award}
                                size={20}
                                className="text-primary"
                            />
                            <Text className="ml-2 text-xs text-muted-foreground">
                                工作年限
                            </Text>
                        </View>
                        <Text className="mt-2 text-2xl font-bold text-foreground">
                            {yearsOfExperience}
                            <Text className="text-sm font-normal text-muted-foreground">
                                {" "}
                                年
                            </Text>
                        </Text>
                    </View>
                )}

                {servicedCount !== undefined && servicedCount > 0 && (
                    <View className="flex-1 rounded-xl border border-border bg-card p-4">
                        <View className="flex-row items-center">
                            <Icon
                                as={ICON_MAP.Users}
                                size={20}
                                className="text-primary"
                            />
                            <Text className="ml-2 text-xs text-muted-foreground">
                                服务次数
                            </Text>
                        </View>
                        <Text className="mt-2 text-2xl font-bold text-foreground">
                            {servicedCount}
                            <Text className="text-sm font-normal text-muted-foreground">
                                {" "}
                                次
                            </Text>
                        </Text>
                    </View>
                )}
            </View>

            {/* 简介内容 */}
            {bio && (
                <View className="rounded-xl border border-border bg-card p-4">
                    <Text className="text-sm leading-6 text-foreground/80">
                        {bio}
                    </Text>
                </View>
            )}

            {!bio && (!yearsOfExperience || yearsOfExperience === 0) && (!servicedCount || servicedCount === 0) && (
                <View className="rounded-xl border border-border bg-card p-6">
                    <Text className="text-center text-sm text-muted-foreground">
                        暂无介绍信息
                    </Text>
                </View>
            )}
        </View>
    );
}
