import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type InkgridNotificationOptions = {
  title: string;
  subtitle?: string;
  deepLinkUrl?: string;
  nextDeepLinkUrl?: string;
  ongoing?: boolean;
  progress?: number;
  progressMax?: number;
};

type InkgridNotificationsPlugin = {
  showInkFlowNotification(options: InkgridNotificationOptions): Promise<void>;
  cancelInkFlowNotification(): Promise<void>;
};

const InkgridNotifications = registerPlugin<InkgridNotificationsPlugin>('InkgridNotifications');

async function ensurePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;
  const res = await LocalNotifications.requestPermissions();
  return res.display === 'granted';
}

export async function showInkFlowNotification(options: InkgridNotificationOptions): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;
  const ok = await ensurePermissions();
  if (!ok) return;
  try {
    await InkgridNotifications.showInkFlowNotification(options);
  } catch {
    // If the native plugin is missing, fail silently.
  }
}

export async function cancelInkFlowNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await InkgridNotifications.cancelInkFlowNotification();
  } catch {
    // ignore
  }
}
