import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Opens the system's default alarm creation screen on Android.
 * Falls back to the internal alarm list view on other platforms.
 * 
 * @param setActiveTab Function to change the active tab in the app
 */
export const openSystemAlarm = async (setActiveTab: (tab: string) => void) => {
  const isAndroid = Capacitor.getPlatform() === 'android' || /Android/i.test(navigator.userAgent);
  
  if (isAndroid) {
    try {
      // Android Intent URL for setting an alarm
      const intentUrl = 'intent:#Intent;action=android.intent.action.SET_ALARM;end';
      
      if (Capacitor.isNativePlatform()) {
        try {
          // Use App.openUrl if available, otherwise fallback
          if ((App as any).openUrl) {
            await (App as any).openUrl({ url: intentUrl });
          } else {
            window.location.href = intentUrl;
          }
        } catch (e) {
          window.location.href = intentUrl;
        }
      } else {
        window.location.href = intentUrl;
      }
    } catch (error) {
      console.error('Failed to open system alarm:', error);
      // Fallback if intent fails
      setActiveTab('alarm-list');
    }
  } else {
    // Fallback to internal alarm list for iOS or Web (non-Android)
    setActiveTab('alarm-list');
  }
};
