import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'flowpos_alerts';
let channelCreated = false; // Guard: create channel only once per session

/**
 * تهيئة قناة إشعارات أندرويد (ضرورية لنظام Android 8+)
 * يتم الاستدعاء مرة واحدة فقط لتجنب تكرار إنشاء القناة
 */
export async function initNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'تنبيهات FlowPOS Pro',
      description: 'إشعارات المبيعات والديون ونفاذ المخزون',
      importance: 5, // High priority (heads-up notification banner)
      visibility: 1, // Public on lockscreen
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#ff6600',
    });
    channelCreated = true;
  } catch (e) {
    console.warn('[Notifications] Failed to create channel:', e);
  }
}

/**
 * التحقق من حالة إذن الإشعارات (سواء أصلي على أندرويد أو ويب)
 */
export async function checkNotificationPermissionNative(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display;
    } catch (e) {
      console.warn('[Notifications] Check permission failed:', e);
      return 'prompt';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission as 'granted' | 'denied' | 'prompt';
  }

  return 'prompt';
}

/**
 * طلب إذن الإشعارات بشكل رسمي من النظام (يُظهر نافذة الإذن الرسمية لأندرويد 13+)
 */
export async function requestNotificationPermissionNative(): Promise<'granted' | 'denied'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannel();
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted' ? 'granted' : 'denied';
    } catch (e) {
      console.warn('[Notifications] Native request failed:', e);
      return 'denied';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const res = await Notification.requestPermission();
      return res === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  return 'denied';
}

/**
 * إرسال إشعار فوري يظهر في شريط إشعارات الهاتف (Android Notification Shade)
 *
 * KEY FIX: لا نستخدم schedule.at هنا — الجدولة عبر AlarmManager تسبب تأخير
 * 3-4 ثوانٍ بسبب آليات توفير الطاقة في أندرويد.
 * بحذف schedule يتم توجيه الإشعار مباشرة إلى NotificationManager.notify()
 * فيظهر فورياً في أقل من 50 ميلي ثانية.
 */
export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannel();
      const notifId = Math.floor(Math.random() * 1000000) + 1;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher',
            // No 'schedule' field here → fires instantly via NotificationManager (not AlarmManager)
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn('[Notifications] Native schedule failed:', e);
    }
  }

  // Web fallback
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/app-icon.png',
      });
      return true;
    } catch (e) {
      console.warn('[Notifications] Web notification failed:', e);
    }
  }

  return false;
}
