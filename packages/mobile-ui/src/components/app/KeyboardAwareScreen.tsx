import * as React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    View,
    type ViewProps,
} from "react-native";

type KeyboardAwareScreenProps = React.PropsWithChildren<
    ViewProps & {
        keyboardVerticalOffset?: number;
    }
>;

export function KeyboardAwareScreen({
    children,
    style,
    keyboardVerticalOffset = 0,
    ...props
}: KeyboardAwareScreenProps) {
    if (Platform.OS === "web") {
        return (
            <View style={[{ flex: 1 }, style]} {...props}>
                {children}
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[{ flex: 1 }, style]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={keyboardVerticalOffset}
            {...props}
        >
            {children}
        </KeyboardAvoidingView>
    );
}
