import { useEffect } from 'react';
import { messaging } from '../lib/firebase';
import { onMessage } from 'firebase/messaging';
import { useNotifications } from '../hooks/useNotifications';
import { Capacitor } from '@capacitor/core';

export function NotificationManager() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    // 1. Handle Web Messaging (FCM)
    let unsubscribeWeb: (() => void) | undefined;
    const setupWebMessaging = async () => {
      if (Capacitor.getPlatform() !== 'web') return;
      try {
        const msg = await messaging();
        if (msg) {
          unsubscribeWeb = onMessage(msg, (payload) => {
            console.log('Received foreground message ', payload);
            
            if (payload.notification) {
              addNotification({
                id: payload.messageId, // Use message ID to prevent duplicates
                title: payload.notification.title || 'New Notification',
                body: payload.notification.body || '',
                data: payload.data
              });
            }
          });
        }
      } catch (error) {
        console.error('Error setting up messaging:', error);
      }
    };

    // 2. Handle Native Push Notifications (Android/iOS)
    let pushListener: any;
    let actionListener: any;
    const setupNativePush = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // When notification is received in the foreground
        pushListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ', notification);
          addNotification({
            id: notification.id,
            title: notification.title || 'New Notification',
            body: notification.body || '',
            data: notification.data,
            timestamp: Date.now()
          });
        });

        // When user taps on the notification
        actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action performed: ', action);
          const notification = action.notification;
          addNotification({
            id: notification.id,
            title: notification.title || 'Notification Tapped',
            body: notification.body || '',
            data: notification.data,
            timestamp: Date.now(),
            read: true // Consider read if they tapped it
          });
          
          // Auto-navigate to notifications page if tapped
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'notifications' }));
        });
      } catch (error) {
        console.warn('PushNotifications not available or failed to setup:', error);
      }
    };

    setupWebMessaging();
    setupNativePush();

    return () => {
      if (unsubscribeWeb) {
        unsubscribeWeb();
      }
      if (pushListener) pushListener.remove();
      if (actionListener) actionListener.remove();
    };
  }, [addNotification]);

  return null;
}
