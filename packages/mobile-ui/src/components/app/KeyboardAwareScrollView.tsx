import * as React from "react";
import { Platform, ScrollView, type ScrollViewProps } from "react-native";

export function KeyboardAwareScrollView(props: ScrollViewProps) {
    return (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            {...props}
        />
    );
}
