import type {
	AddressQuery,
	ChinaCity,
	CreateUserAddress,
	DistrictSearchResponse,
	ParentInfo,
	ReverseGeocodeRequest,
	ReverseGeocodeResponse,
	SuggestionData,
	SuggestionRequest,
	SuggestionResponse,
	UpdateUserAddress,
	UserAddresses,
} from "@repo/types";
import {
	useMutation,
	useQuery,
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MMKV } from "react-native-mmkv";
import { apiClient } from "@/lib/http-client";
import {
	type EnhancedLocationData,
	useHighAccuracyLocation,
} from "@/lib/location-utils";
import { queryClient } from "@/lib/query-client";

export const storage = new MMKV();

/**
 * 缓存管理工具
 */
export const cacheUtils = {
	/**
	 * 清理所有地理编码缓存
	 */
	clearAllGeoCache: () => {
		const allKeys = storage.getAllKeys();
		allKeys.forEach((key) => {
			if (key.startsWith("reverse-geocode-")) {
				storage.delete(key);
			}
		});
		console.log("已清理所有地理编码缓存");
	},

	/**
	 * 获取缓存统计信息
	 */
	getCacheStats: () => {
		const allKeys = storage.getAllKeys();
		const geoKeys = allKeys.filter((key) => key.startsWith("reverse-geocode-"));
		const dataKeys = geoKeys.filter((key) => !key.endsWith("-timestamp"));
		const timestampKeys = geoKeys.filter((key) => key.endsWith("-timestamp"));

		return {
			totalKeys: allKeys.length,
			geoDataKeys: dataKeys.length,
			geoTimestampKeys: timestampKeys.length,
			allGeoKeys: geoKeys.length,
		};
	},
};

/**
 * 标准化经纬度坐标，用于缓存key
 * @param lat 纬度
 * @param lng 经度
 * @param precision 精度位数，默认3位小数（约110米精度）
 * @returns 标准化的坐标字符串
 */
const normalizeCoordinates = (
	lat: number,
	lng: number,
	precision: number = 3,
): string => {
	const normalizedLat = parseFloat(lat.toFixed(precision));
	const normalizedLng = parseFloat(lng.toFixed(precision));
	return `${normalizedLat},${normalizedLng}`;
};

/**
 * 清理过期的地理编码缓存
 */
const clearExpiredGeoCache = () => {
	const CACHE_DURATION = 1 * 24 * 60 * 60 * 1000; // 1天
	const now = Date.now();
	const allKeys = storage.getAllKeys();

	allKeys.forEach((key) => {
		if (key.startsWith("reverse-geocode-") && key.endsWith("-timestamp")) {
			const cachedTime = storage.getNumber(key);
			if (cachedTime && now - cachedTime >= CACHE_DURATION) {
				// 删除过期的缓存数据和时间戳
				const dataKey = key.replace("-timestamp", "");
				storage.delete(dataKey);
				storage.delete(key);
			}
		}
	});
};

/**
 * 获取中国城市列表
 */
export const useChinaCity = (filter: AddressQuery) =>
	useSuspenseQuery({
		queryKey: ["china-city", filter],
		queryFn: async () => {
			// 添加时间戳控制
			const CACHE_KEY = "china-city-cache";
			const CACHE_TIMESTAMP_KEY = "china-city-cache-timestamp";
			const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天

			const cachedData = storage.getString(CACHE_KEY);
			const cachedTime = storage.getNumber(CACHE_TIMESTAMP_KEY);
			const now = Date.now();

			// 检查缓存是否过期
			if (cachedData && cachedTime && now - cachedTime < CACHE_DURATION) {
				return JSON.parse(cachedData) as ChinaCity[];
			}

			const response = await apiClient.get<ChinaCity[]>("/address/all", {
				query: {
					filter: filter.filter,
				},
			});

			// 缓存新数据时保存时间戳
			storage.set(CACHE_KEY, JSON.stringify(response.data));
			storage.set(CACHE_TIMESTAMP_KEY, now);

			return response.data;
		},
		staleTime: 30 * 60 * 1000, // 30分钟内认为数据是新鲜的，不会重新获取
		gcTime: 60 * 60 * 1000, // 1小时的垃圾回收时间，保持缓存更久
		refetchOnWindowFocus: false, // 窗口重新聚焦时不自动重新获取
		refetchOnMount: false, // 组件重新挂载时不自动重新获取
		meta: {
			errorMessage: "中国城市数据获取失败",
		},
	});

