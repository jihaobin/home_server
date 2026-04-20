import type {
    MassageLandingQuery,
    MassageLandingResponse,
    MassagePersonnelDetailQuery,
    MassagePersonnelDetailResponse,
    ServiceTagEntry,
} from "@repo/types";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

export const useMassageLanding = (
    params: Partial<MassageLandingQuery> = {},
) =>
    useSuspenseQuery({
        queryKey: ["massage-landing", params],
        queryFn: async () => {
            const response = await apiClient.get<MassageLandingResponse>(
                "/massage/landing",
                {
                    query: {
                        ...(params.lat !== undefined
                            ? { lat: params.lat.toString() }
                            : {}),
                        ...(params.lng !== undefined
                            ? { lng: params.lng.toString() }
                            : {}),
                        ...(params.addressText !== undefined
                            ? { addressText: params.addressText }
                            : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "按摩落地页数据获取失败",
        },
    });

export const useMassageTags = (options: { enabled?: boolean } = {}) =>
    useQuery({
        queryKey: ["massage-tags"],
        enabled: options.enabled,
        queryFn: async () => {
            const response = await apiClient.get<ServiceTagEntry[]>(
                "/massage/tags",
            );
            return response.data;
        },
        meta: {
            errorMessage: "按摩标签获取失败",
        },
    });

export const useMassagePersonnelDetail = (
    personnelId: string,
    params: Partial<MassagePersonnelDetailQuery> = {},
) =>
    useSuspenseQuery({
        queryKey: ["massage-personnel-detail", personnelId, params],
        queryFn: async () => {
            const response = await apiClient.get<MassagePersonnelDetailResponse>(
                `/massage/personnel/${personnelId}`,
                {
                    query: {
                        ...(params.serviceId !== undefined
                            ? { serviceId: params.serviceId }
                            : {}),
                        ...(params.pricingId !== undefined
                            ? { pricingId: params.pricingId }
                            : {}),
                        ...(params.lat !== undefined
                            ? { lat: params.lat.toString() }
                            : {}),
                        ...(params.lng !== undefined
                            ? { lng: params.lng.toString() }
                            : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "按摩详情数据获取失败",
        },
    });
