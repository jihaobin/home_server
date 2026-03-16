import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

type UseGlobalPageRefreshOptions = {
    enabled?: boolean;
    refetchActiveQueries?: boolean;
    extraRefresh?: () => Promise<unknown> | unknown;
};

export function useGlobalPageRefresh(
    options: UseGlobalPageRefreshOptions = {},
) {
    const {
        enabled = true,
        refetchActiveQueries = true,
        extraRefresh,
    } = options;
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [showPageLoading, setShowPageLoading] = useState(false);
    const mountedRef = useRef(true);
    const inFlightRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const onRefresh = useCallback(async () => {
        if (!enabled || refreshing || showPageLoading || inFlightRef.current) {
            return;
        }

        inFlightRef.current = true;
        setRefreshing(true);
        setShowPageLoading(true);
        try {
            if (refetchActiveQueries) {
                await queryClient.refetchQueries(
                    {
                        type: "active",
                    },
                    {
                        throwOnError: false,
                    },
                );
            }

            if (extraRefresh) {
                await extraRefresh();
            }
        } catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("[useGlobalPageRefresh] refresh failed", error);
            }
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) {
                setRefreshing(false);
                setShowPageLoading(false);
            }
        }
    }, [
        enabled,
        extraRefresh,
        queryClient,
        refreshing,
        refetchActiveQueries,
        showPageLoading,
    ]);

    return {
        refreshing,
        showPageLoading,
        onRefresh,
    };
}