/**
 * 地址逆解析(地理坐标转地址信息)
 * @param lat 纬度（完整精度）
 * @param lng 经度（完整精度）
 * @description 遵循腾讯地图接口(https://lbs.qq.com/service/webService/webServiceGuide/address/Gcoder)
 *
 * 缓存策略：
 * - 缓存key使用3位小数坐标（约110米精度），确保相近位置共享缓存
 * - API请求使用完整精度坐标，获得精确的建筑物级别地址信息
 */
const useReverseGeocode = ({ lat, lng }: { lat?: number; lng?: number }) => {
	// 标准化坐标用于查询key和缓存key的一致性
	const normalizedLat = lat ? parseFloat(lat.toFixed(3)) : undefined;
	const normalizedLng = lng ? parseFloat(lng.toFixed(3)) : undefined;

	return useSuspenseQuery({
		queryKey: ["reverse-geocode", normalizedLat, normalizedLng],
		queryFn: async () => {
			if (!lat || !lng) {
				return [];
			}

			// 定期清理过期缓存（可以考虑使用更智能的触发机制）
			if (Math.random() < 0.1) {
				// 10%的概率触发清理
				clearExpiredGeoCache();
			}

			// 使用标准化的坐标作为缓存key（3位小数，约110米精度）
			// 这样可以确保相近位置共享缓存，提高缓存命中率
			const normalizedCoords = normalizeCoordinates(lat, lng);
			const CACHE_KEY = `reverse-geocode-${normalizedCoords}`;
			const CACHE_TIMESTAMP_KEY = `reverse-geocode-${normalizedCoords}-timestamp`;
			const CACHE_DURATION = 1 * 24 * 60 * 60 * 1000; // 1天

			const cachedData = storage.getString(CACHE_KEY);
			const cachedTime = storage.getNumber(CACHE_TIMESTAMP_KEY);
			const now = Date.now();

			// 检查缓存是否过期
			if (cachedData && cachedTime && now - cachedTime < CACHE_DURATION) {
				return JSON.parse(cachedData) as ReverseGeocodeResponse["result"];
			}

			// 使用完整精度的原始坐标进行API请求，以获得更精确的地址信息
			const query: ReverseGeocodeRequest = {
				location: `${lat},${lng}`, // 保持原始完整精度
				get_poi: "1",
				poi_options: `policy=2;orderby=_distance`,
			};

			const geocodeInfo = await apiClient.get<ReverseGeocodeResponse>(
				"/address/reverse-geocode",
				{
					params: query,
				},
			);

			storage.set(CACHE_KEY, JSON.stringify(geocodeInfo.data.result));
			storage.set(CACHE_TIMESTAMP_KEY, now);
			return geocodeInfo.data.result;
		},
		meta: {
			errorMessage: "地址数据获取失败",
		},
	});
};

export function useLocationDetail() {
	const [Location, setLocation] = useState<EnhancedLocationData>();
	const { startWatching, stopWatching } = useHighAccuracyLocation();

	// 获取完整精度的坐标用于API请求
	const fullPrecisionLat = Location?.gcj02?.latitude;
	const fullPrecisionLng = Location?.gcj02?.longitude;

	const reverseGeocodeData = useReverseGeocode({
		lat: fullPrecisionLat,
		lng: fullPrecisionLng,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		startWatching((location) => {
			setLocation(location);
		});
		return () => {
			stopWatching();
		};
	}, []);

	return reverseGeocodeData;
}

/**
 * 地址建议查询页面数据类型
 */
interface AddressSuggestionPageData {
	data: SuggestionData[];
	count: number;
	pageParam: number;
	hasMore: boolean;
}

/**
 * 地址建议 - 无限查询版本 - Suspense版本
 * @description 遵循腾讯地图接口(https://lbs.qq.com/service/webService/webServiceGuide/search/webServiceSuggestion)
 *
 * 支持分页查询，用于实现无限滚动效果，支持Suspense
 */
