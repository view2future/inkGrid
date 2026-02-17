import { Capacitor } from '@capacitor/core';

type TrackProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: TrackProps }) => void;
  }
}

function isWebEnabled(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return String(import.meta.env.VITE_ANALYTICS || '').trim() === '1';
}

export function initWebAnalytics(): void {
  if (!isWebEnabled()) return;

  const provider = String(import.meta.env.VITE_ANALYTICS_PROVIDER || 'plausible').trim().toLowerCase();
  if (provider !== 'plausible') return;

  const domain = String(import.meta.env.VITE_PLAUSIBLE_DOMAIN || window.location.hostname || '').trim();
  if (!domain) return;

  const scriptUrl = String(import.meta.env.VITE_PLAUSIBLE_SCRIPT_URL || 'https://plausible.io/js/script.js').trim();
  if (!scriptUrl) return;

  if (document.querySelector('script[data-inkgrid-analytics="plausible"]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptUrl;
  script.setAttribute('data-domain', domain);
  script.setAttribute('data-inkgrid-analytics', 'plausible');
  document.head.appendChild(script);
}

export function track(eventName: string, props?: TrackProps): void {
  if (!isWebEnabled()) return;

  const provider = String(import.meta.env.VITE_ANALYTICS_PROVIDER || 'plausible').trim().toLowerCase();
  if (provider !== 'plausible') return;

  if (typeof window.plausible !== 'function') return;
  const name = String(eventName || '').trim();
  if (!name) return;

  try {
    window.plausible(name, props ? { props } : undefined);
  } catch {
    // ignore
  }
}
