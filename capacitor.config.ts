import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.destiniq.app',
  appName: 'DestinIQ',
  webDir: 'www',
  server: {
    url: 'https://destiniq.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    App: {
      launchUrl: 'com.destiniq.app://',
    },
  },
};

export default config;