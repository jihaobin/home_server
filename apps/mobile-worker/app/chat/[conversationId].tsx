import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
    useChatConversationDetailQuery,
    useChatMarkConversationRead,
    useChatMessagesInfinite,
} from "@repo/hooks/api/chat";
import { ChatCameraCaptureModal } from "@repo/mobile-ui/components/chat/ChatCameraCaptureModal";
import { ChatComposerView } from "@repo/mobile-ui/components/chat/ChatComposerView";
import {
    ChatMediaPreviewModal,
    type ChatMediaItem,
} from "@repo/mobile-ui/components/chat/ChatMediaPreviewModal";
import { ChatMessageListView } from "@repo/mobile-ui/components/chat/ChatMessageListView";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-work-constants";

import { useColorScheme } from "nativewind";

import { useChatSendAttachments } from "../../hooks/use-chat-send-attachments";
import { useChatSendMessage } from "../../hooks/use-chat-send-message";

function StatusBarBackground({ color }: { color: string }) {
    const insets = useSafeAreaInsets();

    if (Platform.OS === "web" || insets.top === 0) {
        return null;
    }

    return (
        <View
            pointerEvents="none"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: color,
                zIndex: 1,
            }}
        />
    );
}

export default function ChatConversationScreen() {
    const { colorScheme } = useColorScheme();
    const navTheme = NAV_THEME[colorScheme ?? "light"];
    const statusBarBackground = navTheme.colors.card;

    const params = useLocalSearchParams<{
        conversationId?: string;
        draftOrderId?: string;
        peerName?: string;
    }>();
    const conversationId =
        typeof params.conversationId === "string" ? params.conversationId : "";
    const draftOrderId =
        typeof params.draftOrderId === "string" ? params.draftOrderId : "";
    const routePeerName =
        typeof params.peerName === "string" && params.peerName.trim()
            ? params.peerName
            : "";

    const { data: conversationDetail } = useChatConversationDetailQuery({
        conversationId,
        clientRole: "service_personnel",
    });

    const peerName =
        conversationDetail?.peerUser?.name?.trim() || routePeerName || "私聊";

    const hasSentDraftOrderRef = React.useRef(false);
    const lastReportedReadMessageIdRef = React.useRef<string | null>(null);
    const { session } = useSession();

    const [previewVisible, setPreviewVisible] = React.useState(false);
    const [cameraCaptureVisible, setCameraCaptureVisible] =
        React.useState(false);
    const [cameraCaptureSessionKey, setCameraCaptureSessionKey] =
        React.useState(0);
    const [selectedMediaId, setSelectedMediaId] = React.useState<string | null>(
        null,
    );

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useChatMessagesInfinite({
            conversationId,
            limit: 20,
            clientRole: "service_personnel",
        });

    const messages = React.useMemo(
        () => data.pages.flatMap((page) => page.items),
        [data.pages],
    );
    const mediaItems = React.useMemo<ChatMediaItem[]>(() => {
        const nextItems: ChatMediaItem[] = [];
        for (const message of messages) {
            if (message.content.type === "image") {
                nextItems.push({
                    type: "image",
                    messageId: message.id,
                    fileId: message.content.fileId,
                    blurhash: message.content.blurhash,
                });
                continue;
            }
            if (message.content.type === "video") {
                nextItems.push({
                    type: "video",
                    messageId: message.id,
                    fileId: message.content.fileId,
                });
            }
        }
        return nextItems;
    }, [messages]);

    const { send } = useChatSendMessage({ conversationId });
    const {
        sendImageFromLibrary,
        sendImageFromCamera,
        sendVideoFromCamera,
        isUploading,
    } = useChatSendAttachments({ conversationId });
    const { mutate: markConversationRead } = useChatMarkConversationRead({
        conversationId,
        clientRole: "service_personnel",
    });

    React.useEffect(() => {
        if (!draftOrderId || hasSentDraftOrderRef.current) {
            return;
        }
        hasSentDraftOrderRef.current = true;
        send({ type: "order_card", orderId: draftOrderId });
        router.replace({
            pathname: "/chat/[conversationId]",
            params: {
                conversationId,
                peerName: routePeerName || peerName,
            },
        });
    }, [conversationId, draftOrderId, peerName, routePeerName, send]);

    const openMediaPreview = React.useCallback(
        (messageId: string) => {
            if (!mediaItems.some((item) => item.messageId === messageId)) {
                return;
            }
            setSelectedMediaId(messageId);
            setPreviewVisible(true);
        },
        [mediaItems],
    );

    const openCameraCapture = React.useCallback(() => {
        if (isUploading) {
            return;
        }
        setCameraCaptureSessionKey((prev) => prev + 1);
        setCameraCaptureVisible(true);
    }, [isUploading]);

    const closeCameraCapture = React.useCallback(() => {
        setCameraCaptureVisible(false);
    }, []);

    React.useEffect(() => {
        if (!conversationId || messages.length === 0) {
            return;
        }
        const latestMessageId = messages[0]?.id;
        if (!latestMessageId) {
            return;
        }
        if (lastReportedReadMessageIdRef.current === latestMessageId) {
            return;
        }
        lastReportedReadMessageIdRef.current = latestMessageId;
        markConversationRead({ lastReadMessageId: latestMessageId });
    }, [conversationId, markConversationRead, messages]);

    if (!conversationId) {
        return null;
    }

    return (
        <RequireAuth>
            <StatusBar
                style={colorScheme === "dark" ? "light" : "dark"}
                backgroundColor={statusBarBackground}
            />
            <StatusBarBackground color={statusBarBackground} />

            <SafeAreaView edges={["top"]} className="flex-1 bg-background">
                <View className="border-b-hairline border-border bg-card px-3 py-2">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={() => router.back()}
                            className="h-9 w-9 items-center justify-center rounded-full bg-muted"
                        >
                            <ChevronLeft size={18} />
                        </Pressable>
                        <View className="ml-3 flex-1">
                            <Text className="text-base font-puhui-medium text-foreground">
                                {peerName}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                                在线沟通中
                            </Text>
                        </View>
                    </View>
                </View>

                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
                >
                    <ChatMessageListView
                        items={messages}
                        currentUserId={session?.user?.id}
                        onLoadMore={() => {
                            if (hasNextPage && !isFetchingNextPage) {
                                void fetchNextPage();
                            }
                        }}
                        hasMore={!!hasNextPage}
                        isLoadingMore={isFetchingNextPage}
                        onOpenOrder={(orderId) =>
                            router.push({
                                pathname: "/orders/[id]",
                                params: { id: orderId },
                            })
                        }
                        onOpenMedia={openMediaPreview}
                    />
                    <ChatComposerView
                        onSendText={(text) => send({ type: "text", text })}
                        onPickImage={() => void sendImageFromLibrary()}
                        onPickVideo={openCameraCapture}
                        disabled={isUploading}
                    />
                </KeyboardAvoidingView>

                <ChatCameraCaptureModal
                    key={cameraCaptureSessionKey}
                    visible={cameraCaptureVisible}
                    disabled={isUploading}
                    onClose={closeCameraCapture}
                    onCapturePhoto={(asset) => sendImageFromCamera(asset)}
                    onCaptureVideo={(asset) => sendVideoFromCamera(asset)}
                />

                <ChatMediaPreviewModal
                    visible={previewVisible}
                    items={mediaItems}
                    initialMediaId={selectedMediaId}
                    onClose={() => {
                        setPreviewVisible(false);
                        setSelectedMediaId(null);
                    }}
                />
            </SafeAreaView>
        </RequireAuth>
    );
}
