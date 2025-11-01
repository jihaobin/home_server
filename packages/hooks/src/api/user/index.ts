import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";
import { ErrorCode, type UserProfiles } from "@repo/types";
import { isApiClientError } from "@repo/utils/api-client";

export const useUserRealNameProfile = (userId?: string) =>
	useQuery({
		queryKey: ["user-real-name-profile", userId],
		enabled: Boolean(userId),
		meta: {
			errorMessage: "实名认证信息获取失败",
		},
		queryFn: async () => {
			if (!userId) {
				return null;
			}

			try {
				const response = await apiClient.get<UserProfiles>(
					`/userAuthRealName/${userId}`,
				);
				return response.data ?? null;
			} catch (error) {
				if (
					isApiClientError(error) &&
					(error.code === ErrorCode.NOT_FOUND || error.code === ErrorCode.RESOURCE_NOT_FOUND)
				) {
					return null;
				}

				throw error;
			}
		},
		staleTime: 1000 * 60 * 5,
	});
