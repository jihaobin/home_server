import baseConfig from "@repo/mobile-ui/tailwind";

/** @type {import('tailwindcss').Config} */
export default {
    ...baseConfig,
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}",
        "../../packages/mobile-ui/src/components/**/*.{ts,tsx}",
    ],
    theme: {
        ...(baseConfig.theme ?? {}),
        extend: {
            ...(baseConfig.theme?.extend ?? {}),
            fontFamily: {
                ...(baseConfig.theme?.extend?.fontFamily ?? {}),
                "puhui-regular": ["AlibabaPuHuiTi-Regular"],
                "puhui-medium": ["AlibabaPuHuiTi-Medium"],
                "puhui-bold": ["AlibabaPuHuiTi-Bold"],
                "din-alt-bold": ["DINAlternate-Bold"],
            },
        },
    },
};
