import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

function getVisibleNow() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

export function useAppActive() {
  const [isActive, setIsActive] = useState(getVisibleNow());

  useEffect(() => {
    const onVis = () => setIsActive(getVisibleNow());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    (async () => {
      handle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        setIsActive(Boolean(isActive));
      });
    })();
    return () => {
      if (handle) void handle.remove();
    };
  }, []);

  return isActive;
}
