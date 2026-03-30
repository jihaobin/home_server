import { useQueryClient } from "@tanstack/react-query";
import {
    useQueryWithdrawalPayoutStatus,
    useReportWechatMerchantTransferResult,
    useWorkerWithdrawalRecords,
} from "@repo/hooks/api/pay";
import {
    ensureWeChatAppRegistered,
    isWeChatAppInstalled,
    requestWechatMerchantTransfer,
} from "@repo/lib/pay";
import type { WorkerEarningsRecordListResponse } from "@repo/types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import {
    clearPendingWechatMerchantTransferSession,
    clearWechatMerchantTransferResultSnapshot,
    getPendingWechatMerchantTransferSession,
    getWechatMerchantTransferResultSnapshot,
    isWechatMerchantTransferCoolingDown,
    markWechatMerchantTransferAttempt,
    setPendingWechatMerchantTransferSession,
} from "@/lib/wechat-merchant-transfer-session";

type WithdrawalRecordItem = WorkerEarningsRecordListResponse["items"][number];

const resolveWorkerWechatSdkConfig = () => ({
    appId:
        process.env.EXPO_PUBLIC_WECHAT_WORKER_APP_ID?.trim() ||
        process.env.EXPO_PUBLIC_WECHAT_APP_ID?.trim() ||
        "",
    universalLink:
        process.env.EXPO_PUBLIC_WECHAT_WORKER_UNIVERSAL_LINK?.trim() ||
        process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK?.trim() ||
        "",
});

function extractMchId(record: WithdrawalRecordItem) {
    const meta = record.withdrawal?.providerMeta;
    if (!meta || typeof meta !== "object") {
        return null;
    }

    const wechatTransferMeta = (meta as Record<string, unknown>)[
        "wechatMerchantTransfer"
    ];
    if (!wechatTransferMeta || typeof wechatTransferMeta !== "object") {
        return null;
    }

    const mchId = (wechatTransferMeta as Record<string, unknown>).mchId;
    return typeof mchId === "string" ? mchId : null;
}

function isEligibleWithdrawal(record: WithdrawalRecordItem) {
    if (!record.withdrawal || record.withdrawal.method !== "wechat_pay") {
        return false;
    }

    if (
        record.withdrawal.status !== "approved" &&
        record.withdrawal.status !== "processing"
    ) {
        return false;
    }

    if (
        record.withdrawal.providerState !== "WAIT_USER_CONFIRM" &&
        record.withdrawal.providerState !== "TRANSFERING"
    ) {
        return false;
    }

    return Boolean(
        record.withdrawal.providerPackageInfo &&
        record.withdrawal.providerAppId &&
        extractMchId(record),
    );
}

