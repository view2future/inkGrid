export const INKGRID_PROD_BASE_URL = 'https://www.inkgrid.art';

function isLocalHost(hostname: string) {
  const h = String(hostname || '').trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

export function getShareBaseUrls(): { prod: string; local?: string } {
  let origin = '';
  let hostname = '';
  try {
    origin = window.location.origin;
    hostname = window.location.hostname;
  } catch {
    // ignore
  }

  const local = origin && hostname && isLocalHost(hostname) ? origin : undefined;
  return { prod: INKGRID_PROD_BASE_URL, local };
}
