import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from './SessionProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {
    // 避免在极少数重复调用场景下打断启动流程
});


export function SplashScreenController() {
    const { isLoading } = useSession();

    useEffect(() => {
        if (!isLoading) {
            void SplashScreen.hideAsync().catch(() => {});
        }
    }, [isLoading]);

    return null;
}
