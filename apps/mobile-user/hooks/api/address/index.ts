import { apiClient } from "@/lib/http-client";
import { EnhancedLocationData, useHighAccuracyLocation } from "@/lib/location-utils";
import { queryClient } from "@/lib/query-client";
import { AddressQuery, ChinaCity, CreateUserAddress, ReverseGeocodeRequest, ReverseGeocodeResponse, SuggestionRequest, SuggestionResponse, UpdateUserAddress, UserAddresses, } from "@repo/types";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { MMKV } from 'react-native-mmkv'

export const storage = new MMKV()

/**
 * 缓存管理工具
 */
export const cacheUtils = {
    /**
     * 清理所有地理编码缓存
     */
    clearAllGeoCache: () => {
        const allKeys = storage.getAllKeys();
        allKeys.forEach(key => {
            if (key.startsWith('reverse-geocode-')) {
                storage.delete(key);
            }
        });
        console.log('已清理所有地理编码缓存');
    },

    /**
     * 获取缓存统计信息
     */
    getCacheStats: () => {
        const allKeys = storage.getAllKeys();
        const geoKeys = allKeys.filter(key => key.startsWith('reverse-geocode-'));
        const dataKeys = geoKeys.filter(key => !key.endsWith('-timestamp'));
        const timestampKeys = geoKeys.filter(key => key.endsWith('-timestamp'));

        return {
            totalKeys: allKeys.length,
            geoDataKeys: dataKeys.length,
            geoTimestampKeys: timestampKeys.length,
            allGeoKeys: geoKeys.length
        };
    }
};

/**
 * 标准化经纬度坐标，用于缓存key
 * @param lat 纬度
 * @param lng 经度
 * @param precision 精度位数，默认3位小数（约110米精度）
 * @returns 标准化的坐标字符串
 */
const normalizeCoordinates = (lat: number, lng: number, precision: number = 3): string => {
    const normalizedLat = parseFloat(lat.toFixed(precision));
    const normalizedLng = parseFloat(lng.toFixed(precision));
    return `${normalizedLat},${normalizedLng}`;
}

/**
 * 清理过期的地理编码缓存
 */
const clearExpiredGeoCache = () => {
    const CACHE_DURATION = 1 * 24 * 60 * 60 * 1000; // 1天
    const now = Date.now();
    const allKeys = storage.getAllKeys();

    allKeys.forEach(key => {
        if (key.startsWith('reverse-geocode-') && key.endsWith('-timestamp')) {
            const cachedTime = storage.getNumber(key);
            if (cachedTime && (now - cachedTime >= CACHE_DURATION)) {
                // 删除过期的缓存数据和时间戳
                const dataKey = key.replace('-timestamp', '');
                storage.delete(dataKey);
                storage.delete(key);
            }
        }
    });
}

/**
 * 获取中国城市列表
 */
export const useChinaCity = (filter: AddressQuery) => useSuspenseQuery({
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
        if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
            return JSON.parse(cachedData) as ChinaCity[];
        }

        const response = await apiClient.get<ChinaCity[]>("/address/all", {
            query: Object.entries(filter).map(([key, value]) => ({
                name: key,
                value
            }))
        })

        // 缓存新数据时保存时间戳
        storage.set(CACHE_KEY, JSON.stringify(response.data));
        storage.set(CACHE_TIMESTAMP_KEY, now);

        return response.data
    },
    staleTime: 30 * 60 * 1000, // 30分钟内认为数据是新鲜的，不会重新获取
    gcTime: 60 * 60 * 1000, // 1小时的垃圾回收时间，保持缓存更久
    refetchOnWindowFocus: false, // 窗口重新聚焦时不自动重新获取
    refetchOnMount: false, // 组件重新挂载时不自动重新获取
})

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
const useReverseGeocode = ({lat, lng}: {lat?: number, lng?: number}) => {
    // 标准化坐标用于查询key和缓存key的一致性
    const normalizedLat = lat ? parseFloat(lat.toFixed(3)) : undefined;
    const normalizedLng = lng ? parseFloat(lng.toFixed(3)) : undefined;

    return useSuspenseQuery({
        queryKey: ["reverse-geocode", normalizedLat, normalizedLng],
        queryFn: async () => {
            if(!lat || !lng ) {
                return [];
            }

            // 定期清理过期缓存（可以考虑使用更智能的触发机制）
            if (Math.random() < 0.1) { // 10%的概率触发清理
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
            if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
                return JSON.parse(cachedData) as ReverseGeocodeResponse["result"];
            }

            // 使用完整精度的原始坐标进行API请求，以获得更精确的地址信息
            const query: ReverseGeocodeRequest = {
                location: `${lat},${lng}`, // 保持原始完整精度
                get_poi: "1",
                poi_options: `policy=2;orderby=_distance`
            }

            const geocodeInfo = await apiClient.get<ReverseGeocodeResponse>("/address/reverse-geocode", {
                params: query
            });

            storage.set(CACHE_KEY, JSON.stringify(geocodeInfo.data.result));
            storage.set(CACHE_TIMESTAMP_KEY, now);
            return geocodeInfo.data.result;
        },
    });
};

