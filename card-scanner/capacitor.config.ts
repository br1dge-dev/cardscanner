import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cardscanner.app',
  appName: 'Card Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
