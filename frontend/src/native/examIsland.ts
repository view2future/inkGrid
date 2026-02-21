import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

type ExamIslandPlugin = {
  start(options: {
    title: string;
    subtitle: string;
    deepLinkUrl: string;
    ongoing?: boolean;
    progress?: number;
    progressMax?: number;
    startedAt?: number;
  }): Promise<void>;
  update(options: {
    title: string;
    subtitle: string;
    deepLinkUrl: string;
    ongoing?: boolean;
    progress?: number;
    progressMax?: number;
    startedAt?: number;
  }): Promise<void>;
  stop(): Promise<void>;
};

const plugin = registerPlugin<ExamIslandPlugin>('InkgridExamIsland');

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function ensureExamIslandPermission() {
  if (!isNativeAndroid()) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    // ignore
  }
}

export async function startExamIsland(payload: {
  title: string;
  subtitle: string;
  deepLinkUrl: string;
  progress?: number;
  progressMax?: number;
  startedAt?: number;
}) {
  if (!isNativeAndroid()) return;
  try {
    await plugin.start({ ...payload, ongoing: true });
  } catch {
    // ignore
  }
}

export async function updateExamIsland(payload: {
  title: string;
  subtitle: string;
  deepLinkUrl: string;
  progress?: number;
  progressMax?: number;
  startedAt?: number;
}) {
  if (!isNativeAndroid()) return;
  try {
    await plugin.update({ ...payload, ongoing: true });
  } catch {
    // ignore
  }
}

export async function stopExamIsland() {
  if (!isNativeAndroid()) return;
  try {
    await plugin.stop();
  } catch {
    // ignore
  }
}
