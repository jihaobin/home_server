import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";
import {
	ErrorCode,
	type UserProfiles,
	userAuthRealNameDataSchema,
} from "@repo/types";
import {
	isApiClientError,
	ApiClientError,
} from "@repo/utils/api-client";

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

interface VerifyRealNamePayload {
	name: string;
	idCard: string;
	userId: string;
}

export const useVerifyAndSaveRealName = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ name, idCard, userId }: VerifyRealNamePayload) => {
			const normalizedName = name.trim();
			const normalizedIdCard = idCard.trim().toUpperCase();

			const verificationResponse = await apiClient.get(
				"/userAuthRealName/realNameAuth",
				{
					query: {
						name: normalizedName,
						idcard: normalizedIdCard,
					},
					schema: userAuthRealNameDataSchema,
				},
			);
			const verificationResult = verificationResponse.data;

			if (!verificationResult?.res) {
				throw new ApiClientError(
					ErrorCode.BUSINESS_ERROR,
					verificationResult?.description ?? "实名认证未通过，请检查身份信息",
				);
			}

			const payload = {
				realName: normalizedName,
				idCardNumber: normalizedIdCard,
			};

			try {
				await apiClient.post("/userAuthRealName", payload);
			} catch (error) {
				if (
					isApiClientError(error) &&
					(error.code === ErrorCode.BAD_REQUEST ||
						error.code === ErrorCode.RESOURCE_EXISTS ||
						error.code === ErrorCode.CONFLICT)
				) {
					await apiClient.post(`/userAuthRealName/${userId}`, payload);
				} else {
					throw error;
				}
			}

			await queryClient.invalidateQueries({
				queryKey: ["user-real-name-profile", userId],
			});

			return verificationResult;
		},
	});
};
