import {
    AppReleaseDetailSchema,
    AppReleaseListItemSchema,
    type AdminAppReleaseListQuery,
    type AdminCreateAppRelease,
    type AdminUpdateAppRelease,
    type AppReleaseDetail,
    type AppReleaseListItem,
} from '@repo/types';
import {
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from '@tanstack/react-query';
import { getSsrApiClient } from './client';

const ADMIN_APP_RELEASES_QUERY_KEY = ['admin-app-releases'] as const;

export const adminAppReleasesQueryOptions = (
    query: AdminAppReleaseListQuery = {},
) =>
    queryOptions({
        queryKey: [...ADMIN_APP_RELEASES_QUERY_KEY, query],
        queryFn: async () => {
            const client = getSsrApiClient();
            const response = await client.get<AppReleaseListItem[]>(
                '/admin/app-releases',
                {
                    query: query,
                },
            );
            return AppReleaseListItemSchema.array().parse(
                response.data.map(normalizeReleaseDates),
            );
        },
    });

export const adminAppReleaseDetailQueryOptions = (id: string) =>
    queryOptions({
        queryKey: ['admin-app-release-detail', id],
        queryFn: async () => {
            const client = getSsrApiClient();
            const response = await client.get<AppReleaseDetail>(
                `/admin/app-releases/${id}`,
            );
            return AppReleaseDetailSchema.parse(
                normalizeReleaseDates(response.data),
            );
        },
        enabled: Boolean(id),
    });

export function useAdminAppReleases(query: AdminAppReleaseListQuery = {}) {
    return useSuspenseQuery(adminAppReleasesQueryOptions(query));
}

export function useAdminAppReleaseDetail(id: string) {
    return useSuspenseQuery(adminAppReleaseDetailQueryOptions(id));
}

export function useCreateAdminAppRelease() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AdminCreateAppRelease) =>
            getSsrApiClient().post<AppReleaseDetail>(
                '/admin/app-releases',
                payload,
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ADMIN_APP_RELEASES_QUERY_KEY,
            });
        },
        meta: {
            errorMessage: '创建应用版本失败',
        },
    });
}

export function useUpdateAdminAppRelease() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { id: string; payload: AdminUpdateAppRelease }) =>
            getSsrApiClient().patch<AppReleaseDetail>(
                `/admin/app-releases/${params.id}`,
                params.payload,
            ),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ADMIN_APP_RELEASES_QUERY_KEY,
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
}

export function useRollbackAdminAppRelease() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            getSsrApiClient().post<AppReleaseDetail>(
                `/admin/app-releases/${id}/rollback`,
            ),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({
                queryKey: ADMIN_APP_RELEASES_QUERY_KEY,
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
}

export type AdminAppReleasesQueryInput = AdminAppReleaseListQuery;

function normalizeReleaseDates<T extends { createdAt?: unknown; updatedAt?: unknown; publishedAt?: unknown }>(
    release: T,
): T {
    if (!release) return release;
    return {
        ...release,
        createdAt: release.createdAt
            ? new Date(release.createdAt as string | number | Date)
            : release.createdAt,
        updatedAt: release.updatedAt
            ? new Date(release.updatedAt as string | number | Date)
            : release.updatedAt,
        publishedAt: release.publishedAt
            ? new Date(release.publishedAt as string | number | Date)
            : release.publishedAt,
    };
}
