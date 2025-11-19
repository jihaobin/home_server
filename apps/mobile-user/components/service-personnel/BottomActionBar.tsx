import { Button } from "@repo/mobile-ui/components/ui/button";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { View } from "react-native";

interface BottomActionBarProps {
    onBookNow: () => void;
    disabled?: boolean;
}

export function BottomActionBar({ onBookNow, disabled = false }: BottomActionBarProps) {
    return (
        <View
            className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 8,
            }}
        >
            <View className="flex-row items-center gap-3">
                <Button
                    onPress={onBookNow}
                    disabled={disabled}
                    className="flex-1 items-center justify-center rounded-full bg-primary"
                >
                    <Text className="text-base font-semibold text-primary-foreground">
                        立即预约
                    </Text>
                </Button>
            </View>
        </View>
    );
}
