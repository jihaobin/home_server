import * as React from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@repo/mobile-ui/components/ui/text";

export function ChatComposerView(props: {
    onSendText: (text: string) => void;
    onPickImage?: () => void;
    onPickVideo?: () => void;
    disabled?: boolean;
}) {
    const [text, setText] = React.useState("");
    const trimmed = text.trim();

    return (
        <View className="border-t border-border bg-background px-3 py-2">
            <View className="flex-row items-center gap-2">
                {props.onPickImage ? (
                    <Pressable
                        onPress={props.onPickImage}
                        disabled={props.disabled}
                        className="rounded-lg bg-muted px-3 py-2"
                    >
                        <Text className="text-foreground">图</Text>
                    </Pressable>
                ) : null}
                {props.onPickVideo ? (
                    <Pressable
                        onPress={props.onPickVideo}
                        disabled={props.disabled}
                        className="rounded-lg bg-muted px-3 py-2"
                    >
                        <Text className="text-foreground">视</Text>
                    </Pressable>
                ) : null}
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="输入消息"
                    className="flex-1 rounded-lg bg-muted px-3 py-2 text-foreground"
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
                    className="rounded-lg bg-primary px-3 py-2"
                >
                    <Text className="text-primary-foreground">发送</Text>
                </Pressable>
            </View>
        </View>
    );
}
