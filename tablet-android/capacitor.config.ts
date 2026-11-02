import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orderitup.tabletpos',
  appName: 'Order It Up POS',
  webDir: '../frontend/out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
