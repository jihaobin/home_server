import type {
	RemovePersonnelPricingRequest,
	UpdatePersonnelSkillsRequest,
	UpsertPersonnelPricingRequest,
	UpsertWorkInfoRequest,
	UpdateServiceOfferingsRequest,
} from "@repo/types";
import { apiClient } from "@repo/lib/http-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const invalidatePersonnelProfile = (queryClient: ReturnType<typeof useQueryClient>) => {
	queryClient.invalidateQueries({
		queryKey: ["service-personnel-profile"],
	});
};

export const useUpsertWorkInfo = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: UpsertWorkInfoRequest) => {
			const response = await apiClient.post("/workSkill/workInfo", payload);
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
			const response = await apiClient.post("/workSkill/pricing", payload);
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
		mutationFn: async (serviceId: RemovePersonnelPricingRequest["serviceId"]) => {
			const response = await apiClient.delete(`/workSkill/pricing/${serviceId}`);
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
			const response = await apiClient.put(
				"/workSkill/offerings",
				payload,
			);
			return response.data;
		},
		onSuccess: () => invalidatePersonnelProfile(queryClient),
		scope: {
			id: "updateServiceOfferings",
		},
	});
};
