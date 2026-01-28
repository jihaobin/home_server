import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from './SessionProvider';
import { useFonts } from 'expo-font';

SplashScreen.preventAutoHideAsync();

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
        if (!isLoading && loaded && !error) {
            SplashScreen.hide();
        }
    }, [isLoading]);

    return null;
}
