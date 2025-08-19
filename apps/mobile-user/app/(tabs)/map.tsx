import { useState } from "react";
import { Text, View, StyleSheet, Button, Alert, ScrollView } from "react-native";
import TencentMap from "@/components/TencentMap";
import {
  useHighAccuracyLocation,
  EnhancedLocationData
} from "@/lib/location-utils";
import { apiClient } from "@/lib/http-client";
import { useLocationDetail } from "@/hooks/api/address";

async function getDetailedAddress(lat: number, lng: number) {
    try {
        const response = await apiClient.get(
            `/address/detailed-reverse-geocode`,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                query: {
                    location: `${lat},${lng}`,
                    poi_options:
                        "address_format=short;policy=2;orderby=_distance",
                },
            },
        );
        console.log(response);
        return response;
    } catch (error) {
        console.error("详细地址解析失败:", error);
        throw error;
    }
}

export default function MapScreen() {
    const [currentLocation, setCurrentLocation] = useState<EnhancedLocationData | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState<boolean>(false);
    const [addressInfo, setAddressInfo] = useState<string>("未获取地址信息");

    const {data: locationData} = useLocationDetail()

    const { getCurrentPosition, startWatching, stopWatching } = useHighAccuracyLocation();

    const handleLocationUpdate = (location: EnhancedLocationData) => {
        setCurrentLocation(location);
        console.log('位置更新:', {
            原始坐标: { lat: location.latitude, lng: location.longitude },
            火星坐标: location.gcj02,
            百度坐标: location.bd09,
            精度: location.accuracy,
            提供商: location.provider
        });
    };

    const handleMapLocationSelect = (data: any) => {
        console.log('地图选点:', data);
        Alert.alert(
            '位置选择',
            `经度: ${data.longitude.toFixed(6)}\n纬度: ${data.latitude.toFixed(6)}`,
            [{ text: '确定' }]
        );
    };

    const getCurrentLocationManually = async () => {
        try {
            setErrorMsg(null);
            const location = await getCurrentPosition({
                accuracy: 6, // BestForNavigation
                timeout: 15000,
                maximumAge: 5000,
            });

            setCurrentLocation(location);

            // 使用火星坐标系获取地址信息（适合中国地区）
            if (location.gcj02) {
                try {
                    const address = await getDetailedAddress(
                        location.gcj02.latitude,
                        location.gcj02.longitude
                    );
                    setAddressInfo(JSON.stringify(address, null, 2));
                } catch (error) {
                    setAddressInfo("地址解析失败");
                }
            }
        } catch (error) {
            console.error('获取位置失败:', error);
            setErrorMsg('获取位置失败: ' + (error as Error).message);
        }
    };

    const toggleLocationTracking = () => {
        if (isTracking) {
            stopWatching();
            setIsTracking(false);
        } else {
            startWatching((location) => {
                handleLocationUpdate(location);
            }, {
                accuracy: 6,
                timeInterval: 2000, // 2秒更新一次
                distanceInterval: 5, // 移动5米更新
            });
            setIsTracking(true);
        }
    };

    const getLocationAccuracyLevel = (accuracy?: number): string => {
        if (!accuracy) return "未知";
        if (accuracy <= 5) return "极高精度";
        if (accuracy <= 20) return "高精度";
        if (accuracy <= 100) return "中等精度";
        return "低精度";
    };

    const getLocationDescription = (location: EnhancedLocationData): string => {
        const parts = [
            `原始坐标 (WGS84): ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
            `火星坐标 (GCJ02): ${location.gcj02?.latitude.toFixed(6)}, ${location.gcj02?.longitude.toFixed(6)}`,
            `精度: ±${location.accuracy?.toFixed(1) || 'N/A'}m (${getLocationAccuracyLevel(location.accuracy)})`,
            `定位源: ${location.provider || '未知'}`,
        ];

        if (location.speed && location.speed > 0) {
            parts.push(`速度: ${(location.speed * 3.6).toFixed(1)} km/h`);
        }

        if (location.altitude) {
            parts.push(`海拔: ${location.altitude.toFixed(1)}m`);
        }

        return parts.join('\n');
    };

    return (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                <TencentMap
                    onLocationUpdate={handleLocationUpdate}
                    onLocationSelect={handleMapLocationSelect}
                    showCurrentLocation={true}
                    enableLocationPicker={true}
                />
            </View>

            <View style={styles.infoContainer}>
                <View style={styles.buttonContainer}>
                    <Button
                        title="获取当前位置"
                        onPress={getCurrentLocationManually}
                        color="#1976D2"
                    />
                    <Button
                        title={isTracking ? "停止跟踪" : "开始位置跟踪"}
                        onPress={toggleLocationTracking}
                        color={isTracking ? "#F44336" : "#4CAF50"}
                    />
                </View>

                {errorMsg && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                )}

                <Text>{JSON.stringify(locationData)}</Text>

                {currentLocation && (
                    <ScrollView style={styles.locationContainer}>
                        <Text style={styles.locationTitle}>位置信息:</Text>
                        <Text style={styles.locationText}>
                            {getLocationDescription(currentLocation)}
                        </Text>

                        {addressInfo && addressInfo !== "未获取地址信息" && (
                            <View style={styles.addressContainer}>
                                <Text style={styles.addressTitle}>地址信息:</Text>
                                <Text style={styles.addressText}>{addressInfo}</Text>
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    mapContainer: {
        flex: 2,
        margin: 10,
        borderRadius: 10,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    infoContainer: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 15,
    },
    errorContainer: {
        backgroundColor: '#ffebee',
        borderColor: '#f44336',
        borderWidth: 1,
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
    },
    locationContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        maxHeight: 300,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976D2',
        marginBottom: 8,
    },
    locationText: {
        fontSize: 12,
        color: '#333',
        lineHeight: 18,
        fontFamily: 'monospace',
    },
    addressContainer: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    addressTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 5,
    },
    addressText: {
        fontSize: 11,
        color: '#666',
        lineHeight: 16,
    },
});
