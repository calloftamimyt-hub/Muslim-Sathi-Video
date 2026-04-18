import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.muslimsathi.app',
  appName: 'MuslimSathi',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'muslim-sathi-1.onrender.com',
      'api.telegram.org',
      'ais-dev-47x2krhcb7hnr5enczfekd-107332946958.asia-east1.run.app',
      'muslim-sathi-video.onrender.com'
    ]
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-4288324218526190~7221934995',
    }
  }
};

export default config;
