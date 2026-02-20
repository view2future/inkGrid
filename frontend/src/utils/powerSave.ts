import { Capacitor } from '@capacitor/core';

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

// Default-on power save for native Android WebView.
export function isPowerSaveEnabled() {
  return isNativeAndroid();
}

export function applyPowerSaveDataset(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) {
    root.dataset.powerSave = '1';
  } else {
    delete (root as any).dataset.powerSave;
  }
}
