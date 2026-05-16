import type {
    RemovePersonnelPricingRequest,
    ServiceOfferingSubmissionResult,
    UpdatePersonnelSkillsRequest,
    UpdateServiceNonSensitiveFieldsRequest,
    UpsertPersonnelPricingRequest,
    UpsertWorkInfoRequest,
    UpdateServiceOfferingsRequest,
    WorkerServicesResponse,
    WithdrawServiceDraftResponse,
} from "@repo/types";
import {
    ServiceOfferingSubmissionResultSchema,
    WorkerServicesResponseSchema,
    WithdrawServiceDraftResponseSchema,
} from "@repo/types";
import { apiClient } from "@repo/lib/http-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const workSkillQueryKeys = {
    personnelProfile: ["service-personnel-profile"] as const,
    workerServices: ["worker-services"] as const,
};

type QueryClient = ReturnType<typeof useQueryClient>;
type WorkerServiceItem = WorkerServicesResponse["services"][number];
type RawDate = Date | string | null | undefined;
type RawWorkerServiceDraft = Omit<
    NonNullable<WorkerServiceItem["draft"]>,
    "submittedAt" | "reviewedAt"
> & {
    submittedAt?: RawDate;
    reviewedAt?: RawDate;
};
type RawWorkerServiceAuditLog = Omit<
    WorkerServiceItem["auditLogs"][number],
    "occurredAt"
> & {
    occurredAt?: Exclude<RawDate, null>;
};
type RawWorkerServiceItem = Omit<
    WorkerServiceItem,
    "lastSubmittedAt" | "lastReviewedAt" | "updatedAt" | "draft" | "auditLogs"
> & {
    lastSubmittedAt?: RawDate;
    lastReviewedAt?: RawDate;
    updatedAt?: RawDate;
    draft?: RawWorkerServiceDraft | null;
    auditLogs: RawWorkerServiceAuditLog[];
};
type RawWorkerServicesResponse = {
    services: RawWorkerServiceItem[];
};

const toRequiredNullableDate = (value: RawDate) => {
    if (value === null || value === undefined || value instanceof Date) {
        return value;
    }
    return new Date(value);
};

const toRequiredDate = (value: Exclude<RawDate, null>) => {
    if (value === undefined || value instanceof Date) {
        return value;
    }
    return new Date(value);
};

const normalizeWorkerServicesResponse = (
    response: RawWorkerServicesResponse,
): RawWorkerServicesResponse => ({
    services: response.services.map((service) => ({
        ...service,
        lastSubmittedAt: toRequiredNullableDate(service.lastSubmittedAt),
        lastReviewedAt: toRequiredNullableDate(service.lastReviewedAt),
        updatedAt: toRequiredNullableDate(service.updatedAt),
        draft:
            service.draft === null || service.draft === undefined
                ? service.draft
                : {
                      ...service.draft,
                      submittedAt: toRequiredNullableDate(
                          service.draft.submittedAt,
                      ),
                      reviewedAt: toRequiredNullableDate(
                          service.draft.reviewedAt,
                      ),
                  },
        auditLogs: service.auditLogs.map((auditLog) => ({
            ...auditLog,
            occurredAt: toRequiredDate(auditLog.occurredAt),
        })),
    })),
});

export const invalidateWorkerServices = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({
        queryKey: workSkillQueryKeys.personnelProfile,
    });
    queryClient.invalidateQueries({
        queryKey: workSkillQueryKeys.workerServices,
    });
};

const invalidatePersonnelProfile = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({
        queryKey: workSkillQueryKeys.personnelProfile,
    });
};

export const useMyWorkerServices = () =>
    useQuery({
        queryKey: workSkillQueryKeys.workerServices,
        meta: {
            errorMessage: "获取服务审核状态失败",
        },
        queryFn: async () => {
            const response = await apiClient.get<RawWorkerServicesResponse>(
                "/workSkill/worker/services",
            );
            return WorkerServicesResponseSchema.parse(
                normalizeWorkerServicesResponse(response.data),
            );
        },
    });

export const useUpsertWorkInfo = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpsertWorkInfoRequest) => {
            const response = await apiClient.post(
                "/workSkill/workInfo",
                payload,
            );
            return response.data;
        },
        onSuccess: () => invalidatePersonnelProfile(queryClient),
        scope: {
            id: "upsertWorkInfo",
        },
    });
};

export const useUpdatePersonnelSkills = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdatePersonnelSkillsRequest) => {
            const response = await apiClient.put("/workSkill/skills", payload);
            return response.data;
        },
        onSuccess: () => invalidatePersonnelProfile(queryClient),
        scope: {
            id: "updatePersonnelSkills",
        },
    });
};

export const useUpsertPersonnelPricing = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpsertPersonnelPricingRequest) => {
            const response = await apiClient.post(
                "/workSkill/pricing",
                payload,
            );
            return response.data;
        },
        onSuccess: () => invalidatePersonnelProfile(queryClient),
        scope: {
            id: "upsertPersonnelPricing",
        },
    });
};

export const useRemovePersonnelPricing = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (
            serviceId: RemovePersonnelPricingRequest["serviceId"],
        ) => {
            const response = await apiClient.delete(
                `/workSkill/pricing/${serviceId}`,
            );
            return response.data;
        },
        onSuccess: () => invalidatePersonnelProfile(queryClient),
        scope: {
            id: "removePersonnelPricing",
        },
    });
};

export const useUpdateServiceOfferings = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdateServiceOfferingsRequest) => {
            const response =
                await apiClient.put<ServiceOfferingSubmissionResult>(
                    "/workSkill/offerings",
                    payload,
                );
            return ServiceOfferingSubmissionResultSchema.parse({
                ...response.data,
                submittedAt: new Date(response.data.submittedAt),
            });
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        scope: {
            id: "updateServiceOfferings",
        },
    });
};

export const useSubmitServiceUpdate = () => useUpdateServiceOfferings();

export const useUpdateActiveService = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            serviceId,
            ...rest
        }: UpdateServiceNonSensitiveFieldsRequest) => {
            const response = await apiClient.patch<{
                serviceId: string;
                updated: true;
            }>(`/workSkill/worker/services/${serviceId}`, rest);
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "保存服务设置失败",
        },
        scope: {
            id: "updateActiveService",
        },
    });
};

export const useTakedownService = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (serviceId: string) => {
            const response = await apiClient.post<{
                serviceId: string;
                takenDown: true;
            }>(`/workSkill/worker/services/${serviceId}/takedown`);
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "下架服务失败",
        },
        scope: {
            id: "takedownService",
        },
    });
};

export const useDeleteService = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            serviceId,
            confirmName,
        }: {
            serviceId: string;
            confirmName: string;
        }) => {
            const response = await apiClient.delete<{
                serviceId: string;
                deleted: true;
            }>(`/workSkill/worker/services/${serviceId}`, {
                body: { confirmName },
            });
            return response.data;
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "删除服务失败",
        },
        scope: {
            id: "deleteService",
        },
    });
};

export const useWithdrawServiceDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (serviceId: string) => {
            const response =
                await apiClient.delete<WithdrawServiceDraftResponse>(
                    `/workSkill/worker/services/${serviceId}/draft`,
                );
            return WithdrawServiceDraftResponseSchema.parse(response.data);
        },
        onSuccess: () => invalidateWorkerServices(queryClient),
        meta: {
            errorMessage: "撤回提交失败",
        },
        scope: {
            id: "withdrawServiceDraft",
        },
    });
};
