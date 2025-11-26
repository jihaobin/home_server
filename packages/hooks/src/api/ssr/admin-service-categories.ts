import {
    AdminServiceCategoryListResponseSchema,
    AdminServiceCategorySchema,
    CreateAdminServiceCategorySchema,
    UpdateAdminServiceCategorySchema,
    type AdminServiceCategoryListResponse,
    type AdminServiceCategory,
    type CreateAdminServiceCategoryInput,
    type UpdateAdminServiceCategoryInput,
} from '@repo/types';
import {
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from '@tanstack/react-query';
import { z } from 'zod/v4';
import { getSsrApiClient } from './client';

const ADMIN_SERVICE_CATEGORIES_QUERY_KEY = [
    'admin-service-categories',
] as const;

export const adminServiceCategoriesQueryOptions = () =>
    queryOptions<AdminServiceCategoryListResponse>({
        queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response =
                await apiClient.get<AdminServiceCategoryListResponse>(
                    '/admin/service-categories',
                    {
                        schema: AdminServiceCategoryListResponseSchema,
                    },
                );

            if (!response.data) {
                throw new Error('服务分类数据为空');
            }

            return response.data;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        meta: {
            errorMessage: '服务分类获取失败',
        },
    });

export function useAdminServiceCategories() {
    return useSuspenseQuery(adminServiceCategoriesQueryOptions());
}

export function useCreateAdminServiceCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateAdminServiceCategoryInput) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.post<AdminServiceCategory>(
                '/admin/service-categories',
                payload,
                {
                    schema: AdminServiceCategorySchema,
                },
            );

            if (!response.data) {
                throw new Error('服务分类创建失败');
            }

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
            });
        },
        meta: {
            errorMessage: '创建服务分类失败',
        },
    });
}

export function useUpdateAdminServiceCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            data,
        }: {
            id: string;
            data: UpdateAdminServiceCategoryInput;
        }) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.put<AdminServiceCategory>(
                `/admin/service-categories/${id}`,
                data,
                {
                    schema: AdminServiceCategorySchema,
                },
            );

            if (!response.data) {
                throw new Error('服务分类更新失败');
            }

            return response.data;
        },
        onSuccess: (updated) => {
            if (!updated) return;
            queryClient.invalidateQueries({
                queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
            });
            queryClient.setQueryData(
                ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
                (previous) => previous,
            );
        },
        meta: {
            errorMessage: '更新服务分类失败',
        },
    });
}

const DeleteCategoryResponseSchema = z.object({
    success: z.boolean(),
});

export function useDeleteAdminServiceCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.delete<{ success: boolean }>(
                `/admin/service-categories/${id}`,
                {
                    schema: DeleteCategoryResponseSchema,
                },
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
            });
        },
        meta: {
            errorMessage: '删除服务分类失败',
        },
    });
}

export { ADMIN_SERVICE_CATEGORIES_QUERY_KEY as adminServiceCategoriesQueryKey };
