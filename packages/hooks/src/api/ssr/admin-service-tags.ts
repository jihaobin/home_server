import {
    AdminServiceTagListResponseSchema,
    AdminServiceTagSchema,
    CreateAdminServiceTagSchema,
    UpdateAdminServiceTagSchema,
    type AdminServiceTag,
    type AdminServiceTagListQuery,
    type AdminServiceTagListResponse,
    type CreateAdminServiceTagInput,
    type UpdateAdminServiceTagInput,
} from '@repo/types';
import {
    QueryClient,
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from '@tanstack/react-query';
import { z } from 'zod/v4';
import { getSsrApiClient } from './client';

const ADMIN_SERVICE_TAGS_QUERY_KEY = ['admin-service-tags'] as const;
const DEFAULT_ADMIN_SERVICE_TAGS_QUERY: AdminServiceTagListQuery = {
    status: 'all',
};

type NormalizedAdminServiceTagsQuery = {
    domain?: AdminServiceTagListQuery['domain'];
    keyword?: string;
    status: NonNullable<AdminServiceTagListQuery['status']>;
};

function normalizeAdminServiceTagsQuery(
    input: AdminServiceTagListQuery = DEFAULT_ADMIN_SERVICE_TAGS_QUERY,
): NormalizedAdminServiceTagsQuery {
    return {
        domain: input.domain,
        keyword: input.keyword?.trim() ? input.keyword.trim() : undefined,
        status: input.status ?? 'all',
    };
}

export const adminServiceTagsQueryKey = (
    params: AdminServiceTagListQuery = DEFAULT_ADMIN_SERVICE_TAGS_QUERY,
) =>
    [
        ...ADMIN_SERVICE_TAGS_QUERY_KEY,
        normalizeAdminServiceTagsQuery(params),
    ] as const;

export const adminServiceTagsQueryOptions = (
    params: AdminServiceTagListQuery = DEFAULT_ADMIN_SERVICE_TAGS_QUERY,
) => {
    const normalized = normalizeAdminServiceTagsQuery(params);

    return queryOptions<AdminServiceTagListResponse>({
        queryKey: adminServiceTagsQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminServiceTagListResponse>(
                '/admin/service-tags',
                {
                    query: normalized,
                    schema: AdminServiceTagListResponseSchema,
                },
            );

            if (!response.data) {
                throw new Error('服务标签数据为空');
            }

            return response.data;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        meta: {
            errorMessage: '服务标签获取失败',
        },
    });
};

export function useAdminServiceTags(
    params: AdminServiceTagListQuery = DEFAULT_ADMIN_SERVICE_TAGS_QUERY,
) {
    return useSuspenseQuery(adminServiceTagsQueryOptions(params));
}

function invalidateAdminServiceTagsQuery(
    queryClient: QueryClient,
    params?: AdminServiceTagListQuery,
) {
    if (params) {
        return queryClient.invalidateQueries({
            queryKey: adminServiceTagsQueryKey(params),
        });
    }

    return queryClient.invalidateQueries({
        queryKey: ADMIN_SERVICE_TAGS_QUERY_KEY,
    });
}

export function useCreateAdminServiceTag(query?: AdminServiceTagListQuery) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateAdminServiceTagInput) => {
            const apiClient = getSsrApiClient();
            const parsedPayload = CreateAdminServiceTagSchema.parse(payload);
            const response = await apiClient.post<AdminServiceTag>(
                '/admin/service-tags',
                parsedPayload,
                {
                    schema: AdminServiceTagSchema,
                },
            );

            if (!response.data) {
                throw new Error('服务标签创建失败');
            }

            return response.data;
        },
        onSuccess: () => {
            void invalidateAdminServiceTagsQuery(queryClient, query);
        },
        meta: {
            errorMessage: '创建服务标签失败',
        },
    });
}

export function useUpdateAdminServiceTag(query?: AdminServiceTagListQuery) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            data,
        }: {
            id: string;
            data: UpdateAdminServiceTagInput;
        }) => {
            const apiClient = getSsrApiClient();
            const parsedPayload = UpdateAdminServiceTagSchema.parse(data);
            const response = await apiClient.patch<AdminServiceTag>(
                `/admin/service-tags/${id}`,
                parsedPayload,
                {
                    schema: AdminServiceTagSchema,
                },
            );

            if (!response.data) {
                throw new Error('服务标签更新失败');
            }

            return response.data;
        },
        onSuccess: () => {
            void invalidateAdminServiceTagsQuery(queryClient, query);
        },
        meta: {
            errorMessage: '更新服务标签失败',
        },
    });
}

const DeleteAdminServiceTagResponseSchema = z.object({
    success: z.boolean(),
});

export function useDeleteAdminServiceTag(query?: AdminServiceTagListQuery) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.delete<{ success: boolean }>(
                `/admin/service-tags/${id}`,
                {
                    schema: DeleteAdminServiceTagResponseSchema,
                },
            );

            if (!response.data) {
                throw new Error('服务标签删除失败');
            }

            return response.data;
        },
        onSuccess: () => {
            void invalidateAdminServiceTagsQuery(queryClient, query);
        },
        meta: {
            errorMessage: '删除服务标签失败',
        },
    });
}
