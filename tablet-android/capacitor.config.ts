import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orderitup.tabletpos',
  appName: 'Order It Up POS',
  webDir: '../frontend/out',
  server: {
    androidScheme: 'https',
    // Capacitor serves index.html for extension-less paths, so the packaged app
    // must target the exported tablet route explicitly. Without this the WebView
    // opens the marketing landing page instead of the POS terminal.
    appStartPath: '/tablet-pos/index.html',
  },
};

export default config;
