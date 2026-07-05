import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.destiniq.app',
  appName: 'DestinIQ',
  webDir: 'out',  // Next.js static export directory (next export → out/)
  server: {
    // Live update approach — app loads from your Vercel site
    // This means every update to your site = instant update in the app
    // No need to re-submit to Play Store for content changes
    url: 'https://www.destiniq.app',
    cleartext: false,         // HTTPS only — more secure
    androidScheme: 'https',
    allowNavigation: [
      'destiniq.vercel.app',
      'destiniq.app',
      'www.destiniq.app',
      '*.supabase.co',        // Supabase auth + database
      'js.paystack.co',       // Paystack payment script
      'api.anthropic.com',    // Claude AI (via your /api/analyze route)
      '*.paystack.com',       // Paystack checkout
    ],
  },
  plugins: {
    App: {
      launchUrl: 'com.destiniq.app://',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,   // We hide it manually after app loads
      backgroundColor: '#0a0800',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0800',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      // Uses the app icon (DQ logo) by default — no custom smallIcon needed
    },
    Camera: {
      // No special config needed
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'destiniq.keystore',
      keystoreAlias: 'destiniq',
    },
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set to true during development
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,  // App Bound Domains for App Store
  },
};

export default config;