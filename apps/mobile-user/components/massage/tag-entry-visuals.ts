import type { ImageSourcePropType } from "react-native";

type MassageTagVisual = {
    titleColor: string;
    description: string;
    descriptionColor: string;
    gradientFrom: string;
    gradientTo: string;
    imageSource: ImageSourcePropType;
    imageClassName: string;
};

const DEFAULT_VISUAL: MassageTagVisual = {
    titleColor: "#004376",
    description: "放松身心\n缓解疲劳",
    descriptionColor: "#5ea6c3",
    gradientFrom: "#e3f7ff",
    gradientTo: "#ffffff",
    imageSource: require("@/assets/images/massage-personnel-blue.png"),
    imageClassName: "h-[92px] w-[54px]",
};

export const MASSAGE_TAG_VISUALS: Record<string, MassageTagVisual> = {
    health: DEFAULT_VISUAL,
    conditioning: {
        titleColor: "#6e4600",
        description: "放松身心\n缓解疲劳",
        descriptionColor: "#c99947",
        gradientFrom: "#fffce4",
        gradientTo: "#ffffff",
        imageSource: require("@/assets/images/massage-personnel-white.png"),
        imageClassName: "h-[96px] w-[58px]",
    },
};

export function getMassageTagVisual(tagSlug: string): MassageTagVisual {
    return MASSAGE_TAG_VISUALS[tagSlug] ?? DEFAULT_VISUAL;
}