export const useAddressSuggestionInfiniteSuspense = ({
	keyword,
	lat,
	lng,
	city,
}: {
	keyword?: string;
	lat?: number;
	lng?: number;
	city?: string;
}) => {
	// 标准化坐标用于查询key的一致性
	const normalizedLat = lat ? parseFloat(lat.toFixed(3)) : undefined;
	const normalizedLng = lng ? parseFloat(lng.toFixed(3)) : undefined;

	return useSuspenseInfiniteQuery({
		queryKey: [
			"address-suggestion-infinite-suspense",
			keyword,
			city,
			normalizedLat,
			normalizedLng,
		],
		queryFn: async ({ pageParam = 1 }): Promise<AddressSuggestionPageData> => {
			// 如果没有关键词，返回空结果
			if (!keyword || keyword.trim() === "") {
				return {
					data: [],
					count: 0,
					pageParam,
					hasMore: false,
				};
			}

			// 使用完整精度坐标进行API请求，获得更精确的搜索结果
			const query: SuggestionRequest = {
				keyword: keyword!,
				region_fix: "1",
				page_size: "10", // 每页10条
				page_index: pageParam.toString(),
				policy: "1",
			};

			if (city) {
				query.region = city;
			}

			if (normalizedLat && normalizedLng) {
				query.location = `${lat},${lng}`;
			}

			const response = await apiClient.get<SuggestionResponse>(
				"/address/suggestion",
				{
					params: query,
				},
			);

			return {
				data: response.data.data || [],
				count: response.data.count || 0,
				pageParam,
				hasMore:
					response.data.data &&
					response.data.data.length === 10 &&
					pageParam * 10 < response.data.count,
			};
		},
		getNextPageParam: (lastPage: AddressSuggestionPageData) => {
			// 如果有更多数据，返回下一页的页码
			return lastPage.hasMore ? lastPage.pageParam + 1 : undefined;
		},
		initialPageParam: 1,
		meta: {
			errorMessage: "搜索建议获取失败",
		},
	});
};

/**
 * 获取城市对应的上级城市和省份信息
 */
export const useCityParentInfo = (city: string | undefined | null) =>
	useQuery({
		queryKey: ["city-parent-info", city],
		queryFn: async () => {
			const response = await apiClient.get<ParentInfo>(
				"/address/cityParentInfo",
				{
					params: { address: city },
				},
			);
			return response.data;
		},
		enabled: !!city,
		meta: {
			errorMessage: "城市信息获取失败",
		},
	});

/** 搜索城市 - Suspense */
export const useCitySearchSuspense = (keyword: string | undefined | null) =>
	useSuspenseQuery({
		queryKey: ["city-search", keyword],
		queryFn: async () => {
			if (!keyword || keyword.trim() === "") {
				return [];
			}
			const response = await apiClient.get<DistrictSearchResponse["result"]>(
				"/address/districtSearch",
				{
					params: { keyword },
				},
			);
			return response.data;
		},
		meta: {
			errorMessage: "城市搜索失败",
		},
	});

/**
 * 获取用户所有的收货地址
 */
export const useUserAddresses = () =>
	useSuspenseQuery({
		queryKey: ["user-addresses"],
		queryFn: async () => {
			const response = await apiClient.get<UserAddresses[]>("/address");
			return response.data;
		},
	});

/**
 * 创建用户的收货地址
 */
export const UseCreateAddress = () =>
	useMutation({
		mutationFn: (newAddress: CreateUserAddress) => {
			return apiClient.post<UserAddresses>("/address/create", newAddress);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["user-addresses"],
			});
		},
		scope: {
			id: "createAddress",
		},
	});

/**
 * 更新用户的收货地址
 */

export const UseUpdateAddress = () =>
	useMutation({
		mutationFn: (newAddress: UpdateUserAddress) => {
			return apiClient.post<UserAddresses>("/address/update", newAddress);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["user-addresses"],
			});
		},
		scope: {
			id: "updateAddress",
		},
	});

/**
 * 删除用户的收货地址
 */
export const useDeleteAddress = () =>
	useMutation({
		mutationFn: (addressId: string) => {
			return apiClient.delete<UserAddresses>(`/address/${addressId}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["user-addresses"],
			});
		},
		scope: {
			id: "deleteAddress",
		},
	});
