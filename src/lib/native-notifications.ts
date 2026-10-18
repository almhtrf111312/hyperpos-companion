import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotificationChannelType = 'critical' | 'transactions' | 'system';

export const NOTIFICATION_CHANNELS = {
  critical: {
    id: 'flowpos_critical',
    name: 'التنبيهات الهامة والمخزون',
    description: 'إشعارات نفاذ المخزون والديون المستحقة وأمان الحساب',
    importance: 5, // High priority (heads-up notification)
  },
  transactions: {
    id: 'flowpos_transactions',
    name: 'المبيعات والإقفال',
    description: 'ملخصات البيع الكبرى وإقفال ورديات الكاشير',
    importance: 4,
  },
  system: {
    id: 'flowpos_system',
    name: 'حالة النظام والنسخ الاحتياطي',
    description: 'تنبيهات فشل النسخ الاحتياطي ومشاكل الاتصال بالسحابة',
    importance: 3,
  },
} as const;

let channelsCreated = false;

// In-memory deduplication cache: prevent duplicate notifications within 30 seconds
const recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 30000;

function isDuplicate(title: string, body: string): boolean {
  const key = `${title.trim()}:${body.trim()}`;
  const now = Date.now();
  const lastSent = recentNotifications.get(key);

  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    return true;
  }

  recentNotifications.set(key, now);

  // Evict stale entries when map grows
  if (recentNotifications.size > 60) {
    for (const [k, timestamp] of recentNotifications.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentNotifications.delete(k);
      }
    }
  }

  return false;
}

/**
 * تهيئة قنوات إشعارات أندرويد (ضرورية لنظام Android 8+)
 * تنشئ قنوات مخصصة ذات أسماء وتوصيفات واضحة للمستخدم في إعدادات النظام
 */
export async function initNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelsCreated) return;
  try {
    for (const ch of Object.values(NOTIFICATION_CHANNELS)) {
      await LocalNotifications.createChannel({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        importance: ch.importance,
        visibility: 1, // Public on lockscreen
        sound: 'beep.wav',
        vibration: true,
        lights: true,
        lightColor: '#10b981',
      });
    }
    channelsCreated = true;
  } catch (e) {
    console.warn('[Notifications] Failed to create channels:', e);
  }
}

// Backward compatibility alias
export const initNotificationChannel = initNotificationChannels;

/**
 * التحقق من حالة إذن الإشعارات (سواء أصلي على أندرويد أو ويب)
 */
export async function checkNotificationPermissionNative(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted' || status.display === 'denied' ? status.display : 'prompt';
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
      await initNotificationChannels();
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
 * - للأمور المهمة فقط
 * - يمنع تكرار نفس الرسالة خلال 30 ثانية
 * - يوجه الإشعار للقناة المناسبة على أندرويد
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  channel: NotificationChannelType = 'critical'
): Promise<boolean> {
  // Deduplication guard
  if (isDuplicate(title, body)) {
    console.debug('[Notifications] Suppressed duplicate notification:', title);
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      const notifId = Math.floor(Math.random() * 1000000) + 1;
      const targetChannel = NOTIFICATION_CHANNELS[channel] || NOTIFICATION_CHANNELS.critical;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: targetChannel.id,
            smallIcon: 'ic_launcher',
            // No schedule date => immediate dispatch via NotificationManager
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
