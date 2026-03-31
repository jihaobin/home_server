import { useEvent } from "expo";
import { useEffect } from "react";
import ExpoWechat, {
    type RequestMerchantTransferResultPayload,
} from "expo-wechat";
import {
    clearPendingWechatMerchantTransferSession,
    getPendingWechatMerchantTransferSession,
    setWechatMerchantTransferResultSnapshot,
} from "@/lib/wechat-merchant-transfer-session";

export function useWechatMerchantTransferResultListener(options?: {
    onResultReceived?: (withdrawalId: string) => void | Promise<void>;
}) {
    const transferResult = useEvent(
        ExpoWechat,
        "onRequestMerchantTransferResult",
    ) as RequestMerchantTransferResultPayload | null;

    useEffect(() => {
        if (!transferResult) {
            return;
        }

        const pendingSession = getPendingWechatMerchantTransferSession();
        if (!pendingSession) {
            return;
        }

        setWechatMerchantTransferResultSnapshot({
            withdrawalId: pendingSession.withdrawalId,
            businessType: transferResult.businessType,
            extMsg: transferResult.extMsg,
            result: transferResult.result,
            errorCode: transferResult.errorCode,
            errorMessage: transferResult.errorMessage,
            transaction: transferResult.transaction,
            receivedAt: new Date().toISOString(),
        });
        clearPendingWechatMerchantTransferSession();
        void options?.onResultReceived?.(pendingSession.withdrawalId);
    }, [options, transferResult]);
}
