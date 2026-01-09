import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/lib/http-client';
import type {
    AdminAppReleaseListQuery,
    AdminCreateAppRelease,
    AdminUpdateAppRelease,
    AppReleaseDetail,
    AppReleaseListItem,
    AppUpdateCheckQuery,
    AppUpdateCheckResponse,
} from '@repo/types';

const normalizeListQuery = (query: AdminAppReleaseListQuery) => ({
	...query,
	isActive:
        typeof query.isActive === 'boolean'
            ? String(query.isActive)
            : query.isActive,
});

export const useAdminAppReleases = (query: AdminAppReleaseListQuery = {}) =>
    useSuspenseQuery({
        queryKey: ['admin-app-releases', query],
        queryFn: async () => {
            const response = await apiClient.get<AppReleaseListItem[]>(
                '/admin/app-releases',
                {
                    query: normalizeListQuery(query),
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: '获取应用版本列表失败',
        },
    });

export const useAdminAppReleaseDetail = (id?: string) =>
    useQuery({
        queryKey: ['admin-app-release-detail', id],
        enabled: Boolean(id),
        queryFn: async () => {
            const response = await apiClient.get<AppReleaseDetail>(
                `/admin/app-releases/${id}`,
            );
            return response.data;
        },
        meta: {
            errorMessage: '获取应用版本详情失败',
        },
    });

export const useAdminCreateAppRelease = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AdminCreateAppRelease) =>
            apiClient.post<AppReleaseDetail>('/admin/app-releases', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['admin-app-releases'],
            });
        },
        meta: {
            errorMessage: '创建应用版本失败',
        },
    });
};

export const useAdminUpdateAppRelease = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            id: string;
            payload: AdminUpdateAppRelease;
        }) =>
            apiClient.patch<AppReleaseDetail>(
                `/admin/app-releases/${params.id}`,
                params.payload,
            ),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['admin-app-releases'],
            });
            if (variables.id) {
                queryClient.invalidateQueries({
                    queryKey: ['admin-app-release-detail', variables.id],
                });
            }
        },
        meta: {
            errorMessage: '更新应用版本失败',
        },
    });
};

export const useAdminRollbackAppRelease = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            apiClient.post<AppReleaseDetail>(
                `/admin/app-releases/${id}/rollback`,
            ),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({
                queryKey: ['admin-app-releases'],
            });
            if (id) {
                queryClient.invalidateQueries({
                    queryKey: ['admin-app-release-detail', id],
                });
            }
        },
        meta: {
            errorMessage: '回滚应用版本失败',
        },
	});
};

export const appUpdateCheckQueryKey = (params: AppUpdateCheckQuery) => [
	'app-update-check',
	params,
];

export const appUpdateCheckQueryFn = async (params: AppUpdateCheckQuery) => {
	const response = await apiClient.get<AppUpdateCheckResponse>(
		'/app-updates/check',
		{ query: params },
	);
	return response.data;
};

export const useAppUpdateCheck = (
	params: AppUpdateCheckQuery,
	options?: { enabled?: boolean },
) =>
	useQuery({
		queryKey: appUpdateCheckQueryKey(params),
		enabled:
			options?.enabled ??
			Boolean(params?.app && params?.platform && params?.currentVersion),
		queryFn: () => appUpdateCheckQueryFn(params),
		meta: {
			errorMessage: '检查更新失败',
		},
	});
