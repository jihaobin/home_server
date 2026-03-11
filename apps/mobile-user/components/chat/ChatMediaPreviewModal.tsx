import * as React from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import Carousel, {
    type ICarouselInstance,
} from "react-native-reanimated-carousel";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

import { useFile } from "@repo/hooks/api/files";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useLocalVideoThumbnail } from "./use-local-video-thumbnail";

export type ChatMediaItem = {
    type: "image" | "video";
    messageId: string;
    fileId: string;
    blurhash?: string;
};

export function ChatMediaPreviewModal(props: {
    visible: boolean;
    items: ChatMediaItem[];
    initialMediaId?: string | null;
    onClose: () => void;
}) {
    const { width, height } = useWindowDimensions();
    const [activeIndex, setActiveIndex] = React.useState(0);
    const carouselRef = React.useRef<ICarouselInstance>(null);
    const indexByMediaId = React.useMemo(
        () =>
            new Map(
                props.items.map(
                    (item, index) => [item.messageId, index] as const,
                ),
            ),
        [props.items],
    );

    React.useEffect(() => {
        if (!props.visible) {
            return;
        }
        const wantedIndex = props.initialMediaId
            ? indexByMediaId.get(props.initialMediaId)
            : undefined;
        const nextIndex =
            typeof wantedIndex === "number"
                ? Math.max(0, Math.min(wantedIndex, props.items.length - 1))
                : 0;
        setActiveIndex(nextIndex);
        carouselRef.current?.scrollTo({ index: nextIndex, animated: false });
    }, [
        indexByMediaId,
        props.initialMediaId,
        props.items.length,
        props.visible,
    ]);

    if (!props.visible) {
        return null;
    }

    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="fade"
            onRequestClose={props.onClose}
        >
            <View
                className="flex-1 justify-center"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.95)" }}
            >
                <View className="absolute left-0 right-0 top-14 z-20 flex-row items-center justify-between px-4">
                    <Pressable
                        onPress={props.onClose}
                        className="rounded-full px-3 py-1"
                        style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                    >
                        <Text className="text-sm text-white">关闭</Text>
                    </Pressable>
                    <Text className="text-xs text-white">
                        {props.items.length > 0
                            ? `${activeIndex + 1} / ${props.items.length}`
                            : "0 / 0"}
                    </Text>
                </View>

                <Carousel
                    ref={carouselRef}
                    key={`open-${props.initialMediaId ?? "none"}-${props.items.length}`}
                    width={width}
                    height={height}
                    loop={false}
                    defaultIndex={activeIndex}
                    data={props.items}
                    onSnapToItem={setActiveIndex}
                    renderItem={({ item, index }) => (
                        <MediaSlide
                            item={item}
                            isActive={index === activeIndex}
                        />
                    )}
                />
            </View>
        </Modal>
    );
}

function MediaSlide(props: { item: ChatMediaItem; isActive: boolean }) {
    const { data, isPending } = useFile(props.item.fileId);
    const uri = data?.fileUrl;
    const { thumbnail, isGenerating } = useLocalVideoThumbnail(uri);

    if (props.item.type === "image") {
        return (
            <View className="flex-1 items-center justify-center px-3">
                {uri ? (
                    <Image
                        source={{ uri }}
                        placeholder={
                            props.item.blurhash
                                ? { blurhash: props.item.blurhash }
                                : undefined
                        }
                        style={{ width: "100%", height: "85%" }}
                        contentFit="contain"
                    />
                ) : (
                    <Text className="text-sm text-white">
                        {isPending ? "图片加载中..." : "图片加载失败"}
                    </Text>
                )}
            </View>
        );
    }

    if (!props.isActive) {
        return (
            <View className="flex-1 items-center justify-center px-3">
                <View className="h-60 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted">
                    {thumbnail ? (
                        <Image
                            source={thumbnail}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                        />
                    ) : null}
                    <View
                        className="absolute rounded-full px-3 py-2"
                        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
                    >
                        <Text className="text-xs text-white">
                            {isGenerating
                                ? "封面生成中..."
                                : "滑动到此页后可播放"}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <VideoSlide uri={uri} isActive={props.isActive} isPending={isPending} />
    );
}

function VideoSlide(props: {
    uri?: string;
    isActive: boolean;
    isPending: boolean;
}) {
    const player = useVideoPlayer(props.uri ?? null, (instance) => {
        instance.loop = false;
    });

    React.useEffect(() => {
        if (!props.uri) {
            return;
        }
        if (props.isActive) {
            player.play();
            return;
        }
        player.pause();
    }, [player, props.isActive, props.uri]);

    if (!props.uri) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-sm text-white">
                    {props.isPending ? "视频加载中..." : "视频加载失败"}
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 items-center justify-center px-3">
            <VideoView
                player={player}
                style={{ width: "100%", height: "70%" }}
                contentFit="contain"
                nativeControls
                allowsFullscreen
                allowsPictureInPicture
            />
        </View>
    );
}
