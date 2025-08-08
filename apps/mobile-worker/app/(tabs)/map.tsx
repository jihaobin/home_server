import { useState, useEffect } from 'react';
import { Platform, Text, View, StyleSheet,Button } from 'react-native';
import { ofetch } from 'ofetch';

import * as Device from 'expo-device';

import * as Location from 'expo-location';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.112:5050';

async function getDetailedAddress(lat: number, lng: number) {
  try {
    const response = await ofetch(`${API_BASE_URL}/api/address/detailed-reverse-geocode`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      query: {
        location: `${lat},${lng}`,
        poi_options: 'address_format=short;policy=2;orderby=_distance'
      }
    });
    return response;
  } catch (error) {
    console.error('详细地址解析失败:', error);
    throw error;
  }
}

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentLocation() {
      if (Platform.OS === 'android' && !Device.isDevice) {
        setErrorMsg(
          'Oops, this will not work on Snack in an Android Emulator. Try it on your device!'
        );
        return;
      }
      let { status } = await Location.requestForegroundPermissionsAsync();
      await Location.enableNetworkProviderAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getLastKnownPositionAsync({});
      if (location) {
        const { latitude, longitude } = location.coords;
        const locationInfo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (locationInfo.length > 0) {
          console.log('Location Info:', JSON.stringify(locationInfo));
        }
      }
      setLocation(location);
    }

    getCurrentLocation();
  }, []);

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
    console.log(location)
  }

  return (
    <View style={styles.container}>
        <Text style={styles.paragraph}>{text}</Text>
        <Button title="获取位置信息" onPress={async () => {
          if (location) {
            const { latitude, longitude } = location.coords;
            const address = await getDetailedAddress(latitude, longitude);
            console.log('Detailed Address:', address);
          }
        }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
  },
});
