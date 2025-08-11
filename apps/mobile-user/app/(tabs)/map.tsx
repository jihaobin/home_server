import { useState, useEffect } from "react";
import { Platform, Text, View, StyleSheet, Button } from "react-native";
import Map from "@/components/amap";

import * as Device from "expo-device";

import * as Location from "expo-location";
import { apiClient } from "@/lib/http-client";
import { LocationAccuracy } from "expo-location";

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

export default function App() {
    const [location, setLocation] = useState<Location.LocationObject | null>(
        null,
    );
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [text, setText] = useState<string>("Waiting...");

    useEffect(() => {
        async function getCurrentLocation() {
            if (Platform.OS === "android" && !Device.isDevice) {
                setErrorMsg(
                    "Oops, this will not work on Snack in an Android Emulator. Try it on your device!",
                );
                return;
            }
            let { status } = await Location.requestForegroundPermissionsAsync();
            await Location.enableNetworkProviderAsync();
            if (status !== "granted") {
                setErrorMsg("Permission to access location was denied");
                return;
            }

            const position = await Location.watchPositionAsync(
                {
                    accuracy: LocationAccuracy.Highest,
                },
                async (location) => {
                    if (location) {
                        const { latitude, longitude } = location.coords;
                        const locationInfo = await Location.reverseGeocodeAsync(
                            { latitude, longitude },
                        );
                        if (locationInfo.length > 0) {
                            console.log(
                                "Location Info:",
                                JSON.stringify(locationInfo),
                            );
                        }

                        if (errorMsg) {
                            setText(errorMsg);
                        } else if (location) {
                            setText(JSON.stringify(location));
                            console.log(location);
                        }
                    }
                    setLocation(location);
                    position.remove();
                },
            );
        }

        getCurrentLocation();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.paragraph}>{text}</Text>
            <Button
                title="获取位置信息"
                onPress={async () => {
                    if (location) {
                        const { latitude, longitude } = location.coords;
                        const address = await getDetailedAddress(
                            latitude,
                            longitude,
                        );
                        console.log("Detailed Address:", address);
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 50,
    },
    paragraph: {
        fontSize: 18,
        textAlign: "center",
    },
});