export function useWechatMerchantTransferAutoTrigger(enabled: boolean) {
    const isSupported = enabled && Platform.OS === "android";
    const queryClient = useQueryClient();
    const launchingRef = useRef(false);
    const syncingRef = useRef(false);

    const {
        data: withdrawalPages,
        refetch: refetchWithdrawals,
        isFetching: isFetchingWithdrawals,
    } = useWorkerWithdrawalRecords(
        {
            limit: 20,
        },
        { enabled: isSupported },
    );

    const { mutateAsync: reportTransferResult } =
        useReportWechatMerchantTransferResult();
    const { mutateAsync: queryPayoutStatus } = useQueryWithdrawalPayoutStatus();

    const withdrawalItems = useMemo(() => {
        const pages = withdrawalPages?.pages ?? [];
        return pages.flatMap((page) => page.items);
    }, [withdrawalPages]);

    const candidate = useMemo(() => {
        return [...withdrawalItems]
            .filter(isEligibleWithdrawal)
            .sort((left, right) => {
                const leftTime = new Date(
                    left.withdrawal?.requestedAt ?? left.occurredAt,
                ).getTime();
                const rightTime = new Date(
                    right.withdrawal?.requestedAt ?? right.occurredAt,
                ).getTime();
                return leftTime - rightTime;
            })[0];
    }, [withdrawalItems]);

    const invalidateWithdrawalQueries = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({
                queryKey: ["worker-earnings-records"],
            }),
            queryClient.invalidateQueries({ queryKey: ["earnings-overview"] }),
        ]);
    }, [queryClient]);

    const processTransferStatusSync = useCallback(async () => {
        if (!isSupported || syncingRef.current) {
            return;
        }

        const snapshot = getWechatMerchantTransferResultSnapshot();
        const pendingSession = getPendingWechatMerchantTransferSession();

        if (!snapshot && !pendingSession) {
            return;
        }

        syncingRef.current = true;
        try {
            if (snapshot) {
                await reportTransferResult({
                    withdrawalId: snapshot.withdrawalId,
                    data: {
                        result: snapshot.result,
                        businessType: snapshot.businessType ?? undefined,
                        extMsg: snapshot.extMsg ?? undefined,
                        errorCode: snapshot.errorCode,
                        errorMessage: snapshot.errorMessage ?? undefined,
                        transaction: snapshot.transaction ?? undefined,
                        receivedAt: snapshot.receivedAt,
                    },
                });
                clearWechatMerchantTransferResultSnapshot();
            } else if (pendingSession) {
                await queryPayoutStatus(pendingSession.withdrawalId);
                clearPendingWechatMerchantTransferSession();
            }

            await Promise.allSettled([
                refetchWithdrawals(),
                invalidateWithdrawalQueries(),
            ]);
        } catch (error) {
            console.warn(
                "[wechat-transfer] sync payout status failed",
                error instanceof Error ? error.message : error,
            );
        } finally {
            syncingRef.current = false;
        }
    }, [
        invalidateWithdrawalQueries,
        isSupported,
        queryPayoutStatus,
        refetchWithdrawals,
        reportTransferResult,
    ]);

    const launchTransferConfirm = useCallback(
        async (record: WithdrawalRecordItem) => {
            if (!record.withdrawal || launchingRef.current) {
                return;
            }

            const providerAppId = record.withdrawal.providerAppId;
            const providerPackageInfo = record.withdrawal.providerPackageInfo;
            const mchId = extractMchId(record);
            if (!providerAppId || !providerPackageInfo || !mchId) {
                return;
            }

            const { appId: sdkAppId, universalLink } =
                resolveWorkerWechatSdkConfig();
            const appId = providerAppId || sdkAppId;
            if (!appId) {
                return;
            }

            launchingRef.current = true;
            try {
                await ensureWeChatAppRegistered({
                    appId,
                    universalLink,
                });

                const installed = await isWeChatAppInstalled();
                if (!installed) {
                    throw new Error("请先安装微信客户端");
                }

                setPendingWechatMerchantTransferSession({
                    withdrawalId: record.withdrawal.id,
                    mchId,
                    appId,
                    packageInfo: providerPackageInfo,
                    requestedAt: new Date().toISOString(),
                });
                markWechatMerchantTransferAttempt(record.withdrawal.id);

                const dispatched = await requestWechatMerchantTransfer({
                    mchId,
                    appId,
                    package: providerPackageInfo,
                });

                if (!dispatched) {
                    clearPendingWechatMerchantTransferSession();
                }
            } catch (error) {
                clearPendingWechatMerchantTransferSession();
                console.warn(
                    "[wechat-transfer] launch merchant transfer failed",
                    error instanceof Error ? error.message : error,
                );
            } finally {
                launchingRef.current = false;
            }
        },
        [],
    );

    useEffect(() => {
        if (!isSupported) {
            return;
        }

        void processTransferStatusSync();
        void refetchWithdrawals();

        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                void processTransferStatusSync();
                void refetchWithdrawals();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isSupported, processTransferStatusSync, refetchWithdrawals]);

    useEffect(() => {
        if (
            !isSupported ||
            !candidate ||
            isFetchingWithdrawals ||
            launchingRef.current ||
            syncingRef.current ||
            getPendingWechatMerchantTransferSession() ||
            getWechatMerchantTransferResultSnapshot() ||
            isWechatMerchantTransferCoolingDown(candidate.withdrawal!.id)
        ) {
            return;
        }

        void launchTransferConfirm(candidate);
    }, [candidate, isFetchingWithdrawals, isSupported, launchTransferConfirm]);
}