export function useLocationDetail() {
    const [Location,setLocation] = useState<EnhancedLocationData>()
    const { startWatching, stopWatching } = useHighAccuracyLocation();

    // 获取完整精度的坐标用于API请求
    const fullPrecisionLat = Location?.gcj02?.latitude;
    const fullPrecisionLng = Location?.gcj02?.longitude;

    const reverseGeocodeData = useReverseGeocode({
        lat: fullPrecisionLat,
        lng: fullPrecisionLng
    });

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
 * 地址建议
 * @description 遵循腾讯地图接口(https://lbs.qq.com/service/webService/webServiceGuide/search/webServiceSuggestion)
 *
 * 查询策略：
 * - queryKey使用标准化坐标（3位小数）确保缓存一致性
 * - API请求使用完整精度坐标，获得更精确的搜索结果
 */
const useAddressSuggestion = (keyword: string, city: string,{lat,lng}: {lat: number, lng: number}) => {
    // 标准化坐标用于查询key的一致性
    const normalizedLat = parseFloat(lat.toFixed(3));
    const normalizedLng = parseFloat(lng.toFixed(3));

    return useQuery({
        queryKey: ["address-suggestion", keyword, city, normalizedLat, normalizedLng],
        queryFn: async () => {
            if(!keyword || !lat || !lng || !city) {
                return [];
            }

            // 使用完整精度坐标进行API请求，获得更精确的搜索结果
            const query: SuggestionRequest = {
                keyword,
                region: city,
                region_fix: "1",
                page_size: "20",
                policy: "1",
                location:`${lat},${lng}` // 保持原始完整精度
            }

            const response = await apiClient.get<SuggestionResponse>("/address/suggestion", {
                params: query
            });
            return response.data;
        },
        meta: {
            errorMessage: "搜索建议获取失败"
        }
    });

};

export const useAddressTip = (keyword: string) => {
    const locationDetail = useLocationDetail();

    // 获取位置数据，如果不可用则使用默认值
    const hasValidData = locationDetail.data &&
        !Array.isArray(locationDetail.data) &&
        locationDetail.data.address_component &&
        locationDetail.data.ad_info;

    const city = hasValidData ? (locationDetail.data as ReverseGeocodeResponse["result"]).address_component.district || "" : "";
    const lat = hasValidData ? (locationDetail.data as ReverseGeocodeResponse["result"]).ad_info.location.lat : 0;
    const lng = hasValidData ? (locationDetail.data as ReverseGeocodeResponse["result"]).ad_info.location.lng : 0;

    // 始终调用hook，但在数据不可用时传递空参数
    const addressSuggestion = useAddressSuggestion(
        hasValidData ? keyword : "", // 如果位置数据不可用，传递空字符串
        city,
        { lat, lng }
    );

    // 如果位置数据不可用，返回空结果
    if (!hasValidData) {
        return { data: [], isLoading: false, error: null };
    }

    return addressSuggestion;
};

/**
 * 获取用户所有的收货地址
 */
export const useUserAddresses = () => useSuspenseQuery({
    queryKey: ["user-addresses"],
    queryFn: async () => {
        const response = await apiClient.get<UserAddresses>("/address");
        return response.data;
    },
});

/**
 * 创建用户的收货地址
 */
export const UseCreateAddress = () => useMutation({
    mutationFn: (newAddress: CreateUserAddress) =>{
        return apiClient.post<UserAddresses>("/address/create", newAddress);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ["user-addresses"]
        })
    },
    scope: {
        id: "createAddress"
    }
})

export const UseUpdateAddress = () => useMutation({
    mutationFn: (newAddress: UpdateUserAddress) =>{
        return apiClient.post<UserAddresses>("/address/update", newAddress);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ["user-addresses"]
        })
    },
    scope: {
        id: "updateAddress"
    }
})

export const UseDeleteAddress = () => useMutation({
    mutationFn: (addressId: string) =>{
        return apiClient.delete<UserAddresses>(`/address/${addressId}`);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ["user-addresses"]
        })
    },
    scope: {
        id: "deleteAddress"
    }
})