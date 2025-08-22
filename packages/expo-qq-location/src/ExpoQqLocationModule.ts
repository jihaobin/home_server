import { NativeModule, requireNativeModule } from 'expo';

import { ExpoQqLocationModuleEvents } from './ExpoQqLocation.types';

declare class ExpoQqLocationModule extends NativeModule<ExpoQqLocationModuleEvents> {
  getTheme: () => string;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoQqLocationModule>('ExpoQqLocation');
