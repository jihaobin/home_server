import * as React from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import {
    Image as ImageIcon,
    Plus,
    Package,
    SendHorizontal,
    Video,
    X,
} from "lucide-react-native";

import { Text } from "../ui/text";
import { Icon } from "../ui/icon";

export function ChatComposerView(props: {
    onSendText: (text: string) => void;
    onPickImage?: () => void;
    onPickVideo?: () => void;
    onPickOrderCard?: () => void;
    disabled?: boolean;
}) {
    const [text, setText] = React.useState("");
    const [expanded, setExpanded] = React.useState(false);
    const trimmed = text.trim();

    const actionItems = React.useMemo(
        () =>
            [
                {
                    key: "image",
                    label: "相册",
                    icon: ImageIcon,
                    onPress: props.onPickImage,
                },
                {
                    key: "video",
                    label: "视频",
                    icon: Video,
                    onPress: props.onPickVideo,
                },
                {
                    key: "order",
                    label: "订单",
                    icon: Package,
                    onPress: props.onPickOrderCard,
                },
            ].filter((item) => Boolean(item.onPress)),
        [props.onPickImage, props.onPickOrderCard, props.onPickVideo],
    );

    return (
        <View className="border-t border-border bg-card px-3 pb-3 pt-2">
            <View className="flex-row items-center gap-2">
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="输入消息"
                    className="flex-1 rounded-2xl bg-muted px-4 py-2 text-foreground"
                />
                <Pressable
                    disabled={!trimmed.length || props.disabled}
                    onPress={() => {
                        if (!trimmed.length) {
                            return;
                        }
                        props.onSendText(trimmed);
                        setText("");
                    }}
                    className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                >
                    <Icon as={SendHorizontal} size={16} className="text-card" />
                </Pressable>
                <Pressable
                    disabled={props.disabled || actionItems.length === 0}
                    onPress={() => {
                        Keyboard.dismiss();
                        setExpanded((prev) => !prev);
                    }}
                    className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"
                >
                    <Icon
                        as={expanded ? X : Plus}
                        size={18}
                        className="text-foreground"
                    />
                </Pressable>
            </View>

            {expanded ? (
                <View className="mt-3 rounded-2xl bg-muted/50 px-3 py-3">
                    <View className="flex-row flex-wrap">
                        {actionItems.map((item) => (
                            <Pressable
                                key={item.key}
                                disabled={props.disabled}
                                onPress={() => {
                                    item.onPress?.();
                                    setExpanded(false);
                                }}
                                className="mb-3 w-1/4 items-center"
                            >
                                <View className="h-14 w-14 items-center justify-center rounded-xl bg-card">
                                    <Icon
                                        as={item.icon}
                                        size={22}
                                        className="text-foreground"
                                    />
                                </View>
                                <Text className="mt-2 text-xs text-muted-foreground">
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}
