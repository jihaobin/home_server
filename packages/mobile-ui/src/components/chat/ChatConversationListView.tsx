import * as React from "react";
import { FlatList, Image, Pressable, RefreshControl, View } from "react-native";

import { useFile } from "@repo/hooks/api/files";
import { Text } from "../ui/text";

export type ChatConversationListItem = {
    id: string;
    peerUserName?: string;
    peerUserAvatar?: string | null;
    lastMessagePreview?: {
        text: string;
        createdAt: string;
    } | null;
    lastMessageAt?: string | null;
    unreadCount?: number;
};

export function ChatConversationListView(props: {
    items: ChatConversationListItem[];
    onPressConversation: (conversationId: string) => void;
    emptyText?: string;
    refreshing?: boolean;
    onRefresh?: () => void;
}) {
    const emptyMessage = props.emptyText ?? "暂无会话";

    return (
        <FlatList
            data={props.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => (
                <Pressable
                    onPress={() => props.onPressConversation(item.id)}
                    className="border-b-hairline border-border"
                >
                    <ConversationListRow item={item} />
                </Pressable>
            )}
            ListEmptyComponent={
                <View className="pt-10">
                    <Text className="text-center text-sm text-muted-foreground">
                        {emptyMessage}
                    </Text>
                </View>
            }
            refreshControl={
                props.onRefresh ? (
                    <RefreshControl
                        refreshing={Boolean(props.refreshing)}
                        onRefresh={props.onRefresh}
                    />
                ) : undefined
            }
        />
    );
}

function ConversationListRow(props: { item: ChatConversationListItem }) {
    const { item } = props;
    const timeSource = item.lastMessagePreview?.createdAt ?? item.lastMessageAt;
    const showUnread =
        typeof item.unreadCount === "number" && item.unreadCount > 0;

    return (
        <View className="h-[72px] flex-row items-center justify-between bg-card px-4">
            <View className="flex-1 flex-row items-center">
                <ConversationAvatar avatarRef={item.peerUserAvatar} />
                <View className="ml-2 flex-1 pr-3">
                    <Text className="text-sm text-foreground font-puhui-regular">
                        {item.peerUserName?.trim() || "聊天对象"}
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground font-puhui-regular">
                        {item.lastMessagePreview?.text?.trim() || "暂无消息"}
                    </Text>
                </View>
            </View>
            <View
                className={
                    showUnread
                        ? "h-10 items-end justify-between"
                        : "h-10 items-end justify-center"
                }
            >
                <Text className="text-xs text-muted-foreground font-puhui-regular">
                    {formatTimeLabel(timeSource)}
                </Text>
                {showUnread ? (
                    <View className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
                        <Text className="text-xs text-primary-foreground font-puhui-regular">
                            {item.unreadCount}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function ConversationAvatar(props: { avatarRef?: string | null }) {
    const normalized = props.avatarRef?.trim() ?? "";
    const isRemoteUrl =
        normalized.startsWith("http://") || normalized.startsWith("https://");
    const { data: fileData } = useFile(
        isRemoteUrl || !normalized ? null : normalized,
    );
    const resolvedAvatarUrl = isRemoteUrl
        ? normalized
        : (fileData?.fileUrl ?? null);

    return (
        <View className="h-10 w-10 overflow-hidden rounded-full border border-primary bg-muted">
            {resolvedAvatarUrl ? (
                <Image
                    source={{ uri: resolvedAvatarUrl }}
                    resizeMode="cover"
                    className="h-10 w-10"
                />
            ) : (
                <View className="h-10 w-10 items-center justify-center">
                    <Text className="text-xs text-muted-foreground">头像</Text>
                </View>
            )}
        </View>
    );
}

function formatTimeLabel(value: string | null | undefined) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${hours}:${minutes}`;
}
