import type { InkFlowLaunch, InkFlowMobilePage } from './inkflow';

const DEFAULT_PAGE: InkFlowMobilePage = 'hub';

function clampIndex(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseIntOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function firstChar(value: string | null): string | undefined {
  if (!value) return undefined;
  const t = String(value).trim();
  if (!t) return undefined;
  return Array.from(t)[0] || undefined;
}

function coercePage(value: string | null): InkFlowMobilePage {
  if (!value) return DEFAULT_PAGE;
  const v = value.toLowerCase();
  if (v === 'hub' || v === 'home') return 'hub';
  if (v === 'characters' || v === 'chars' || v === 'char') return 'characters';
  if (v === 'steles' || v === 'stele') return 'steles';
  if (v === 'posters' || v === 'poster') return 'posters';
  if (v === 'study' || v === 'learn') return 'study';
  if (v === 'study_deck' || v === 'deck') return 'study_deck';
  return DEFAULT_PAGE;
}

// Supported forms:
// - inkgrid://inkflow?page=characters&index=12
// - inkgrid://inkflow/characters?index=12
// - https://.../?inkflow=1&page=characters&index=12 (for browser debugging)
export function parseInkgridDeepLink(url: string): Omit<InkFlowLaunch, 'key'> | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const isInkgridScheme = u.protocol === 'inkgrid:';
  const isInkflowBrowserFlag = u.searchParams.get('inkflow') === '1';
  const isInkflowHost = u.hostname === 'inkflow';
  if (!isInkgridScheme && !isInkflowBrowserFlag) return null;
  if (isInkgridScheme && !isInkflowHost) return null;

  const pathParts = u.pathname.split('/').filter(Boolean);
  const pageFromPath = pathParts[0] ?? null;
  const page = coercePage(u.searchParams.get('page') ?? pageFromPath);

  const index = parseIntOrUndefined(u.searchParams.get('index'));
  const steleIndex = parseIntOrUndefined(u.searchParams.get('steleIndex'));
  const steleSection = parseIntOrUndefined(u.searchParams.get('steleSection'));
  const steleId = u.searchParams.get('steleId') || u.searchParams.get('id') || undefined;
  const cardId = u.searchParams.get('card') || u.searchParams.get('cardId') || undefined;
  const char = firstChar(u.searchParams.get('char'));
  const glyphId = parseIntOrUndefined(u.searchParams.get('glyphId'));
  const point = parseIntOrUndefined(u.searchParams.get('point'));

  // Normalize to 0-based indexes.
  const normalizedIndex = typeof index === 'number' ? clampIndex(index, 0, 999999) : undefined;
  const normalizedSteleIndex = typeof steleIndex === 'number' ? clampIndex(steleIndex, 0, 999999) : undefined;
  const normalizedSteleSection = typeof steleSection === 'number' ? clampIndex(steleSection, 0, 999999) : undefined;

  return {
    page,
    index: normalizedIndex,
    steleId,
    steleIndex: normalizedSteleIndex,
    steleSection: normalizedSteleSection,
    cardId,
    char,
    glyphId,
    point,
  };
}
