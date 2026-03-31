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
    DEFAULT_WECHAT_MERCHANT_TRANSFER_COOLDOWN_MS,
    clearPendingWechatMerchantTransferSession,
    clearWechatMerchantTransferResultSnapshot,
    getWechatMerchantTransferCooldownRemainingMs,
    getPendingWechatMerchantTransferSession,
    getWechatMerchantTransferResultSnapshot,
    isWechatMerchantTransferCoolingDown,
    markWechatMerchantTransferAttempt,
    setPendingWechatMerchantTransferSession,
} from "@/lib/wechat-merchant-transfer-session";

type WithdrawalRecordItem = WorkerEarningsRecordListResponse["items"][number];
type WithdrawalPagesData =
    | {
          pages?: WorkerEarningsRecordListResponse[];
      }
    | undefined;

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
    const queuedWithdrawalIdRef = useRef<string | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerTransferConfirmRef = useRef<
        ((withdrawalId?: string | null) => Promise<boolean>) | null
    >(null);

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

    const findEligibleWithdrawal = useCallback(
        (
            data: WithdrawalPagesData,
            withdrawalId?: string | null,
        ): WithdrawalRecordItem | undefined => {
            const items = (data?.pages ?? []).flatMap((page) => page.items);
            const eligibleItems = items
                .filter(isEligibleWithdrawal)
                .sort((left, right) => {
                    const leftTime = new Date(
                        left.withdrawal?.requestedAt ?? left.occurredAt,
                    ).getTime();
                    const rightTime = new Date(
                        right.withdrawal?.requestedAt ?? right.occurredAt,
                    ).getTime();
                    return leftTime - rightTime;
                });

            if (withdrawalId) {
                return eligibleItems.find(
                    (item) => item.withdrawal?.id === withdrawalId,
                );
            }

            return eligibleItems[0];
        },
        [],
    );

    const invalidateWithdrawalQueries = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({
                queryKey: ["worker-earnings-records"],
            }),
            queryClient.invalidateQueries({ queryKey: ["earnings-overview"] }),
        ]);
    }, [queryClient]);

    const clearRetryTimer = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const scheduleRetry = useCallback(
        (withdrawalId?: string | null, delayMs = 1_000) => {
            queuedWithdrawalIdRef.current = withdrawalId ?? null;
            clearRetryTimer();
            retryTimerRef.current = setTimeout(
                () => {
                    retryTimerRef.current = null;
                    const queuedWithdrawalId = queuedWithdrawalIdRef.current;
                    queuedWithdrawalIdRef.current = null;
                    void triggerTransferConfirmRef.current?.(
                        queuedWithdrawalId,
                    );
                },
                Math.max(500, delayMs),
            );
        },
        [clearRetryTimer],
    );

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
                clearPendingWechatMerchantTransferSession();
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
                return false;
            }

            const providerAppId = record.withdrawal.providerAppId;
            const providerPackageInfo = record.withdrawal.providerPackageInfo;
            const mchId = extractMchId(record);
            if (!providerAppId || !providerPackageInfo || !mchId) {
                return false;
            }

            const { appId: sdkAppId, universalLink } =
                resolveWorkerWechatSdkConfig();
            const appId = providerAppId || sdkAppId;
            if (!appId) {
                return false;
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

                const dispatched = await requestWechatMerchantTransfer({
                    mchId,
                    appId,
                    package: providerPackageInfo,
                });

                if (!dispatched) {
                    clearPendingWechatMerchantTransferSession();
                    return false;
                }

                markWechatMerchantTransferAttempt(record.withdrawal.id);
                return true;
            } catch (error) {
                clearPendingWechatMerchantTransferSession();
                console.warn(
                    "[wechat-transfer] launch merchant transfer failed",
                    error instanceof Error ? error.message : error,
                );
                return false;
            } finally {
                launchingRef.current = false;
            }
        },
        [],
    );

    const triggerTransferConfirm = useCallback(
        async (withdrawalId?: string | null) => {
            if (!isSupported) {
                return false;
            }

            if (
                launchingRef.current ||
                syncingRef.current ||
                getPendingWechatMerchantTransferSession() ||
                getWechatMerchantTransferResultSnapshot()
            ) {
                scheduleRetry(withdrawalId, 1_500);
                return false;
            }

            const immediateCandidate = findEligibleWithdrawal(
                withdrawalPages,
                withdrawalId,
            );

            if (immediateCandidate?.withdrawal?.id) {
                const cooldownRemaining =
                    getWechatMerchantTransferCooldownRemainingMs(
                        immediateCandidate.withdrawal.id,
                    );
                if (cooldownRemaining > 0) {
                    scheduleRetry(
                        immediateCandidate.withdrawal.id,
                        cooldownRemaining + 300,
                    );
                    return false;
                }

                clearRetryTimer();
                queuedWithdrawalIdRef.current = null;
                return await launchTransferConfirm(immediateCandidate);
            }

            const refreshed = await refetchWithdrawals();
            const refreshedCandidate = findEligibleWithdrawal(
                refreshed.data,
                withdrawalId,
            );

            if (refreshedCandidate?.withdrawal?.id) {
                const cooldownRemaining =
                    getWechatMerchantTransferCooldownRemainingMs(
                        refreshedCandidate.withdrawal.id,
                    );
                if (cooldownRemaining > 0) {
                    scheduleRetry(
                        refreshedCandidate.withdrawal.id,
                        cooldownRemaining + 300,
                    );
                    return false;
                }

                clearRetryTimer();
                queuedWithdrawalIdRef.current = null;
                return await launchTransferConfirm(refreshedCandidate);
            }

            return false;
        },
        [
            clearRetryTimer,
            findEligibleWithdrawal,
            getWechatMerchantTransferCooldownRemainingMs,
            isSupported,
            launchTransferConfirm,
            refetchWithdrawals,
            scheduleRetry,
            withdrawalPages,
        ],
    );

    useEffect(() => {
        triggerTransferConfirmRef.current = triggerTransferConfirm;
    }, [triggerTransferConfirm]);

    useEffect(() => {
        return () => {
            clearRetryTimer();
        };
    }, [clearRetryTimer]);

    useEffect(() => {
        const queuedWithdrawalId = queuedWithdrawalIdRef.current;
        if (
            !queuedWithdrawalId ||
            !isSupported ||
            isFetchingWithdrawals ||
            launchingRef.current ||
            syncingRef.current ||
            getPendingWechatMerchantTransferSession() ||
            getWechatMerchantTransferResultSnapshot() ||
            retryTimerRef.current
        ) {
            return;
        }

        const candidateId =
            candidate?.withdrawal?.id === queuedWithdrawalId
                ? candidate.withdrawal?.id
                : queuedWithdrawalId;
        const cooldownRemaining = candidateId
            ? getWechatMerchantTransferCooldownRemainingMs(
                  candidateId,
                  DEFAULT_WECHAT_MERCHANT_TRANSFER_COOLDOWN_MS,
              )
            : 0;

        if (cooldownRemaining > 0) {
            scheduleRetry(candidateId, cooldownRemaining + 300);
            return;
        }

        clearRetryTimer();
        queuedWithdrawalIdRef.current = null;
        void triggerTransferConfirm(candidateId);
    }, [
        candidate,
        clearRetryTimer,
        getWechatMerchantTransferCooldownRemainingMs,
        isFetchingWithdrawals,
        isSupported,
        scheduleRetry,
        triggerTransferConfirm,
    ]);

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

        void triggerTransferConfirm(candidate.withdrawal?.id);
    }, [candidate, isFetchingWithdrawals, isSupported, triggerTransferConfirm]);

    return {
        triggerTransferConfirm,
        processTransferStatusSync,
    };
}
