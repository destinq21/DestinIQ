import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.destiniq.app',
  appName: 'DestinIQ',
  webDir: 'public',
  server: {
    url: 'https://destiniq.vercel.app',
    cleartext: true,
  },
  plugins: {
    App: {
      launchUrl: 'com.destiniq.app://',
    },
  },
};