import { useEffect } from "react";
import ExpoWechat, { type PayResultPayload } from "expo-wechat";
import { setWechatPayResultSnapshot } from "@/lib/wechat-payment-session";

export function useWechatPayResultListener() {
    useEffect(() => {
        const subscription = ExpoWechat.addListener(
            "onPayResult",
            (payload: PayResultPayload) => {
                setWechatPayResultSnapshot({
                    errorCode: payload.errorCode,
                    errorMessage: payload.errorMessage,
                    transaction: payload.transaction,
                    prepayId: payload.prepayId,
                    receivedAt: new Date().toISOString(),
                });
            },
        );

        return () => {
            subscription.remove();
        };
    }, []);
}
