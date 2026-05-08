import * as React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    View,
    type ViewProps,
} from "react-native";

type AppKeyboardAvoidingViewProps = React.PropsWithChildren<ViewProps>;

export function AppKeyboardAvoidingView({
    children,
    style,
    ...props
}: AppKeyboardAvoidingViewProps) {
    if (Platform.OS !== "ios") {
        return (
            <View style={[{ flex: 1 }, style]} {...props}>
                {children}
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[{ flex: 1 }, style]}
            behavior="padding"
            keyboardVerticalOffset={0}
            {...props}
        >
            {children}
        </KeyboardAvoidingView>
    );
}
