import * as React from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";

import type { ChatMessage } from "@repo/types";
import { useFile } from "@repo/hooks/api/files";
import { Text } from "@repo/mobile-ui/components/ui/text";

export function ChatMessageRow(props: {
    message: ChatMessage;
    onOpenOrder: (orderId: string) => void;
}) {
    const { message } = props;

    if (message.content.type === "text") {
        return (
            <View className="rounded-lg bg-muted px-3 py-2">
                <Text className="text-sm text-foreground">
                    {message.content.text}
                </Text>
                <Text className="mt-1 text-[10px] text-muted-foreground">
                    {message.createdAt}
                </Text>
            </View>
        );
    }

    if (message.content.type === "image") {
        return <ChatImageMessage message={message} />;
    }

    if (message.content.type === "video") {
        return <ChatVideoMessage message={message} />;
    }

    if (message.content.type === "order_card") {
        const snapshot = message.content.snapshot;
        const orderId = message.content.orderId;
        return (
            <Pressable
                onPress={() => props.onOpenOrder(orderId)}
                className="rounded-lg border border-border bg-card px-3 py-3"
            >
                <Text className="text-sm text-foreground">
                    订单：{snapshot?.title ?? orderId}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                    {snapshot?.status ?? ""}
                </Text>
            </Pressable>
        );
    }

    return null;
}

function ChatImageMessage(props: { message: ChatMessage }) {
    const content = props.message.content;
    if (content.type !== "image") {
        return null;
    }
    const { data } = useFile(content.fileId);
    const uri = data?.fileUrl;

    return (
        <View className="rounded-lg border border-border bg-card px-2 py-2">
            {uri ? (
                <Image
                    source={{ uri }}
                    placeholder={
                        content.blurhash
                            ? { blurhash: content.blurhash }
                            : undefined
                    }
                    style={{ width: 220, height: 160, borderRadius: 8 }}
                    contentFit="cover"
                />
            ) : (
                <Text className="text-sm text-muted-foreground">
                    图片加载中...
                </Text>
            )}
        </View>
    );
}

function ChatVideoMessage(props: { message: ChatMessage }) {
    const content = props.message.content;
    if (content.type !== "video") {
        return null;
    }
    const { data } = useFile(content.fileId);
    const uri = data?.fileUrl;

    return (
        <Pressable
            onPress={() => {
                if (uri) {
                    void Linking.openURL(uri);
                }
            }}
            className="rounded-lg border border-border bg-card px-3 py-3"
        >
            <Text className="text-sm text-foreground">视频</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
                {uri ? "点击打开" : "链接获取中..."}
            </Text>
        </Pressable>
    );
}
