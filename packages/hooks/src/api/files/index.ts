import {
    useMutation,
    useQuery,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import type {
    FileDownloadUrlResponse,
    FileInfoResponse,
    FileListResponse,
    FileThumbnailResponse,
    FileUploadResponse,
} from "@repo/types";
import { apiClient } from "@repo/lib/http-client";

const FILES_QUERY_KEY = {
    LIST: "files-user-list",
    INFO: "files-info",
    DOWNLOAD: "files-download-url",
    THUMBNAIL: "files-thumbnail",
} as const;

// React Native 文件对象格式
interface ReactNativeFile {
    uri: string;
    name: string;
    type: string;
}

interface UploadFileOptions {
    file: File | ReactNativeFile | Blob;
    fileName?: string;
    fileType?: string;
}

interface UploadFilesOptions {
    files: UploadFileOptions[];
}

export const useUserFiles = (params?: { limit?: number; offset?: number }) =>
    useSuspenseQuery({
        queryKey: [FILES_QUERY_KEY.LIST, params?.limit, params?.offset],
        queryFn: async () => {
            const response = await apiClient.get<FileListResponse>(
                "/files/user/list",
                {
                    query: {
                        limit: params?.limit?.toString(),
                        offset: params?.offset?.toString(),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "文件列表获取失败",
        },
        staleTime: 5 * 60 * 1000,
    });

export const useFileInfo = (fileId: string) =>
    useSuspenseQuery({
        queryKey: [FILES_QUERY_KEY.INFO, fileId],
        queryFn: async () => {
            const response = await apiClient.get<FileInfoResponse>(
                `/files/${fileId}/info`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "文件详情获取失败",
        },
    });

export const useFile = (fileIdentifier?: string | null) =>
    useQuery({
        queryKey: [FILES_QUERY_KEY.DOWNLOAD, fileIdentifier],
        enabled: Boolean(fileIdentifier),
        queryFn: async () => {
            if (!fileIdentifier) {
                return null;
            }
            const response = await apiClient.get<FileDownloadUrlResponse>(
                `/files/${fileIdentifier}`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "下载链接获取失败",
        },
        staleTime: 10 * 60 * 1000,
    });

export const useFileThumbnail = (fileIdentifier?: string | null) =>
    useQuery({
        queryKey: [FILES_QUERY_KEY.THUMBNAIL, fileIdentifier],
        enabled: Boolean(fileIdentifier),
        queryFn: async () => {
            if (!fileIdentifier) {
                return null;
            }
            const response = await apiClient.get<FileThumbnailResponse>(
                `/files/${fileIdentifier}/thumbnail`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "缩略图获取失败",
        },
        staleTime: 10 * 60 * 1000,
    });

export const useUploadFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ file, fileName, fileType }: UploadFileOptions) => {
            const formData = new FormData();

            // 判断是否为 React Native 文件格式
            if ("uri" in file && "name" in file && "type" in file) {
                // React Native 格式: { uri, name, type }
                const reactNativeFile = file as ReactNativeFile;
                // React Native FormData 支持 uri 格式
                formData.append("file", {
                    uri: reactNativeFile.uri,
                    name: fileName ?? reactNativeFile.name,
                    type: reactNativeFile.type,
                } as any);
            } else if (file instanceof File) {
                // 浏览器 File 对象
                formData.append("file", file, fileName ?? file.name);
            } else {
                // Blob 对象
                formData.append("file", file, fileName ?? "blob");
            }

            if (fileType) {
                formData.append("fileType", fileType);
            }

            const response = await apiClient.post<FileUploadResponse>(
                "/files/upload",
                formData,
                {
                    query: undefined,
                },
            );

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [FILES_QUERY_KEY.LIST] });
        },
        scope: {
            id: "uploadFile",
        },
    });
};

export const useUploadFiles = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ files }: UploadFilesOptions) => {
            const formData = new FormData();

            for (const item of files) {
                const file = item.file;
                const fileName = item.fileName;

                if ("uri" in file && "name" in file && "type" in file) {
                    const reactNativeFile = file as ReactNativeFile;
                    formData.append("files", {
                        uri: reactNativeFile.uri,
                        name: fileName ?? reactNativeFile.name,
                        type: reactNativeFile.type,
                    } as any);
                } else if (file instanceof File) {
                    formData.append("files", file, fileName ?? file.name);
                } else {
                    formData.append("files", file, fileName ?? "blob");
                }
            }

            const response = await apiClient.post<FileUploadResponse[]>(
                "/files/upload/batch",
                formData,
                {
                    query: undefined,
                },
            );

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [FILES_QUERY_KEY.LIST] });
        },
        scope: {
            id: "uploadFiles",
        },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (fileIdentifier: string) => {
            return apiClient.delete(`/files/${fileIdentifier}`);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [FILES_QUERY_KEY.LIST] });
            if (variables) {
                queryClient.invalidateQueries({
                    queryKey: [FILES_QUERY_KEY.INFO, variables],
                });
            }
        },
        scope: {
            id: "deleteFile",
        },
    });
};
