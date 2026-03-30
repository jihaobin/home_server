import { useEvent } from "expo";
import { useEffect } from "react";
import ExpoWechat, { type AuthResultPayload } from "expo-wechat";
import { setWechatBindingAuthResultSnapshot } from "@/lib/wechat-binding-session";

export function useWechatAuthResultListener() {
    const authResult = useEvent(
        ExpoWechat,
        "onAuthResult",
    ) as AuthResultPayload | null;

    useEffect(() => {
        if (!authResult) {
            return;
        }

        setWechatBindingAuthResultSnapshot({
            code: authResult.code,
            state: authResult.state,
            openId: authResult.openId,
            errorCode: authResult.errorCode,
            errorMessage: authResult.errorMessage,
            receivedAt: new Date().toISOString(),
        });
    }, [authResult]);
}
