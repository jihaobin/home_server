import type { ImageSourcePropType } from "react-native";

type MassageTagVisual = {
    titleColor: string;
    description: string;
    descriptionColor: string;
    gradientFrom: string;
    gradientTo: string;
    categoryMaskSource: ImageSourcePropType;
    imageSource: ImageSourcePropType;
    imageClassName: string;
};

const BLUE_VISUAL: MassageTagVisual = {
    titleColor: "#004376",
    description: "放松身心\n缓解疲劳",
    descriptionColor: "#5ea6c3",
    gradientFrom: "#e3f7ff",
    gradientTo: "#ffffff",
    categoryMaskSource: require("@/assets/images/massage-category-mask-blue.svg"),
    imageSource: require("@/assets/images/massage-personnel-blue.png"),
    imageClassName: "h-[92px] w-[54px]",
};

const GOLD_VISUAL: MassageTagVisual = {
    titleColor: "#6e4600",
    description: "放松身心\n缓解疲劳",
    descriptionColor: "#c99947",
    gradientFrom: "#fffce4",
    gradientTo: "#ffffff",
    categoryMaskSource: require("@/assets/images/massage-category-mask-gold.svg"),
    imageSource: require("@/assets/images/massage-personnel-white.png"),
    imageClassName: "h-[96px] w-[58px]",
};

const DEFAULT_VISUAL = BLUE_VISUAL;

const ORDERED_VISUALS = [BLUE_VISUAL, GOLD_VISUAL] as const;

export const MASSAGE_TAG_VISUALS: Record<string, MassageTagVisual> = {
    health: BLUE_VISUAL,
    conditioning: GOLD_VISUAL,
};

export function getAlternatingMassageTagVisual(
    index: number,
): MassageTagVisual {
    return ORDERED_VISUALS[index % ORDERED_VISUALS.length] ?? DEFAULT_VISUAL;
}

export function getMassageTagVisual(tagSlug: string): MassageTagVisual {
    return MASSAGE_TAG_VISUALS[tagSlug] ?? DEFAULT_VISUAL;
}
