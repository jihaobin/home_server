import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from './SessionProvider';
import { useFonts } from 'expo-font';

void SplashScreen.preventAutoHideAsync().catch(() => {
    // 避免在极少数重复调用场景下打断启动流程
});

const FONTS = {
    puHuiRegular: "AlibabaPuHuiTi-Regular",
    puHuiMedium: "AlibabaPuHuiTi-Medium",
    puHuiBold: "AlibabaPuHuiTi-Bold",
    dinAltBold: "DINAlternate-Bold",
} as const;

export function SplashScreenController() {
    const { isLoading } = useSession();
    const [loaded, error] = useFonts({
        [FONTS.puHuiRegular]: require("@/assets/fonts/Alibaba-PuHuiTi-Regular.ttf"),
        [FONTS.puHuiMedium]: require("@/assets/fonts/Alibaba-PuHuiTi-Medium.ttf"),
        [FONTS.puHuiBold]: require("@/assets/fonts/Alibaba-PuHuiTi-Bold.ttf"),
        [FONTS.dinAltBold]: require("@/assets/fonts/DIN-Alternate-Bold.ttf"),
    });

    useEffect(() => {
        if (error) {
            console.error("字体加载失败，继续启动应用:", error);
            void SplashScreen.hideAsync().catch(() => {});
            return;
        }

        if (!isLoading && loaded) {
            void SplashScreen.hideAsync().catch(() => {});
        }
    }, [isLoading, loaded, error]);

    return null;
}
