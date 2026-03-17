import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { cssInterop } from "nativewind";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import type { ServiceCategoryTree, Services } from "@repo/types";
import { useHomeMoreServices } from "@repo/hooks/api/home";

// Enable NativeWind `className` on expo-image.
cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

export type MoreServicesBottomSheetProps = {
    visible: boolean;
    onClose: () => void;
};

type ImageSource = React.ComponentProps<typeof ExpoImage>["source"];

const PLACEHOLDER_ICON = require("@/assets/images/icon-round.png");

type HomeCategoryNode = ServiceCategoryTree & {
    services?: readonly Services[];
};

type MoreServicesGridItem = {
    id: string;
    label: string;
    imageUrl?: string | null;
    kind: "category" | "service";
    categoryId?: string;
};

type CategoryFilterRouteParams = {
    categoryId: string;
    categoryName: string;
    defaultTabName?: string;
    defaultServiceId?: string;
};

function MoreServicesSkeleton({ sectionCount = 3 }: { sectionCount?: number }) {
    return (
        <View className="px-4 pb-10">
            {Array.from({ length: sectionCount }).map((_, sectionIdx) => (
                <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={`more-services-skeleton-${sectionIdx}`}
                    className={sectionIdx === 0 ? "pt-2" : "pt-6"}
                >
                    <Skeleton className="h-4 w-28 rounded" />
                    <View className="mt-3 flex-row flex-wrap gap-x-[31px] gap-y-8">
                        {Array.from({ length: 12 }).map((__, itemIdx) => (
                            <View
                                // eslint-disable-next-line react/no-array-index-key
                                key={`more-services-skeleton-item-${sectionIdx}-${itemIdx}`}
                                className="w-11 items-center"
                            >
                                <Skeleton className="h-[38px] w-[38px] rounded-full" />
                                <Skeleton className="mt-2 h-3 w-10 rounded" />
                            </View>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

function flattenCategoryDescendants(
    nodes: readonly HomeCategoryNode[],
): HomeCategoryNode[] {
    const result: HomeCategoryNode[] = [];

    for (const node of nodes) {
        result.push(node);
        if (Array.isArray(node.children) && node.children.length > 0) {
            result.push(
                ...flattenCategoryDescendants(
                    node.children as unknown as HomeCategoryNode[],
                ),
            );
        }
    }

    return result;
}

function resolveImageSource(imageUrl?: string | null): ImageSource {
    if (imageUrl) {
        return { uri: imageUrl };
    }
    return PLACEHOLDER_ICON;
}

function ServiceGridItem({
    label,
    imageUrl,
    onPress,
}: {
    label: string;
    imageUrl?: string | null;
    onPress?: () => void;
}) {
    const imageSource = useMemo(() => resolveImageSource(imageUrl), [imageUrl]);

    return (
        <Pressable className="w-11 items-center" onPress={onPress}>
            <View className="h-11 w-11 items-center justify-center">
                <View className="h-[38px] w-[38px] overflow-hidden rounded-full border border-primary">
                    <Image
                        source={imageSource}
                        contentFit="cover"
                        className="h-[38px] w-[38px]"
                    />
                </View>
            </View>
            <Text
                className="mt-1 text-xs text-foreground font-puhui-regular"
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export function MoreServicesBottomSheet({
    visible,
    onClose,
}: MoreServicesBottomSheetProps) {
    const moreServicesQuery = useHomeMoreServices({ enabled: visible });
    const categories = (moreServicesQuery.data?.categories ?? []) as
        | readonly HomeCategoryNode[]
        | HomeCategoryNode[];

    const shouldShowSkeleton =
        visible &&
        !moreServicesQuery.data &&
        (moreServicesQuery.isLoading || moreServicesQuery.isFetching);

    const sections = (categories as readonly HomeCategoryNode[]).map(
        (parent) => {
            const descendants = flattenCategoryDescendants(
                (parent.children ?? []) as unknown as HomeCategoryNode[],
            );

            const categoryItems: MoreServicesGridItem[] = descendants.map(
                (c) => ({
                    id: c.id,
                    label: c.name,
                    imageUrl: c.iconFileUrl ?? null,
                    kind: "category",
                }),
            );

            const seenServiceIds = new Set<string>();
            const serviceItems: MoreServicesGridItem[] = [
                parent,
                ...descendants,
            ]
                .flatMap((node) => (node.services ?? []) as readonly Services[])
                .filter((s) => {
                    if (seenServiceIds.has(s.id)) return false;
                    seenServiceIds.add(s.id);
                    return true;
                })
                .map((s) => ({
                    id: s.id,
                    label: s.name,
                    imageUrl: s.imageFileUrl ?? null,
                    kind: "service",
                    categoryId: s.categoryId,
                }));

            return {
                id: parent.id,
                title: parent.name,
                items: [...categoryItems, ...serviceItems],
            };
        },
    );

    const navigateToCategoryFilter = (params: CategoryFilterRouteParams) => {
        router.push({
            pathname: "/category/filter",
            params,
        });

        requestAnimationFrame(() => {
            onClose();
        });
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            // Figma: top ~51px on 812h screen => ~0.94 height.
            initialHeightRatio={0.94}
            maxHeightRatio={0.94}
            sheetClassName="rounded-t-2xl bg-card"
        >
            <View className="flex-1">
                <View className="h-11 flex-row items-center">
                    <View className="h-11 w-[60px]" />
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-base text-foreground font-puhui-medium">
                            更多服务
                        </Text>
                    </View>
                    <Pressable
                        className="h-11 w-[60px] items-center justify-center"
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text className="text-lg text-muted-foreground font-puhui-regular">
                            ×
                        </Text>
                    </Pressable>
                </View>

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                >
                    {shouldShowSkeleton ? (
                        <MoreServicesSkeleton />
                    ) : (
                        <View className="px-4 pb-10">
                            {sections.map((section, idx) => (
                                <View
                                    key={section.id}
                                    className={idx === 0 ? "pt-2" : "pt-6"}
                                >
                                    <Text className="text-sm text-foreground font-puhui-medium">
                                        {section.title}
                                    </Text>
                                    <View className="mt-3 flex-row flex-wrap gap-x-[31px] gap-y-8">
                                        {section.items.map((item) => (
                                            <ServiceGridItem
                                                key={item.id}
                                                label={item.label}
                                                imageUrl={item.imageUrl}
                                                onPress={() => {
                                                    if (
                                                        item.kind === "category"
                                                    ) {
                                                        navigateToCategoryFilter(
                                                            {
                                                                categoryId:
                                                                    String(
                                                                        item.id,
                                                                    ),
                                                                categoryName:
                                                                    item.label,
                                                                defaultTabName:
                                                                    item.label,
                                                            },
                                                        );
                                                        return;
                                                    }

                                                    const serviceCategoryId =
                                                        item.categoryId;
                                                    if (!serviceCategoryId) {
                                                        return;
                                                    }

                                                    navigateToCategoryFilter({
                                                        categoryId:
                                                            serviceCategoryId,
                                                        categoryName:
                                                            section.title,
                                                        defaultServiceId:
                                                            String(item.id),
                                                        defaultTabName:
                                                            item.label,
                                                    });
                                                }}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </View>
        </BottomSheetModal>
    );
}
