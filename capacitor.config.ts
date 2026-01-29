import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xitchat.app',
  appName: 'XitChat',
  webDir: 'dist',
  server: {
    // This allows the app to fetch data safely
    androidScheme: 'http',
    // Allows connecting to http:// (non-secure) servers during development
    cleartext: true
  },
  plugins: {
    // Push Notifications is the ONLY plugin that uses config here
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
    // NOTE: Camera and Geolocation permissions must be set in 
    // AndroidManifest.xml and Info.plist, not here.
  }
};

export default config;