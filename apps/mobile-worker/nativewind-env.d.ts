/// <reference types="nativewind/types" />
import "react-native";

declare module "react-native" {
    interface ViewProps {
        className?: string;
        cssInterop?: boolean;
    }
    interface TextProps {
        className?: string;
        cssInterop?: boolean;
    }
    interface PressableProps {
        className?: string;
        cssInterop?: boolean;
    }
    interface TouchableOpacityProps {
        className?: string;
        cssInterop?: boolean;
    }
    interface ImagePropsBase {
        className?: string;
        imageClassName?: string;
        cssInterop?: boolean;
    }
    interface FlatListProps<ItemT> {
        className?: string;
        columnWrapperClassName?: string;
    }
    interface ScrollViewProps {
        className?: string;
        contentContainerClassName?: string;
        indicatorClassName?: string;
    }
    interface TextInputProps {
        className?: string;
    }
}
