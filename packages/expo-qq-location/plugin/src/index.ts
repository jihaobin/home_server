import {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  ConfigPlugin,
} from 'expo/config-plugins';

interface QqLocationPluginProps {
  apiKey: string;
  iosApiKey?: string;
}

const withQqLocationApiKey: ConfigPlugin<QqLocationPluginProps> = (config, { apiKey, iosApiKey }) => {
  // Configure Android
  config = withAndroidManifest(config, config => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    // Add Tencent Map API key
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
        'TencentMapSDK',
      apiKey
    );

    // Add required permissions for location
    const permissions = [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.FOREGROUND_SERVICE',
    ];

    for (const permission of permissions) {
      AndroidConfig.Permissions.addPermission(config.modResults, permission);
    }

    // Add foreground service for background location (if needed)
    const service = {
      $: {
        'android:name': 'com.tencent.map.geolocation.s',
        'android:foregroundServiceType': 'location',
      },
    };

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // Check if service already exists
    const existingService = mainApplication.service.find(
      (s: any) => s.$['android:name'] === 'com.tencent.map.geolocation.s'
    );

    if (!existingService) {
      mainApplication.service.push(service);
    }

    return config;
  });

  // Configure iOS (if iOS API key is provided)
  if (iosApiKey) {
    config = withInfoPlist(config, config => {
      config.modResults['TENCENT_MAP_API_KEY'] = iosApiKey;
      return config;
    });
  }

  return config;
};

export default withQqLocationApiKey;
