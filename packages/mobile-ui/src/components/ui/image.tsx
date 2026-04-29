import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { cssInterop } from 'nativewind';

// Enable NativeWind className/style interop for expo-image.
cssInterop(ExpoImage, {
  className: 'style',
});

const Image = ExpoImage;

export { Image };
export type { ImageProps };
