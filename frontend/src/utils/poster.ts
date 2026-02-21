import QRCode from 'qrcode';

export type PosterTemplate = 'folio' | 'minimal' | 'night';
export type PosterKind = 'char' | 'stele';

export type RenderPosterOptions = {
  scale?: number;
  pixelRatio?: number;
};

export const INKGRID_QR_URL = 'https://www.inkgrid.art';
export const INKGRID_QR_LABEL = 'www.inkgrid.art';

const INKGRID_BRAND_CN = '墨阵';
const INKGRID_SLOGAN_CN = '墨香千載 · 筆鋒流轉';

let BRAND_LOGO_PROMISE: Promise<HTMLImageElement> | null = null;
function loadBrandLogo() {
  if (!BRAND_LOGO_PROMISE) BRAND_LOGO_PROMISE = loadImage('/assets/mo_ink.png');
  return BRAND_LOGO_PROMISE;
}

let LANTERN_1_PROMISE: Promise<HTMLImageElement> | null = null;
let LANTERN_2_PROMISE: Promise<HTMLImageElement> | null = null;
let LANTERN_3_PROMISE: Promise<HTMLImageElement> | null = null;

function loadLantern1() {
  if (!LANTERN_1_PROMISE) LANTERN_1_PROMISE = loadImage('/images/lantern-1.png');
  return LANTERN_1_PROMISE;
}

function loadLantern2() {
  if (!LANTERN_2_PROMISE) LANTERN_2_PROMISE = loadImage('/images/lantern-2.png');
  return LANTERN_2_PROMISE;
}

function loadLantern3() {
  if (!LANTERN_3_PROMISE) LANTERN_3_PROMISE = loadImage('/images/lantern-3.png');
  return LANTERN_3_PROMISE;
}

type PosterChar = {
  simplified?: string;
  pinyin?: string;
  meaning?: string;
  en_word?: string;
  en_meaning?: string;
  image: string;
  sourceTitle?: string;
  author?: string;
  dynasty?: string;
};

type PosterStele = {
  name: string;
  author: string;
  dynasty: string;
  script_type: string;
  year?: string;
  type?: string;
  location: string;
  total_chars: number;
  description?: string;
  content?: string;
};

type PosterInput =
  | { kind: 'char'; template: PosterTemplate; data: PosterChar }
  | { kind: 'stele'; template: PosterTemplate; data: PosterStele };

export type CuratedCollageInput = {
  title?: string;
  subtitle?: string;
  cards: Array<{
    simplified?: string;
    image: string;
  }>;
};

export type NewYearPosterInput = {
  id?: string;
  yearLabel?: string;
  dayLabel: string;
  caption: string;
  date?: string;
  lunarDateStr?: string;
  story?: string;
  glyph: {
    simplified?: string;
    image: string;
    index?: number;
    source?: string;
  };
};

const CANVAS_W = 1080;
const CANVAS_H = 1920;

// --- UTILS (Hoisted) ---

function loadImage(url: string, timeoutMs = 15000) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';

    let settled = false;
    let timer: number | null = null;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      img.onload = null;
      img.onerror = null;
    };

    const resolveOnce = (value: HTMLImageElement) => {
      if (settled) return;
      settled = true;
      clear();
      resolve(value);
    };

    const rejectOnce = (err: unknown) => {
      if (settled) return;
      settled = true;
      clear();
      reject(err);
    };

    img.onload = () => resolveOnce(img);
    img.onerror = () => rejectOnce(new Error(`Failed to load image: ${url}`));

    if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = window.setTimeout(() => {
        rejectOnce(new Error(`Timed out loading image: ${url}`));
      }, Math.floor(timeoutMs));
    }

    img.src = url;
  });
}

function dataUrlToBlob(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mimeMatch = header.match(/^data:([^;]+)/i);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const isBase64 = /;base64/i.test(header);
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    const toBlob = (canvas as any)?.toBlob as undefined | ((cb: (b: Blob | null) => void, type?: string) => void);
    let settled = false;
    let timer: number | null = null;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const resolveOnce = (blob: Blob) => {
      if (settled) return;
      settled = true;
      clear();
      resolve(blob);
    };

    const rejectOnce = (err: unknown) => {
      if (settled) return;
      settled = true;
      clear();
      reject(err);
    };

    const fallback = (primaryErr?: unknown) => {
      try {
        resolveOnce(dataUrlToBlob(canvas.toDataURL('image/png')));
      } catch (fallbackErr) {
        rejectOnce(primaryErr || fallbackErr);
      }
    };

    if (typeof toBlob !== 'function') {
      fallback(new Error('canvas.toBlob is not available'));
      return;
    }

    timer = window.setTimeout(() => {
      fallback(new Error('canvas.toBlob timeout'));
    }, 8000);

    try {
      toBlob.call(
        canvas,
        (blob) => {
          if (blob) resolveOnce(blob);
          else fallback(new Error('canvas.toBlob returned null'));
        },
        'image/png'
      );
    } catch (err) {
      fallback(err);
    }
  });
}

function normalizeScale(scale: number | undefined) {
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(0.25, Math.min(1, scale));
}

function normalizePixelRatio(pixelRatio: number | undefined) {
  if (typeof pixelRatio !== 'number' || !Number.isFinite(pixelRatio) || pixelRatio <= 0) return 2;
  return Math.max(0.5, Math.min(4, pixelRatio));
}

function pixelRatiosToTry(requestedPixelRatio: number) {
  const r = normalizePixelRatio(requestedPixelRatio);
  const list = [r];
  if (r > 2) list.push(2);
  if (r > 1.5) list.push(1.5);
  if (r > 1) list.push(1);
  list.push(0.75);
  list.push(0.5);
  return Array.from(new Set(list));
}

function drawContainImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const sw = img.naturalWidth || img.width; const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;
  const scale = Math.min(w / sw, h / sh); const dw = sw * scale; const dh = sh * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius); ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  let currentY = y; for (const line of lines) { ctx.fillText(line, x, currentY); currentY += lineHeight; }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const t = (text || '').replace(/\s+/g, ' ').trim(); if (!t) return [] as string[];
  const units = t.includes(' ') ? t.split(' ') : Array.from(t);
  const lines: string[] = []; let current = '';
  for (const unit of units) {
    const next = current ? (t.includes(' ') ? `${current} ${unit}` : `${current}${unit}`) : unit;
    if (ctx.measureText(next).width <= maxWidth) { current = next; } else { if (current) lines.push(current); current = unit; }
  }
  if (current) lines.push(current); return lines;
}

// --- SHARED DRAWING HELPERS ---

type SceneEnv = { ctx: CanvasRenderingContext2D; input: NewYearPosterInput; noiseImg: HTMLImageElement | null; logoImg: HTMLImageElement | null; glyphImg: HTMLImageElement | null; };

function drawTextureBackground(ctx: CanvasRenderingContext2D, color: string, noiseImg: HTMLImageElement | null, opacity = 0.1) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) { ctx.save(); ctx.globalAlpha = opacity; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = p; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); ctx.restore(); }
  }
}

function drawFloatingInkGlyph(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number, shadowBlur = 25) {
  if (!img) return;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'; ctx.shadowBlur = shadowBlur; ctx.shadowOffsetY = shadowBlur * 0.5;
  ctx.globalAlpha = 0.85; drawContainImage(ctx, img, x, y, size, size);
  ctx.shadowColor = 'transparent'; ctx.globalCompositeOperation = 'multiply'; ctx.filter = 'contrast(1.15) brightness(0.95)';
  drawContainImage(ctx, img, x, y, size, size); ctx.restore();
}

function drawRedSeal(ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, size = 100, color = '#C02C38') {
  if (!text) return;
  ctx.save(); ctx.shadowColor = 'rgba(139, 0, 0, 0.3)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 8;
  ctx.fillStyle = color; const r = size / 2; roundRect(ctx, centerX - r, centerY - r, size, size, 16); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#FDF6E3'; ctx.font = `900 ${size * 0.6}px 'Noto Serif SC', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, centerX, centerY + size * 0.05);
  ctx.strokeStyle = 'rgba(255,215,0, 0.4)'; ctx.lineWidth = 2; roundRect(ctx, centerX - r + 6, centerY - r + 6, size - 12, size - 12, 10); ctx.stroke(); ctx.restore();
}

async function drawStandardHeader(env: SceneEnv, color = '#1F1F1F') {
  const { ctx, logoImg } = env; const padding = 72;
  if (logoImg) { ctx.save(); ctx.globalAlpha = 0.9; drawContainImage(ctx, logoImg, padding, padding + 10, 88, 88); ctx.restore(); }
  ctx.save(); ctx.font = "900 48px 'Noto Serif SC', serif"; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(INKGRID_BRAND_CN, padding + 110, padding + 30);
  ctx.font = "600 32px 'Noto Serif SC', serif"; ctx.globalAlpha = 0.5; ctx.fillText(INKGRID_SLOGAN_CN, padding + 110, padding + 80); ctx.restore();
}

function drawGoldSprinkle(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.fillStyle = '#D4AF37'; ctx.globalAlpha = 0.6;
  for (let i = 0; i < 120; i++) { const x = Math.random() * CANVAS_W; const y = Math.random() * CANVAS_H; const r = Math.random() * 2.5 + 0.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

async function drawFooterQR(env: SceneEnv, x: number, y: number, color = '#C02C38') {
  const { ctx } = env; const qrSize = 120;
  const qrCanvas = document.createElement('canvas'); await QRCode.toCanvas(qrCanvas, INKGRID_QR_URL, { width: qrSize, margin: 0, color: { dark: color, light: '#00000000' } });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.fillRect(x, y, qrSize, qrSize); ctx.drawImage(qrCanvas, x, y, qrSize, qrSize);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(x - 5, y - 5, qrSize + 10, qrSize + 10);
}

function drawStandardFooter(env: SceneEnv, yStart: number, color = '#1F1F1F') {
  const { ctx, input } = env; const padding = 72; let cursorY = yStart;
  const fullSource = `《${input.glyph.source || '嶧山刻石'}》 · 第${input.glyph.index}字`;
  ctx.save(); ctx.textAlign = 'center'; ctx.font = "700 36px 'Noto Serif SC', serif"; ctx.fillStyle = color; ctx.globalAlpha = 0.6; ctx.fillText(fullSource, CANVAS_W / 2, cursorY); ctx.restore();
  
  cursorY += 120;
  ctx.save(); ctx.textAlign = 'center'; 
  // 核心修复：主标题改用更稳健的思源宋体加粗，避免艺术字体导致的渲染错误
  ctx.font = "900 96px 'Noto Serif SC', serif"; 
  ctx.fillStyle = color; 
  ctx.fillText(`${input.dayLabel} · ${input.caption}`, CANVAS_W / 2, cursorY); 
  ctx.restore();

  // --- 核心强化：年俗描述位置上提并加粗 ---
  if (input.story) {
    cursorY += 80; // 紧贴主标题
    ctx.save(); ctx.textAlign = 'center'; 
    ctx.font = "600 36px 'Noto Serif SC', serif"; 
    ctx.fillStyle = color; 
    ctx.fillText(input.story, CANVAS_W / 2, cursorY); ctx.restore();
  }

  const footerY = CANVAS_H - padding - 60;
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#C02C38'; ctx.fillRect(padding, footerY - 50, 4, 54);
  ctx.font = "600 30px 'Noto Serif SC', serif"; ctx.fillStyle = color;
  ctx.fillText(input.lunarDateStr || '', padding + 20, footerY - 18); ctx.restore();
}

// --- SCENES (Collectible Edition) ---

async function drawSceneNY08_Eve(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#8B1A1A', noiseImg, 0.15);
  const grad = ctx.createRadialGradient(CANVAS_W/2, 600, 100, CANVAS_W/2, 600, 1000); grad.addColorStop(0, 'rgba(255,100,100,0.15)'); grad.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  await drawStandardHeader(env, '#F2E6CE'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-750)/2, 350, 750); drawRedSeal(ctx, input.glyph.simplified || '', (CANVAS_W-750)/2 + 650, 420, 110); }
  // 核心修正：除夕出处文字使用更亮的颜色
  drawStandardFooter(env, 1200, '#FDF6E3'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#F2E6CE'); drawGoldSprinkle(ctx);
}
async function drawSceneNY01_Spring(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#C02C38', noiseImg, 0.1); drawGoldSprinkle(ctx); await drawStandardHeader(env, '#FDF6E3');
  ctx.save(); ctx.translate(CANVAS_W/2, 680); ctx.rotate(-Math.PI / 4); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20; ctx.fillStyle = '#F9F4E8'; ctx.fillRect(-350, -350, 700, 700); ctx.restore();
  if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-650)/2, 680 - 325, 650); drawRedSeal(ctx, input.glyph.simplified || '', (CANVAS_W/2) + 240, 480, 100); }
  drawStandardFooter(env, 1250, '#FDF6E3'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}
async function drawSceneNY02_Home(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#D2B48C', noiseImg, 0.2);
  ctx.save(); ctx.translate(CANVAS_W/2 + 20, 800); ctx.rotate(0.01); ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillStyle = '#FFF0E6'; ctx.fillRect(-420, -550, 840, 1100);
  ctx.strokeStyle = 'rgba(192, 44, 56, 0.12)'; ctx.lineWidth = 2; for(let x = -380; x <= 380; x += 80) { ctx.beginPath(); ctx.moveTo(x, -510); ctx.lineTo(x, 510); ctx.stroke(); } ctx.restore();
  await drawStandardHeader(env, '#4A3B32'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-700)/2, 400, 700); drawRedSeal(ctx, input.glyph.simplified || '', (CANVAS_W/2) + 280, 380, 110); }
  drawStandardFooter(env, 1320, '#3E2A1C'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#C02C38');
}
async function drawSceneNY03_Quiet(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#E0E5E5', noiseImg, 0.12);
  // Reduce scroll height so footer text doesn't overlap.
  const sW = 600, sH = 880, sX = (CANVAS_W - sW) / 2, sY = 320;
  ctx.save(); ctx.fillStyle = '#C0C8C8'; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.fillRect(sX - 30, sY - 30, sW + 60, sH + 60); ctx.fillStyle = '#F7F9FA'; ctx.fillRect(sX, sY, sW, sH); ctx.restore();
  await drawStandardHeader(env, '#2F4F4F'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-520)/2, sY + 60, 520); drawRedSeal(ctx, input.glyph.simplified || '', sX + sW - 80, sY + 100, 90); }
  drawStandardFooter(env, sY + sH + 90, '#2F2F2F');
  ctx.save(); ctx.font = "600 28px 'Noto Serif SC', serif"; ctx.fillStyle = '#2F4F4F'; ctx.fillText(input.lunarDateStr || '', 72, CANVAS_H - 100); ctx.restore();
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#2F4F4F');
}
async function drawSceneNY04_Stove(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#FAD6A5', noiseImg, 0.15);
  ctx.save(); const fY = 400, fR = 950, fA = Math.PI / 1.6; ctx.translate(CANVAS_W/2, fY + fR); ctx.beginPath(); ctx.arc(0, 0, fR, -Math.PI/2 - fA/2, -Math.PI/2 + fA/2); ctx.arc(0, 0, fR * 0.45, -Math.PI/2 + fA/2, -Math.PI/2 - fA/2, true); ctx.closePath(); ctx.fillStyle = '#FFF8F0'; ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.fill(); ctx.clip(); ctx.restore();
  await drawStandardHeader(env, '#5D4037'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-500)/2, fY + 100, 500); drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W/2 + 180, fY + 160, 90); }
  drawStandardFooter(env, 1250, '#5D4037'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#C02C38');
}
async function drawSceneNY05_Wealth(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#C7A252', noiseImg, 0.2); drawGoldSprinkle(ctx);
  const rW = 780, rH = 950, rY = 280; ctx.save(); ctx.fillStyle = '#1A1A1A'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.fillRect((CANVAS_W-rW)/2, rY, rW, rH); ctx.restore();
  await drawStandardHeader(env, '#1A1A1A'); if (glyphImg) { ctx.save(); ctx.filter = 'invert(1) brightness(1.6) contrast(1.2)'; ctx.globalAlpha = 0.9; drawContainImage(ctx, glyphImg, (CANVAS_W-650)/2, rY + 80, 650, 650); ctx.restore(); drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W/2 + 250, rY + 120, 110, '#FF3333'); }
  drawStandardFooter(env, 1420, '#1A1A1A'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#1A1A1A');
}
async function drawSceneNY06_Travel(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#D8C8B0', noiseImg, 0.2);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1; for(let i=0; i<CANVAS_H; i+=5) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_W, i); ctx.stroke(); } ctx.restore();
  await drawStandardHeader(env, '#3E3E3E'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, 80, 280, 750); drawRedSeal(ctx, input.glyph.simplified || '', 80 + 750 - 60, 280 + 750 - 120, 100); }
  drawStandardFooter(env, 1250, '#3E3E3E'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#8B0000');
}

async function drawSceneNY06_TravelFestive(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  drawTextureBackground(ctx, '#B80000', noiseImg, 0.14);
  drawGoldSprinkle(ctx);
  const glow = ctx.createRadialGradient(CANVAS_W / 2, 650, 80, CANVAS_W / 2, 650, 960);
  glow.addColorStop(0, 'rgba(255, 220, 170, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  await drawStandardHeader(env, '#FDF6E3');

  // A light paper panel to make the glyph more legible.
  const pW = 820;
  const pH = 980;
  const pX = (CANVAS_W - pW) / 2;
  const pY = 320;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.92)';
  roundRect(ctx, pX, pY, pW, pH, 56);
  ctx.fill();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, pX + 110, pY + 140, 600);
    drawRedSeal(ctx, input.glyph.simplified || '', pX + pW - 160, pY + 160, 110, '#C02C38');
  }

  // Move the source label down to avoid overlapping the glyph panel.
  drawStandardFooter(env, 1400, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}
async function drawSceneNY07_Human(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#F7F9F5', noiseImg, 0.1);
  ctx.save(); ctx.fillStyle = 'rgba(50, 80, 50, 0.04)'; ctx.beginPath(); ctx.moveTo(CANVAS_W, 100); ctx.lineTo(CANVAS_W - 300, 400); ctx.lineTo(CANVAS_W, 700); ctx.fill(); ctx.restore();
  await drawStandardHeader(env, '#555'); if (glyphImg) { ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.arc(CANVAS_W/2, 650, 450, 0, Math.PI*2); ctx.stroke(); ctx.restore(); drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-650)/2, 325, 650); drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W/2 + 220, 850, 90, '#C02C38'); }
  drawStandardFooter(env, 1320, '#333'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#333');
}

async function drawSceneNY07_HumanFestive(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  drawTextureBackground(ctx, '#C02C38', noiseImg, 0.12);
  drawGoldSprinkle(ctx);

  // Lantern ring
  ctx.save();
  const cx = CANVAS_W / 2;
  const cy = 720;
  const ring = ctx.createRadialGradient(cx, cy, 100, cx, cy, 520);
  ring.addColorStop(0, 'rgba(255, 245, 230, 0.95)');
  ring.addColorStop(1, 'rgba(255, 245, 230, 0.0)');
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  await drawStandardHeader(env, '#FDF6E3');

  // A round "paper cut" window.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.94)';
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, 700, 420, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W - 620) / 2, 390, 620);
    drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W / 2 + 250, 920, 95, '#8B0000');
  }

  drawStandardFooter(env, 1320, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}

async function drawSceneNY11_Earth(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  // Deep red + earth tone, with a bold red frame.
  drawTextureBackground(ctx, '#8B0000', noiseImg, 0.13);
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0.02)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  await drawStandardHeader(env, '#FDF6E3');

  const cardW = 860;
  const cardH = 1040;
  const cardX = (CANVAS_W - cardW) / 2;
  const cardY = 300;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.92)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 70);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(192, 44, 56, 0.55)';
  ctx.lineWidth = 6;
  roundRect(ctx, cardX + 28, cardY + 28, cardW - 56, cardH - 56, 56);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, cardX + 150, cardY + 220, 560);
    drawRedSeal(ctx, input.glyph.simplified || '', cardX + cardW - 170, cardY + 170, 115, '#C02C38');
  }

  drawGoldSprinkle(ctx);
  drawStandardFooter(env, 1430, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}

async function drawSceneNY12_Kin(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  // Red grid letter paper.
  drawTextureBackground(ctx, '#D2B48C', noiseImg, 0.18);
  await drawStandardHeader(env, '#3E2A1C');

  ctx.save();
  ctx.translate(CANVAS_W / 2, 820);
  ctx.rotate(-0.02);
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 55;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#FFF0E6';
  ctx.fillRect(-420, -560, 840, 1120);
  ctx.strokeStyle = 'rgba(192, 44, 56, 0.18)';
  ctx.lineWidth = 2;
  for (let x = -380; x <= 380; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, -520);
    ctx.lineTo(x, 520);
    ctx.stroke();
  }
  ctx.restore();

  // A red ribbon accent.
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#C02C38';
  roundRect(ctx, 110, 360, 26, 980, 18);
  ctx.fill();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W - 700) / 2, 420, 700);
    drawRedSeal(ctx, input.glyph.simplified || '', (CANVAS_W / 2) + 290, 410, 110, '#8B0000');
  }

  // Move down to avoid overlapping the glyph frame on day 11.
  drawStandardFooter(env, 1410, '#3E2A1C');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#C02C38');
}

async function drawSceneNY13_LanternPrep(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  const lantern3 = await loadLantern3().catch(() => null);
  // Bright festive red with lantern silhouettes.
  drawTextureBackground(ctx, '#C02C38', noiseImg, 0.12);
  drawGoldSprinkle(ctx);

  // Replace the simple lantern shapes with the curated lantern asset.
  if (lantern3) {
    ctx.save();
    ctx.globalAlpha = 0.58;
    for (let i = 0; i < 4; i += 1) {
      const x = 120 + i * 240;
      const y = 170 + (i % 2) * 18;
      const w = 150;
      const h = 220;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i - 1.5) * 0.05);
      drawContainImage(ctx, lantern3, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  await drawStandardHeader(env, '#FDF6E3');

  const winW = 820;
  const winH = 980;
  const winX = (CANVAS_W - winW) / 2;
  const winY = 340;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.92)';
  roundRect(ctx, winX, winY, winW, winH, 72);
  ctx.fill();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, winX + 120, winY + 190, 620);
    drawRedSeal(ctx, input.glyph.simplified || '', winX + winW - 170, winY + 170, 115, '#8B0000');
  }

  drawStandardFooter(env, 1390, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}

async function drawSceneNY14_TestLantern(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  // Dark red night + lantern glow.
  drawTextureBackground(ctx, '#300000', noiseImg, 0.18);
  const glow = ctx.createRadialGradient(CANVAS_W / 2, 640, 80, CANVAS_W / 2, 640, 980);
  glow.addColorStop(0, 'rgba(255, 220, 170, 0.26)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  await drawStandardHeader(env, '#FDF6E3');

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 36;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.94)';
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, 720, 440, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(192, 44, 56, 0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, 720, 420, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W - 620) / 2, 410, 620);
    drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W / 2 + 250, 960, 95, '#C02C38');
  }

  drawStandardFooter(env, 1320, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}

async function drawSceneNY15_SendLantern(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  const lantern1 = await loadLantern1().catch(() => null);
  const lantern2 = await loadLantern2().catch(() => null);
  // Travel scene but with a strong red lantern string.
  drawTextureBackground(ctx, '#F3EFE6', noiseImg, 0.12);

  ctx.save();
  const r = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
  r.addColorStop(0, 'rgba(192,44,56,0.22)');
  r.addColorStop(0.45, 'rgba(192,44,56,0.0)');
  r.addColorStop(0.55, 'rgba(192,44,56,0.0)');
  r.addColorStop(1, 'rgba(192,44,56,0.18)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  // Lantern string (use lantern images).
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(139,0,0,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, 210);
  ctx.quadraticCurveTo(CANVAS_W / 2, 120, CANVAS_W - 60, 220);
  ctx.stroke();
  ctx.restore();

  const lanterns = [lantern1, lantern2, lantern1, lantern2, lantern1].filter(Boolean) as HTMLImageElement[];
  if (lanterns.length) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    for (let i = 0; i < 5; i += 1) {
      const x = 140 + i * 200;
      const y = 242 + (i % 2) * 10;
      const img = lanterns[i % lanterns.length];
      const w = 110;
      const h = 160;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i - 2) * 0.03);
      drawContainImage(ctx, img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  await drawStandardHeader(env, '#3E3E3E');
  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, 80, 320, 750);
    drawRedSeal(ctx, input.glyph.simplified || '', 80 + 750 - 60, 320 + 750 - 120, 100);
  }

  drawStandardFooter(env, 1260, '#3E3E3E');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#8B0000');
}

async function drawSceneNY15_LanternFestival(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env;
  drawTextureBackground(ctx, '#8B0000', noiseImg, 0.12);
  drawGoldSprinkle(ctx);
  const grad = ctx.createRadialGradient(CANVAS_W / 2, 680, 120, CANVAS_W / 2, 680, 980);
  grad.addColorStop(0, 'rgba(255, 210, 140, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  await drawStandardHeader(env, '#FDF6E3');

  // Center lantern window
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = 'rgba(253, 246, 227, 0.94)';
  roundRect(ctx, (CANVAS_W - 820) / 2, 310, 820, 1040, 72);
  ctx.fill();
  ctx.restore();

  // Gold frame lines
  ctx.save();
  ctx.strokeStyle = 'rgba(184, 134, 11, 0.65)';
  ctx.lineWidth = 3;
  roundRect(ctx, (CANVAS_W - 820) / 2 + 26, 310 + 26, 820 - 52, 1040 - 52, 60);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W - 680) / 2, 430, 680);
    drawRedSeal(ctx, input.glyph.simplified || '', (CANVAS_W / 2) + 250, 1040, 110, '#C02C38');
  }

  drawStandardFooter(env, 1410, '#FDF6E3');
  await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#FDF6E3');
}

// --- MAIN ENTRYPOINT & EXPORTS ---

export async function renderPosterPng(input: PosterInput, options: RenderPosterOptions = {}) {
  const scale = normalizeScale(options.scale);
  const requestedPixelRatio = normalizePixelRatio(options.pixelRatio);
  const noiseImg = await loadImage('/noise.png').catch(() => null);

  let lastErr: unknown = null;
  for (const pixelRatio of pixelRatiosToTry(requestedPixelRatio)) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(CANVAS_W * pixelRatio * scale); canvas.height = Math.round(CANVAS_H * pixelRatio * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');
      ctx.scale(pixelRatio * scale, pixelRatio * scale);

      if (input.template === 'folio') {
        drawFolioBase(ctx, noiseImg);
        if (input.kind === 'char') await drawCharFolio(ctx, input.data);
        else await drawSteleFolio(ctx, input.data);
      } else if (input.template === 'minimal') {
        drawMinimalBase(ctx, noiseImg);
        if (input.kind === 'char') await drawCharMinimal(ctx, input.data);
        else await drawSteleMinimal(ctx, input.data);
      } else {
        // night
        drawNightBase(ctx, noiseImg);
        if (input.kind === 'char') await drawCharNight(ctx, input.data);
        else await drawSteleNight(ctx, input.data);
      }

      const blob = await canvasToBlob(canvas); return { blob, width: CANVAS_W, height: CANVAS_H };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to render poster');
}

export async function renderCuratedCollagePng(input: CuratedCollageInput, options: RenderPosterOptions = {}) {
  const canvas = document.createElement('canvas');
  const scale = options.scale || 1; const pixelRatio = options.pixelRatio || 2;
  canvas.width = Math.round(CANVAS_W * pixelRatio * scale); canvas.height = Math.round(CANVAS_H * pixelRatio * scale);
  const ctx = canvas.getContext('2d')!; ctx.scale(pixelRatio * scale, pixelRatio * scale);
  const noiseImg = await loadImage('/noise.png').catch(() => null);
  const desk = ctx.createLinearGradient(0, 0, 0, CANVAS_H); desk.addColorStop(0, '#B78B52'); desk.addColorStop(1, '#8C6537'); ctx.fillStyle = desk; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const cards = (input.cards || []).filter(c => c.image).slice(0, 8);
  for(let i=0; i<cards.length; i++) {
    const p = [{x:-26,y:320},{x:360,y:300},{x:730,y:346},{x:72,y:820},{x:430,y:784},{x:780,y:860},{x:-10,y:1310},{x:360,y:1280}][i];
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.filter = 'blur(20px)'; roundRect(ctx, p.x+18, p.y+22, 368, 498, 34); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#F6F1E7'; roundRect(ctx, p.x, p.y, 340, 480, 34); ctx.fill();
    const img = await loadImage(cards[i].image).catch(()=>null); if(img){ ctx.save(); roundRect(ctx,p.x,p.y,340,480,34); ctx.clip(); drawContainImage(ctx,img,p.x+40,p.y+96,260,300); ctx.restore(); }
  }
  const blob = await canvasToBlob(canvas); return { blob, width: CANVAS_W, height: CANVAS_H };
}

export async function renderNewYearPosterPng(input: NewYearPosterInput, options: RenderPosterOptions = {}) {
  try { await document.fonts.load("900 120px 'ZCOOL XiaoWei'"); } catch(e) {}
  const scale = normalizeScale(options.scale);
  const requestedPixelRatio = normalizePixelRatio(options.pixelRatio);
  const [noiseImg, logoImg, glyphImg] = await Promise.all([loadImage('/noise.png').catch(() => null), loadBrandLogo().catch(() => null), loadImage(input.glyph.image).catch(() => null)]);

  let lastErr: unknown = null;
  for (const pixelRatio of pixelRatiosToTry(requestedPixelRatio)) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(CANVAS_W * pixelRatio * scale); canvas.height = Math.round(CANVAS_H * pixelRatio * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');
      ctx.scale(pixelRatio * scale, pixelRatio * scale);

      const env: SceneEnv = { ctx, input, noiseImg, logoImg, glyphImg };
      switch (input.id) {
        case 'ny_08': await drawSceneNY08_Eve(env); break;
        case 'ny_01': await drawSceneNY01_Spring(env); break;
        case 'ny_02': await drawSceneNY02_Home(env); break;
        case 'ny_03': await drawSceneNY03_Quiet(env); break;
        case 'ny_04': await drawSceneNY04_Stove(env); break;
        case 'ny_05': await drawSceneNY05_Wealth(env); break;
        case 'ny_06': await drawSceneNY06_Travel(env); break;
        case 'ny_07': await drawSceneNY07_Human(env); break;
        case 'ny_06_festive': await drawSceneNY06_TravelFestive(env); break;
        case 'ny_07_festive': await drawSceneNY07_HumanFestive(env); break;
        case 'ny_09': await drawSceneNY08_Eve(env); break;
        case 'ny_10': await drawSceneNY01_Spring(env); break;
        case 'ny_11': await drawSceneNY11_Earth(env); break;
        case 'ny_12': await drawSceneNY12_Kin(env); break;
        case 'ny_13': await drawSceneNY13_LanternPrep(env); break;
        case 'ny_14': await drawSceneNY14_TestLantern(env); break;
        case 'ny_15': await drawSceneNY15_SendLantern(env); break;
        case 'ny_16': await drawSceneNY15_LanternFestival(env); break;
        default: await drawSceneNY01_Spring(env); break;
      }
      const blob = await canvasToBlob(canvas); return { blob, width: CANVAS_W, height: CANVAS_H };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to render New Year poster');
}

/**
 * New Year Concept Explanation Card (1:1 Hand-札 style)
 */
export async function renderNewYearConceptPng(id: string, options: RenderPosterOptions = {}) {
  const SIZE = 1080; const canvas = document.createElement('canvas');
  const scale = options.scale || 1; const pixelRatio = options.pixelRatio || 2;
  canvas.width = Math.round(SIZE * pixelRatio * scale); canvas.height = Math.round(SIZE * pixelRatio * scale);
  const ctx = canvas.getContext('2d')!; ctx.scale(pixelRatio * scale, pixelRatio * scale);
  
  interface ConceptInfo { title: string; text: string; tone: string; }
  const concepts: Record<string, ConceptInfo> = {
    'ny_08': { title: '守岁灯火', text: '除夕之夜，灯火可亲。以深红胭脂色为底，辅以聚光灯效，模拟围炉守岁之温暖。金色字体跃动，寓意薪火相传，岁岁长久。', tone: '#F9F4E8' },
    'ny_01': { title: '开门大吉', text: '初一春节，万象更新。采用正红洒金斗方构图，模拟民间张贴春联、门神的习俗。中轴对称，气势端庄，尽显节日仪式感。', tone: '#FDF6E3' },
    'ny_02': { title: '团圆家书', text: '初二回门，纸短情长。模拟薛涛笺红格信纸，微微倾斜摆放于案头。通过竖排文字排版，营造家书抵万金的温情归宁氛围。', tone: '#FFF0E6' },
    'ny_03': { title: '静心修身', text: '初三赤口，宜静不宜动。采用天青宋锦装裱立轴构图。窄条画心与大面积留白，表现书斋读帖、神游金石的文人精神生活。', tone: '#F5F5F0' },
    'ny_04': { title: '人间烟火', text: '初四接灶，福气盈门。以杏黄衬底，泥金扇面构图。弧形排列的文字模拟扇面书画，呈现接灶神、纳福气的温馨烟火气。', tone: '#F9F4E8' },
    'ny_05': { title: '金石纳福', text: '初五破五，金玉满堂。模拟汉砖魏碑拓片质感，黑底白字。赭石衬底表现厚重的金石气，寓意财富如碑刻般经久留存。', tone: '#FDF6E3' },
    'ny_06': { title: '行云流水', text: '初六送穷，志在四方。采用仿古绢本材质，对角线灵动构图。墨迹线条如水流动，表现送穷出门、万事顺遂的生机与气韵。', tone: '#FFF0E6' },
    'ny_07': { title: '众生安康', text: '初七人日，万物祥和。竹纸留白，禅意圆框。极简排版表现人人生日、万物平等的清雅气息。窗外竹影摇曳，寓意岁岁平安。', tone: '#F5F5F0' }
    ,
    'ny_06_festive': { title: '朱砂喜气', text: '为初六新增一版更喜庆的构图：以正红为底，洒金如星，留一方暖白纸面承托“泽”字。红与金让年味更足，字仍保持墨阵的克制与呼吸。', tone: '#FDF6E3' },
    'ny_07_festive': { title: '灯影人日', text: '为初七新增喜庆版：红底灯影，圆窗如灯。让“康”字安坐其间，配朱砂印作点睛。喜庆不靠堆色，而靠层次与留白，让祝福更耐看。', tone: '#FFF0E6' },
    'ny_09': { title: '顺星开卷', text: '初八顺星，讲究一个“开”。沿用夜色与朱砂的对比：深底如夜，红印如星，字像一盏小灯把新年继续点亮。', tone: '#F9F4E8' },
    'ny_10': { title: '天公赐福', text: '初九天公生，宜敬天祈愿。构图回到正红洒金的“节日正面感”，以朱为礼、以金为庆，让“天”字成为一枚新岁的誓愿。', tone: '#FDF6E3' },
    'ny_11': { title: '敬土安宅', text: '初十敬土，讲究一个“稳”。以深红作底、暖白作纸，红框如门楣，金粉如香火。让“土”字落定：家宅稳，人心稳，新一年才稳。', tone: '#FDF6E3' },
    'ny_12': { title: '亲眷家书', text: '正月十一亲眷相聚。红格信纸与朱砂竖带像一条“系住人情”的线，让“亲”字写在纸上，也写在团圆的回声里。', tone: '#FFF0E6' },
    'ny_13': { title: '作灯起势', text: '正月十二作灯备会。以正红为底，叠加灯影与洒金，留一方纸面承托“作”字：热闹的准备，从一笔一画的工序开始。', tone: '#FDF6E3' },
    'ny_14': { title: '试灯见明', text: '正月十三试灯。用深红夜色托出灯晕，圆窗像灯。让“明”字在光里出现：不必过亮，亮在恰好；朱砂印一点，喜气就立住了。', tone: '#F5F5F0' },
    'ny_15': { title: '送灯登门', text: '正月十四送灯。画面挂一串红灯，像把祝福沿路点亮；留白与墨字让喜庆不浮躁。灯走到哪里，热闹就到哪里。', tone: '#FFF0E6' },
    'ny_16': { title: '元宵大成', text: '正月十五元宵，灯会为高潮。以正红与洒金为主调，中央留一方灯窗，让“泰”字落定：一年从此安泰，大喜而不浮。', tone: '#FDF6E3' }
  };
  
  const info = concepts[id] || concepts['ny_01']; const noiseImg = await loadImage('/noise.png').catch(() => null);
  ctx.fillStyle = info.tone; ctx.fillRect(0, 0, SIZE, SIZE);
  if (noiseImg) { const p = ctx.createPattern(noiseImg, 'repeat'); if (p) { ctx.save(); ctx.globalAlpha = 0.12; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = p; ctx.fillRect(0, 0, SIZE, SIZE); ctx.restore(); } }
  const padding = 100; ctx.strokeStyle = 'rgba(192, 44, 56, 0.15)'; ctx.lineWidth = 1.5;
  for (let x = padding; x <= SIZE - padding; x += 80) { ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, SIZE - padding); ctx.stroke(); }
  try { await document.fonts.load("400 40px 'Ma Shan Zheng'"); } catch(e) {}
  ctx.fillStyle = '#1A1A1A'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = "400 64px 'Ma Shan Zheng', cursive"; const titleChars = Array.from(info.title); let curY = padding + 20; for (const char of titleChars) { ctx.fillText(char, SIZE - padding - 40, curY); curY += 70; }
  ctx.font = "400 36px 'Ma Shan Zheng', cursive"; const textChars = Array.from(info.text); let textX = SIZE - padding - 140, textY = padding + 20;
  for (const char of textChars) { if (textY + 40 > SIZE - padding - 60) { textX -= 80; textY = padding + 20; } ctx.fillText(char, textX, textY); textY += 48; }

  // --- 手札落款：双列竖排 ---
  ctx.globalAlpha = 1;
  const footerX = padding + 20;
  const logoImg_concept = await loadBrandLogo().catch(() => null);
  if (logoImg_concept) { ctx.save(); ctx.globalAlpha = 0.8; drawContainImage(ctx, logoImg_concept, footerX, SIZE - padding - 100, 64, 64); ctx.restore(); }
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = "900 36px 'Noto Serif SC', serif"; let brandY = SIZE - padding - 220;
  for (const c of INKGRID_BRAND_CN) { ctx.fillText(c, footerX + 32, brandY); brandY += 45; }
  ctx.font = "600 36px 'Noto Serif SC', serif"; ctx.fillStyle = '#666'; let sloganY = padding + 20;
  for (const c of INKGRID_SLOGAN_CN) { ctx.fillText(c, footerX - 20, sloganY); sloganY += 45; }
  ctx.restore();

  const blob = await canvasToBlob(canvas); return { blob, width: SIZE, height: SIZE };
}

/**
 * New Year Story Card (1:1) - Folklore story under the concept note.
 */
export async function renderNewYearStoryPng(input: NewYearPosterInput, options: RenderPosterOptions = {}) {
  const SIZE = 1080;
  const scale = normalizeScale(options.scale);
  const requestedPixelRatio = normalizePixelRatio(options.pixelRatio);

  const tones: Record<string, string> = {
    ny_08: '#F9F4E8',
    ny_01: '#FDF6E3',
    ny_02: '#FFF0E6',
    ny_03: '#F5F5F0',
    ny_04: '#F9F4E8',
    ny_05: '#FDF6E3',
    ny_06: '#FFF0E6',
    ny_07: '#F5F5F0',
    ny_06_festive: '#FFF0E6',
    ny_07_festive: '#FDF6E3',
    ny_09: '#F9F4E8',
    ny_10: '#FDF6E3',
    ny_11: '#FFF0E6',
    ny_12: '#F9F4E8',
    ny_13: '#F5F5F0',
    ny_14: '#FFF0E6',
    ny_15: '#FDF6E3',
    ny_16: '#FDF6E3',
  };
  const tone = tones[String(input.id || '')] || tones.ny_01;

  const glyphChar = String(input.glyph?.simplified || '').trim().slice(0, 1);
  const caption = String(input.caption || '').trim();
  const dayLabel = String(input.dayLabel || '').trim();
  const story = String(input.story || '').replace(/\s+/g, '').trim() || '字里有年俗，年俗里有字。';
  const title = caption || '字与年俗';

  const [noiseImg, logoImg, glyphImg] = await Promise.all([
    loadImage('/noise.png').catch(() => null),
    loadBrandLogo().catch(() => null),
    input.glyph?.image ? loadImage(input.glyph.image).catch(() => null) : Promise.resolve(null),
  ]);

  let lastErr: unknown = null;
  for (const pixelRatio of pixelRatiosToTry(requestedPixelRatio)) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(SIZE * pixelRatio * scale);
      canvas.height = Math.round(SIZE * pixelRatio * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');
      ctx.scale(pixelRatio * scale, pixelRatio * scale);

      ctx.fillStyle = tone; ctx.fillRect(0, 0, SIZE, SIZE);
      if (noiseImg) {
        const p = ctx.createPattern(noiseImg, 'repeat');
        if (p) {
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = p;
          ctx.fillRect(0, 0, SIZE, SIZE);
          ctx.restore();
        }
      }

      const padding = 100;
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 44, 56, 0.12)';
      ctx.lineWidth = 1.5;
      for (let x = padding; x <= SIZE - padding; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, SIZE - padding);
        ctx.stroke();
      }
      ctx.restore();

      // Watermark glyph (prefer actual seal glyph image)
      if (glyphImg) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.translate(SIZE / 2, SIZE / 2 + 30);
        ctx.rotate(-0.08);
        ctx.filter = 'contrast(1.15) brightness(0.95)';
        drawContainImage(ctx, glyphImg, -360, -360, 720, 720);
        ctx.restore();
      } else if (glyphChar) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#1A1A1A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "900 520px 'Noto Serif SC', serif";
        ctx.fillText(glyphChar, SIZE / 2, SIZE / 2 + 40);
        ctx.restore();
      }

      const header = [String(input.yearLabel || '').trim(), dayLabel].filter(Boolean).join(' · ');
      if (header) {
        ctx.save();
        ctx.fillStyle = '#1A1A1A';
        ctx.globalAlpha = 0.55;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = "700 26px 'Noto Serif SC', serif";
        ctx.fillText(header, padding, 56);
        ctx.restore();
      }

      // Place seal away from the left-side vertical label.
      if (glyphChar) drawRedSeal(ctx, glyphChar, padding + 220, padding + 150, 96, '#C02C38');

      try { await document.fonts.load("400 40px 'Ma Shan Zheng'"); } catch (e) {}
      try { await document.fonts.load("600 36px 'Noto Serif SC'"); } catch (e) {}

      // Title (vertical)
      ctx.save();
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "400 64px 'Ma Shan Zheng', cursive";
      let titleY = padding + 20;
      for (const ch of Array.from(title)) {
        ctx.fillText(ch, SIZE - padding - 40, titleY);
        titleY += 70;
      }
      ctx.restore();

      // Story (vertical)
      ctx.save();
      ctx.fillStyle = '#1A1A1A';
      ctx.globalAlpha = 0.9;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 36px 'Noto Serif SC', serif";
      const storyChars = Array.from(story);
      let textX = SIZE - padding - 140;
      let textY = padding + 20;
      for (const ch of storyChars) {
        if (textY + 42 > SIZE - padding - 60) {
          textX -= 80;
          textY = padding + 20;
        }
        ctx.fillText(ch, textX, textY);
        textY += 50;
      }
      ctx.restore();

      // Signature (left)
      const footerX = padding + 20;
      if (logoImg) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        drawContainImage(ctx, logoImg, footerX, SIZE - padding - 100, 64, 64);
        ctx.restore();
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#1A1A1A';
      ctx.font = "900 36px 'Noto Serif SC', serif";
      let brandY = SIZE - padding - 220;
      for (const c of INKGRID_BRAND_CN) {
        ctx.fillText(c, footerX + 32, brandY);
        brandY += 45;
      }
      ctx.font = "600 36px 'Noto Serif SC', serif";
      ctx.fillStyle = '#666';
      let tagY = padding + 20;
      for (const c of '字与年俗') {
        ctx.fillText(c, footerX - 20, tagY);
        tagY += 45;
      }
      ctx.restore();

      const lunar = String(input.lunarDateStr || '').trim();
      if (lunar) {
        ctx.save();
        ctx.fillStyle = '#666';
        ctx.globalAlpha = 0.65;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = "600 26px 'Noto Serif SC', serif";
        ctx.fillText(lunar, SIZE - padding, SIZE - padding + 6);
        ctx.restore();
      }

      const blob = await canvasToBlob(canvas);
      return { blob, width: SIZE, height: SIZE };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to render New Year story card');
}

// --- BASIC POSTERS ---
function drawFolioBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  drawTextureBackground(ctx, '#F6F1E7', noiseImg, 0.14);
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.035)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 2;
  roundRect(ctx, 54, 74, CANVAS_W - 108, CANVAS_H - 148, 44);
  ctx.stroke();
  ctx.restore();
}
function drawWashBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  drawTextureBackground(ctx, '#F7F2E9', noiseImg, 0.12);
  // Ink wash backdrop.
  const blot = (cx: number, cy: number, r: number, a: number, tint = '0,0,0') => {
    const grad = ctx.createRadialGradient(cx, cy, Math.max(10, r * 0.08), cx, cy, r);
    grad.addColorStop(0, `rgba(${tint}, ${a})`);
    grad.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  blot(CANVAS_W * 0.55, 680, 560, 0.16, '35,55,55');
  blot(CANVAS_W * 0.42, 760, 420, 0.12, '10,10,10');
  blot(CANVAS_W * 0.62, 520, 360, 0.10, '10,10,10');
  ctx.restore();
}
function drawMinimalBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  drawTextureBackground(ctx, '#F8F8F4', noiseImg, 0.06);
  // Museum label grid.
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 1;
  const pad = 72;
  for (let x = pad; x <= CANVAS_W - pad; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, CANVAS_H - pad);
    ctx.stroke();
  }
  for (let y = pad; y <= CANVAS_H - pad; y += 90) {
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(CANVAS_W - pad, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrocadeBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, '#7A1E1E');
  bg.addColorStop(1, '#4C0F12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Brocade pattern.
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = 'rgba(212,175,55,0.9)';
  ctx.lineWidth = 2;
  const step = 160;
  for (let y = -step; y < CANVAS_H + step; y += step) {
    for (let x = -step; x < CANVAS_W + step; x += step) {
      const cx = x + step / 2;
      const cy = y + step / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 44);
      ctx.lineTo(cx + 44, cy);
      ctx.lineTo(cx, cy + 44);
      ctx.lineTo(cx - 44, cy);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx + 22, cy);
      ctx.lineTo(cx, cy + 22);
      ctx.lineTo(cx - 22, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // Gold frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 52, 72, CANVAS_W - 104, CANVAS_H - 144, 46);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(212,175,55,0.22)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 78, 98, CANVAS_W - 156, CANVAS_H - 196, 40);
  ctx.stroke();
  ctx.restore();

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
  }
}

function drawSealBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  drawTextureBackground(ctx, '#FCFAF4', noiseImg, 0.08);
  ctx.save();
  ctx.strokeStyle = 'rgba(192, 44, 56, 0.10)';
  ctx.lineWidth = 1.2;
  const pad = 66;
  for (let x = pad; x <= CANVAS_W - pad; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, CANVAS_H - pad);
    ctx.stroke();
  }
  for (let y = pad; y <= CANVAS_H - pad; y += 96) {
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(CANVAS_W - pad, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNightBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  ctx.fillStyle = '#0B0B0E';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const glow = ctx.createRadialGradient(CANVAS_W / 2, 620, 80, CANVAS_W / 2, 620, 1100);
  glow.addColorStop(0, 'rgba(212,175,55,0.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
  }

  const vignette = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 200, CANVAS_W / 2, CANVAS_H / 2, 1300);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

type PosterTheme = { text: string; muted: string; accent: string };
const THEME_DEFAULT: PosterTheme = { text: '#1A1A1A', muted: '#666666', accent: '#8B0000' };

async function drawCharPoster(ctx: CanvasRenderingContext2D, data: PosterChar, theme: PosterTheme) {
  const padding = 72;
  const cardX = padding;
  const cardY = 220;
  const cardW = CANVAS_W - padding * 2;
  const cardH = 980;

  // Header
  ctx.save();
  ctx.fillStyle = theme.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, padding, padding + 4);
  ctx.globalAlpha = 0.6;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, padding, padding + 58);
  ctx.restore();

  // Card background
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 54); ctx.fill();
  ctx.restore();

  // Glyph image
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  if (glyphImg) {
    const innerPad = 92;
    const gx = cardX + innerPad;
    const gy = cardY + innerPad;
    const gw = cardW - innerPad * 2;
    const gh = cardH - innerPad * 2;
    ctx.save();
    roundRect(ctx, gx, gy, gw, gh, 44); ctx.clip();
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, gx, gy, gw, gh);
    ctx.restore();
  }

  // Seal mark
  const sealChar = String(data.simplified || '').trim().slice(0, 1);
  if (sealChar) {
    drawRedSeal(ctx, sealChar, cardX + cardW - 92, cardY + 92, 120, theme.accent);
  }

  // Text block
  let cursorY = cardY + cardH + 48;
  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();

  ctx.save();
  ctx.fillStyle = theme.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  if (simplified) {
    ctx.font = "900 120px 'Noto Serif SC', serif";
    ctx.fillText(simplified, padding, cursorY);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 34px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, padding + 170, cursorY + 56);
    ctx.globalAlpha = 1;
  }

  cursorY += 160;
  if (meaning) {
    ctx.globalAlpha = 0.9;
    ctx.font = "600 34px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, CANVAS_W - padding * 2);
    drawLines(ctx, lines.slice(0, 3), padding, cursorY, 52);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Footer source
  const footerBits = [
    data.sourceTitle ? `《${data.sourceTitle}》` : '',
    data.dynasty || '',
    data.author || '',
  ].filter(Boolean);
  const footer = footerBits.join(' · ');
  if (footer) {
    ctx.save();
    ctx.fillStyle = theme.muted; ctx.globalAlpha = 0.75;
    ctx.font = "600 28px 'Noto Serif SC', serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(footer, padding, CANVAS_H - padding);
    ctx.restore();
  }
}

async function drawStelePoster(ctx: CanvasRenderingContext2D, stele: PosterStele, theme: PosterTheme) {
  const padding = 72;
  const cardX = padding;
  const cardY = 240;
  const cardW = CANVAS_W - padding * 2;
  const cardH = 1080;

  // Header
  ctx.save();
  ctx.fillStyle = theme.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, padding, padding + 4);
  ctx.globalAlpha = 0.6;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, padding, padding + 58);
  ctx.restore();

  // Card
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 54); ctx.fill();
  ctx.restore();

  const title = String(stele.name || '').trim();
  const meta = [stele.dynasty, stele.author, stele.script_type].filter(Boolean).join(' · ');
  const excerpt = String(stele.description || stele.content || '').replace(/\s+/g, ' ').trim();

  ctx.save();
  ctx.fillStyle = theme.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  let cursorY = cardY + 72;
  if (title) {
    ctx.font = "900 72px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, title, cardW - 144);
    drawLines(ctx, lines.slice(0, 2), cardX + 72, cursorY, 90);
    cursorY += Math.min(2, lines.length) * 90 + 24;
  }

  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(meta, cardX + 72, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 70;
  }

  if (excerpt) {
    ctx.globalAlpha = 0.85;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, excerpt, cardW - 144);
    drawLines(ctx, lines.slice(0, 10), cardX + 72, cursorY, 52);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Footer info
  const footerBits = [
    stele.location ? `现藏：${stele.location}` : '',
    typeof stele.total_chars === 'number' ? `${stele.total_chars} 字` : '',
  ].filter(Boolean);
  const footer = footerBits.join(' · ');
  if (footer) {
    ctx.save();
    ctx.fillStyle = theme.muted; ctx.globalAlpha = 0.75;
    ctx.font = "600 28px 'Noto Serif SC', serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(footer, padding, CANVAS_H - padding);
    ctx.restore();
  }
}

function drawVerticalText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, step: number) {
  let cursor = y;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, x, cursor);
    cursor += step;
  }
}

function hashString32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawNightDust(ctx: CanvasRenderingContext2D, seedKey: string) {
  const rand = mulberry32(hashString32(seedKey));
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#D4AF37';
  for (let i = 0; i < 140; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    const r = rand() * 2.4 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function formatCharFooter(data: PosterChar) {
  const bits = [data.sourceTitle ? `《${data.sourceTitle}》` : '', data.dynasty || '', data.author || ''].filter(Boolean);
  return bits.join(' · ');
}

function drawFolioBinding(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const w = 122;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w, y + 14);
  ctx.lineTo(x + w, y + h - 14);
  ctx.stroke();

  const holes = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < holes; i++) {
    const hy = y + (h * (0.16 + (i * 0.68) / (holes - 1)));
    ctx.beginPath();
    ctx.arc(x + w / 2, hy, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

async function drawCharFolio(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const pageX = 54;
  const pageY = 74;
  const pageW = CANVAS_W - 108;
  const pageH = CANVAS_H - 148;

  // Binding & slip
  drawFolioBinding(ctx, pageX + 18, pageY + 30, pageH - 60);
  const slipW = 78;
  const slipX = pageX + pageW - slipW - 22;
  const slipY = pageY + 210;
  const slipH = 520;
  ctx.save();
  ctx.fillStyle = 'rgba(139, 0, 0, 0.86)';
  roundRect(ctx, slipX, slipY, slipW, slipH, 26);
  ctx.fill();
  ctx.fillStyle = '#F2E6CE';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawVerticalText(ctx, '篆字研习', slipX + slipW / 2, slipY + 52, 46);
  ctx.restore();

  const contentX = pageX + 18 + 122 + 44;
  const contentRight = slipX - 26;
  const contentW = Math.max(520, contentRight - contentX);
  const paddingTop = pageY + 44;

  // Header
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, contentX, paddingTop);
  ctx.globalAlpha = 0.6;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, contentX, paddingTop + 56);
  ctx.restore();

  // Mount
  const mountX = contentX;
  const mountY = pageY + 210;
  const mountW = contentW;
  const mountH = 940;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  roundRect(ctx, mountX, mountY, mountW, mountH, 56);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, mountX + 18, mountY + 18, mountW - 36, mountH - 36, 48);
  ctx.stroke();
  ctx.restore();

  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  if (glyphImg) {
    const innerPad = 88;
    const gx = mountX + innerPad;
    const gy = mountY + innerPad;
    const gw = mountW - innerPad * 2;
    const gh = mountH - innerPad * 2;
    ctx.save();
    roundRect(ctx, gx, gy, gw, gh, 44);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, gx, gy, gw, gh);
    ctx.restore();
  }

  const simplified = String(data.simplified || '').trim();
  if (simplified) {
    drawRedSeal(ctx, simplified.slice(0, 1), mountX + mountW - 92, mountY + 92, 120, '#C02C38');
  }

  // Text
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  let cursorY = mountY + mountH + 52;
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (simplified) {
    ctx.font = "900 112px 'Noto Serif SC', serif";
    ctx.fillText(simplified, contentX, cursorY);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, contentX + 160, cursorY + 56);
    ctx.globalAlpha = 1;
  }
  cursorY += 150;
  if (meaning) {
    ctx.globalAlpha = 0.92;
    ctx.font = "600 34px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, contentW);
    drawLines(ctx, lines.slice(0, 3), contentX, cursorY, 52);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  const footer = formatCharFooter(data);
  if (footer) {
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.globalAlpha = 0.75;
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, contentX, pageY + pageH - 56);
    ctx.restore();
  }
}

async function drawCharWash(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const padding = 80;
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);

  // Header
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, padding, 64);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('水墨 · 篆字研习', padding, 118);
  ctx.restore();

  // Brush stroke
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#2F4F4F';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(padding, 200);
  ctx.lineTo(CANVAS_W - padding - 140, 236);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W - 820) / 2, 280, 820, 55);
  }

  // Bottom panel
  const panelX = 80;
  const panelY = 1260;
  const panelW = CANVAS_W - 160;
  const panelH = 600;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.56)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 58);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(47,79,79,0.18)';
  ctx.lineWidth = 2;
  roundRect(ctx, panelX + 16, panelY + 16, panelW - 32, panelH - 32, 50);
  ctx.stroke();
  ctx.restore();

  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  const footer = formatCharFooter(data);

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (simplified) {
    ctx.font = "900 96px 'Noto Serif SC', serif";
    ctx.fillText(simplified, panelX + 54, panelY + 44);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.65;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, panelX + 54, panelY + 152);
    ctx.globalAlpha = 1;
  }
  if (meaning) {
    ctx.globalAlpha = 0.9;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, panelW - 108);
    drawLines(ctx, lines.slice(0, 4), panelX + 54, panelY + 214, 50);
    ctx.globalAlpha = 1;
  }
  if (footer) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#2F4F4F';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, panelX + 54, panelY + panelH - 46);
  }
  ctx.restore();

  if (simplified) {
    drawRedSeal(ctx, simplified.slice(0, 1), panelX + panelW - 92, panelY + panelH - 98, 96, '#8B0000');
  }
}

async function drawCharMinimal(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const pad = 72;
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  const footer = formatCharFooter(data);

  // Header line
  ctx.save();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 34px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, pad, pad);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 22px 'Noto Serif SC', serif";
  ctx.fillText('馆藏展签 · 篆字', pad, pad + 44);
  ctx.globalAlpha = 0.45;
  ctx.textAlign = 'right';
  ctx.font = "600 22px 'Noto Serif SC', serif";
  ctx.fillText(simplified ? `NO. ${simplified}` : 'NO.', CANVAS_W - pad, pad + 6);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 96);
  ctx.lineTo(CANVAS_W - pad, pad + 96);
  ctx.stroke();
  ctx.restore();

  // Glyph frame
  const box = 720;
  const boxX = (CANVAS_W - box) / 2;
  const boxY = 250;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  roundRect(ctx, boxX, boxY, box, box, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, boxY, box, box, 44);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    ctx.save();
    roundRect(ctx, boxX + 34, boxY + 34, box - 68, box - 68, 38);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, boxX + 34, boxY + 34, box - 68, box - 68);
    ctx.restore();
  }

  // Info block
  const infoY = boxY + box + 86;
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (simplified) {
    ctx.font = "900 118px 'Noto Serif SC', serif";
    ctx.fillText(simplified, pad, infoY);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.65;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, pad + 170, infoY + 64);
    ctx.globalAlpha = 1;
  }

  if (meaning) {
    ctx.globalAlpha = 0.9;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, CANVAS_W - pad * 2);
    drawLines(ctx, lines.slice(0, 4), pad, infoY + 150, 50);
    ctx.globalAlpha = 1;
  }

  if (footer) {
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#666';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, pad, CANVAS_H - pad);
  }
  ctx.restore();

  // Accent mark
  ctx.save();
  ctx.fillStyle = '#C02C38';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(pad, infoY + 146, 4, 54);
  ctx.restore();
}

async function drawCharBrocade(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const pad = 72;
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  const footer = formatCharFooter(data);

  // Gold header
  ctx.save();
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, CANVAS_W / 2, 74);
  ctx.globalAlpha = 0.75;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('锦纹 · 轻奢典藏', CANVAS_W / 2, 130);
  ctx.restore();

  // Parchment panel
  const panelX = 84;
  const panelY = 210;
  const panelW = CANVAS_W - 168;
  const panelH = CANVAS_H - 360;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = 'rgba(247,242,233,0.94)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 66);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, panelX + 22, panelY + 22, panelW - 44, panelH - 44, 54);
  ctx.stroke();
  ctx.restore();

  // Glyph mount
  const box = 680;
  const boxX = (CANVAS_W - box) / 2;
  const boxY = panelY + 148;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, boxX, boxY, box, box, 54);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, boxX + 18, boxY + 18, box - 36, box - 36, 48);
  ctx.stroke();
  ctx.restore();

  // Corner ornaments
  const ornament = (x: number, y: number, dirX: number, dirY: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(212,175,55,0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dirX * 44, y);
    ctx.lineTo(x + dirX * 44, y + dirY * 44);
    ctx.stroke();
    ctx.restore();
  };
  ornament(boxX + 26, boxY + 26, 1, 1);
  ornament(boxX + box - 26, boxY + 26, -1, 1);
  ornament(boxX + 26, boxY + box - 26, 1, -1);
  ornament(boxX + box - 26, boxY + box - 26, -1, -1);

  if (glyphImg) {
    ctx.save();
    roundRect(ctx, boxX + 58, boxY + 58, box - 116, box - 116, 44);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, boxX + 58, boxY + 58, box - 116, box - 116);
    ctx.restore();
  }

  // Text
  const infoY = boxY + box + 70;
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (simplified) {
    ctx.font = "900 112px 'Noto Serif SC', serif";
    ctx.fillText(simplified, panelX + 66, infoY);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.65;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, panelX + 220, infoY + 66);
    ctx.globalAlpha = 1;
  }
  if (meaning) {
    ctx.globalAlpha = 0.88;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, panelW - 132);
    drawLines(ctx, lines.slice(0, 3), panelX + 66, infoY + 156, 50);
    ctx.globalAlpha = 1;
  }
  if (footer) {
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#6A574B';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, panelX + 66, panelY + panelH - 58);
  }
  ctx.restore();

  if (simplified) drawRedSeal(ctx, simplified.slice(0, 1), panelX + panelW - 98, panelY + panelH - 96, 104, '#C02C38');
}

async function drawCharSeal(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const pad = 72;
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  const footer = formatCharFooter(data);

  // Header
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText('印谱', pad, 64);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(`${INKGRID_BRAND_CN} · 篆字研习`, pad, 118);
  ctx.restore();

  // Big seal
  if (simplified) {
    drawRedSeal(ctx, simplified.slice(0, 1), pad + 190, 380, 300, '#C02C38');
  }

  // Glyph frame
  const frameX = pad + 380;
  const frameY = 230;
  const frameS = 560;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  roundRect(ctx, frameX, frameY, frameS, frameS, 46);
  ctx.fill();
  ctx.strokeStyle = 'rgba(192,44,56,0.35)';
  ctx.lineWidth = 3;
  roundRect(ctx, frameX, frameY, frameS, frameS, 46);
  ctx.stroke();
  ctx.restore();

  if (glyphImg) {
    ctx.save();
    roundRect(ctx, frameX + 46, frameY + 46, frameS - 92, frameS - 92, 40);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, frameX + 46, frameY + 46, frameS - 92, frameS - 92);
    ctx.restore();
  }

  // Extra seals
  drawRedSeal(ctx, '墨', pad + 154, 930, 120, '#C02C38');
  drawRedSeal(ctx, '阵', pad + 294, 930, 120, '#C02C38');

  // Text
  const textX = pad;
  const textY = 1040;
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (simplified) {
    ctx.font = "900 108px 'Noto Serif SC', serif";
    ctx.fillText(simplified, textX, textY);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.65;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, textX + 170, textY + 64);
    ctx.globalAlpha = 1;
  }
  if (meaning) {
    ctx.globalAlpha = 0.9;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, CANVAS_W - pad * 2);
    drawLines(ctx, lines.slice(0, 4), textX, textY + 150, 50);
    ctx.globalAlpha = 1;
  }
  if (footer) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#666';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, textX, CANVAS_H - pad);
  }
  ctx.restore();

  // Side label
  ctx.save();
  ctx.fillStyle = 'rgba(192,44,56,0.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 24px 'Noto Serif SC', serif";
  drawVerticalText(ctx, '朱砂印谱', CANVAS_W - pad + 18, 260, 44);
  ctx.restore();
}

async function drawCharNight(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const pad = 72;
  const glyphImg = await loadImage(data.image, 12000).catch(() => null);
  const simplified = String(data.simplified || '').trim();
  const pinyin = String(data.pinyin || '').trim();
  const meaning = String(data.meaning || '').trim();
  const footer = formatCharFooter(data);

  drawNightDust(ctx, `${simplified}|${data.image}`);

  // Header
  ctx.save();
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, pad, 64);
  ctx.globalAlpha = 0.7;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('乌金 · 夜墨', pad, 122);
  ctx.restore();

  // Glyph
  if (glyphImg) {
    const size = 860;
    const x = (CANVAS_W - size) / 2;
    const y = 220;
    ctx.save();
    ctx.shadowColor = 'rgba(212,175,55,0.18)';
    ctx.shadowBlur = 80;
    ctx.shadowOffsetY = 22;
    ctx.filter = 'invert(1) brightness(1.55) contrast(1.25)';
    ctx.globalAlpha = 0.95;
    drawContainImage(ctx, glyphImg, x, y, size, size);
    ctx.restore();
  }

  const panelX = pad;
  const panelY = 1250;
  const panelW = CANVAS_W - pad * 2;
  const panelH = 620;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 62);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.26)';
  ctx.lineWidth = 2.2;
  roundRect(ctx, panelX + 16, panelY + 16, panelW - 32, panelH - 32, 54);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (simplified) {
    ctx.fillStyle = '#D4AF37';
    ctx.font = "900 108px 'Noto Serif SC', serif";
    ctx.fillText(simplified, panelX + 50, panelY + 44);
  }
  if (pinyin) {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#F2E6CE';
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(pinyin, panelX + 50, panelY + 162);
    ctx.globalAlpha = 1;
  }
  if (meaning) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#F2E6CE';
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, meaning, panelW - 100);
    drawLines(ctx, lines.slice(0, 4), panelX + 50, panelY + 224, 50);
    ctx.globalAlpha = 1;
  }
  if (footer) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#D4AF37';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, panelX + 50, panelY + panelH - 46);
  }
  ctx.restore();

  if (simplified) drawRedSeal(ctx, simplified.slice(0, 1), panelX + panelW - 92, panelY + panelH - 96, 96, '#C02C38');
}

function formatSteleFooter(stele: PosterStele) {
  const bits = [stele.location ? `现藏：${stele.location}` : '', typeof stele.total_chars === 'number' ? `${stele.total_chars} 字` : ''].filter(Boolean);
  return bits.join(' · ');
}

function normalizeSteleText(text: unknown) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeSteleTextTight(text: unknown) {
  return String(text || '').replace(/\s+/g, '').trim();
}

function formatSteleMeta(stele: PosterStele) {
  const bits = [stele.dynasty, stele.author, stele.script_type].filter(Boolean);
  const year = normalizeSteleText(stele.year);
  if (year) bits.push(year);
  return bits.join(' · ');
}

function formatSteleFacts(stele: PosterStele) {
  const bits: string[] = [];
  const t = normalizeSteleText(stele.type);
  if (t) bits.push(t);
  if (typeof stele.total_chars === 'number' && Number.isFinite(stele.total_chars)) bits.push(`${stele.total_chars} 字`);
  const loc = normalizeSteleText(stele.location);
  if (loc) bits.push(loc);
  return bits.join(' · ');
}

function pickSteleQuote(text: string, maxLen = 48) {
  const t = normalizeSteleTextTight(text);
  if (!t) return '';
  const stops = ['。', '；', '！', '？'];
  let end = -1;
  for (const s of stops) {
    const idx = t.indexOf(s);
    if (idx >= 12 && (end === -1 || idx < end)) end = idx;
  }
  const raw = end >= 0 ? t.slice(0, Math.min(end + 1, maxLen + 1)) : t.slice(0, maxLen);
  return raw;
}

function steleExcerpt(stele: PosterStele, maxChars: number) {
  const content = normalizeSteleText(stele.content);
  if (!content) return '';
  if (content.length <= maxChars) return content;
  const slice = content.slice(0, maxChars);
  const punct = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('；'));
  if (punct > Math.floor(maxChars * 0.55)) return slice.slice(0, punct + 1);
  return slice;
}

async function drawSteleFolio(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pageX = 54;
  const pageY = 74;
  const pageW = CANVAS_W - 108;
  const pageH = CANVAS_H - 148;
  drawFolioBinding(ctx, pageX + 18, pageY + 30, pageH - 60);

  const slipW = 78;
  const slipX = pageX + pageW - slipW - 22;
  const slipY = pageY + 210;
  const slipH = 520;
  ctx.save();
  ctx.fillStyle = 'rgba(139, 0, 0, 0.86)';
  roundRect(ctx, slipX, slipY, slipW, slipH, 26);
  ctx.fill();
  ctx.fillStyle = '#F2E6CE';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawVerticalText(ctx, '名帖赏析', slipX + slipW / 2, slipY + 52, 46);
  ctx.restore();

  const contentX = pageX + 18 + 122 + 44;
  const contentRight = slipX - 26;
  const contentW = Math.max(520, contentRight - contentX);
  const paddingTop = pageY + 44;

  // Header
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, contentX, paddingTop);
  ctx.globalAlpha = 0.6;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, contentX, paddingTop + 56);
  ctx.restore();

  const cardX = contentX;
  const cardY = pageY + 210;
  const cardW = contentW;
  const cardH = 1320;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX + 18, cardY + 18, cardW - 36, cardH - 36, 48);
  ctx.stroke();
  ctx.restore();

  const title = normalizeSteleText(stele.name);
  const meta = formatSteleMeta(stele);
  const facts = formatSteleFacts(stele);
  const desc = normalizeSteleText(stele.description);
  const excerptText = steleExcerpt(stele, 1800);
  const quote = pickSteleQuote(excerptText || desc, 54);

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const innerX = cardX + 72;
  const innerW = cardW - 144;
  const cardBottom = cardY + cardH - 72;
  let cursorY = cardY + 72;
  if (title) {
    ctx.font = "900 72px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, title, innerW);
    drawLines(ctx, lines.slice(0, 2), innerX, cursorY, 90);
    cursorY += Math.min(2, lines.length) * 90 + 18;
  }
  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(meta, innerX, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 62;
  }

  if (facts) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#444';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.fillText(facts, innerX, cursorY);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1A1A1A';
    cursorY += 58;
  } else {
    cursorY += 18;
  }

  // Divider
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, cursorY);
  ctx.lineTo(innerX + innerW, cursorY);
  ctx.stroke();
  ctx.restore();
  cursorY += 34;

  // Compact lead-in (description or quote)
  const leadText = desc || quote;
  if (leadText) {
    const leadLabel = desc ? '导读' : '摘句';
    const boxX = innerX;
    const boxY = cursorY;
    const boxW = innerW;
    const boxPad = 26;

    ctx.save();
    ctx.font = "900 22px 'Noto Serif SC', serif";
    const labelW = ctx.measureText(leadLabel).width;
    ctx.restore();

    ctx.save();
    ctx.font = "600 30px 'Noto Serif SC', serif";
    const leadLines = wrapText(ctx, leadText, boxW - boxPad * 2);
    const textLines = leadLines.slice(0, 3);
    const boxH = 22 + 14 + textLines.length * 44 + boxPad * 2;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 32);
    ctx.fill();

    // Accent
    ctx.fillStyle = 'rgba(192,44,56,0.75)';
    ctx.fillRect(boxX + 18, boxY + 22, 4, boxH - 44);

    // Label
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(leadLabel, boxX + boxPad, boxY + boxPad - 2);

    // Text
    ctx.fillStyle = '#1A1A1A';
    ctx.globalAlpha = 0.88;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    drawLines(ctx, textLines, boxX + boxPad, boxY + boxPad + 36, 44);
    ctx.restore();

    cursorY = boxY + boxH + 34;
  }

  const body = excerptText || desc;
  if (body) {
    const bodyLabel = excerptText ? '原文节选' : '简介';
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(bodyLabel, innerX, cursorY);
    ctx.restore();

    const bodyY = cursorY + 40;
    const lineHeight = 46;
    const maxLines = Math.max(0, Math.floor((cardBottom - bodyY) / lineHeight));

    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    ctx.globalAlpha = 0.86;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 30px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, body, innerW);
    drawLines(ctx, lines.slice(0, maxLines), innerX, bodyY, lineHeight);
    ctx.restore();
  }
  ctx.restore();

  const footer = formatSteleFooter(stele);
  if (footer) {
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.globalAlpha = 0.75;
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, contentX, pageY + pageH - 56);
    ctx.restore();
  }
}

async function drawSteleWash(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pad = 80;
  const title = String(stele.name || '').trim();
  const meta = [stele.dynasty, stele.author, stele.script_type].filter(Boolean).join(' · ');
  const excerpt = String(stele.description || stele.content || '').replace(/\s+/g, ' ').trim();
  const footer = formatSteleFooter(stele);

  // Header
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, pad, 64);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('水墨 · 名帖赏析', pad, 118);
  ctx.restore();

  // Brush stroke banner
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = '#2F4F4F';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pad, 280);
  ctx.lineTo(CANVAS_W - pad, 312);
  ctx.stroke();
  ctx.restore();

  // Title
  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 84px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, title, CANVAS_W - pad * 2);
  drawLines(ctx, titleLines.slice(0, 2), pad, 330, 100);
  let cursorY = 330 + Math.min(2, titleLines.length) * 100 + 18;
  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(meta, pad, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 66;
  }

  // Excerpt panel
  const panelX = pad;
  const panelY = 560;
  const panelW = CANVAS_W - pad * 2;
  const panelH = 1180;
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.56)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 60);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.globalAlpha = 0.86;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "600 32px 'Noto Serif SC', serif";
  const lines = wrapText(ctx, excerpt, panelW - 108);
  drawLines(ctx, lines.slice(0, 16), panelX + 54, panelY + 54, 52);
  ctx.restore();

  if (footer) {
    ctx.save();
    ctx.fillStyle = '#2F4F4F';
    ctx.globalAlpha = 0.72;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.fillText(footer, panelX + 54, panelY + panelH - 46);
    ctx.restore();
  }
}

async function drawSteleMinimal(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pad = 72;
  const title = normalizeSteleText(stele.name);
  const meta = formatSteleMeta(stele);
  const facts = formatSteleFacts(stele);
  const desc = normalizeSteleText(stele.description);
  const excerptText = steleExcerpt(stele, 2600);
  const quote = pickSteleQuote(excerptText || desc, 66);
  const footer = formatSteleFooter(stele);

  // Header
  ctx.save();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 34px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, pad, pad);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 22px 'Noto Serif SC', serif";
  ctx.fillText('馆藏展签 · 名帖', pad, pad + 44);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 96);
  ctx.lineTo(CANVAS_W - pad, pad + 96);
  ctx.stroke();
  ctx.restore();

  const cardX = pad;
  const cardY = 240;
  const cardW = CANVAS_W - pad * 2;
  const cardH = CANVAS_H - cardY - pad;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 78px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, title, cardW - 120);
  drawLines(ctx, titleLines.slice(0, 2), cardX + 60, cardY + 60, 96);
  let cursorY = cardY + 60 + Math.min(2, titleLines.length) * 96 + 18;
  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(meta, cardX + 60, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 60;
  }

  if (facts) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#444';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.fillText(facts, cardX + 60, cursorY);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1A1A1A';
    cursorY += 54;
  } else {
    cursorY += 18;
  }

  // Lead-in (description or quote)
  const leadText = desc || quote;
  if (leadText) {
    const boxX = cardX + 60;
    const boxY = cursorY;
    const boxW = cardW - 120;
    const boxPad = 26;

    ctx.save();
    ctx.font = "600 30px 'Noto Serif SC', serif";
    const leadLines = wrapText(ctx, leadText, boxW - boxPad * 2);
    const textLines = leadLines.slice(0, 3);
    const boxH = textLines.length * 44 + boxPad * 2 + 40;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 34);
    ctx.fill();
    ctx.fillStyle = 'rgba(192,44,56,0.75)';
    ctx.fillRect(boxX + 18, boxY + 24, 4, boxH - 48);

    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(desc ? '导读' : '摘句', boxX + boxPad, boxY + boxPad - 2);

    ctx.fillStyle = '#1A1A1A';
    ctx.globalAlpha = 0.88;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    drawLines(ctx, textLines, boxX + boxPad, boxY + boxPad + 36, 44);
    ctx.restore();

    cursorY = boxY + boxH + 34;
  }

  const body = excerptText || desc;
  if (body) {
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(excerptText ? '原文节选' : '简介', cardX + 60, cursorY);
    ctx.restore();

    const startY = cursorY + 40;
    const bottomY = cardY + cardH - 90;
    const gap = 56;
    const colW = Math.floor((cardW - 120 - gap) / 2);
    const col1X = cardX + 60;
    const col2X = col1X + colW + gap;
    const lineHeight = 46;
    const maxLinesPerCol = Math.max(0, Math.floor((bottomY - startY) / lineHeight));

    ctx.save();
    ctx.fillStyle = '#1A1A1A';
    ctx.globalAlpha = 0.86;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 28px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, body, colW);
    const col1 = lines.slice(0, maxLinesPerCol);
    const col2 = lines.slice(maxLinesPerCol, maxLinesPerCol * 2);
    drawLines(ctx, col1, col1X, startY, lineHeight);
    drawLines(ctx, col2, col2X, startY, lineHeight);
    ctx.restore();

    // Column divider
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(col2X - gap / 2, startY - 6);
    ctx.lineTo(col2X - gap / 2, bottomY + 6);
    ctx.stroke();
    ctx.restore();
  }
  if (footer) {
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#666';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, cardX + 60, cardY + cardH - 54);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#C02C38';
  ctx.globalAlpha = 0.72;
  ctx.fillRect(cardX + 44, cardY + 300, 4, 54);
  ctx.restore();
}

async function drawSteleBrocade(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pad = 72;
  const title = String(stele.name || '').trim();
  const meta = [stele.dynasty, stele.author, stele.script_type].filter(Boolean).join(' · ');
  const excerpt = String(stele.description || stele.content || '').replace(/\s+/g, ' ').trim();
  const footer = formatSteleFooter(stele);

  ctx.save();
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, CANVAS_W / 2, 74);
  ctx.globalAlpha = 0.75;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('锦纹 · 名帖', CANVAS_W / 2, 130);
  ctx.restore();

  const panelX = 84;
  const panelY = 210;
  const panelW = CANVAS_W - 168;
  const panelH = CANVAS_H - 360;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = 'rgba(247,242,233,0.94)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 66);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, panelX + 22, panelY + 22, panelW - 44, panelH - 44, 54);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 78px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, title, panelW - 132);
  drawLines(ctx, titleLines.slice(0, 2), panelX + 66, panelY + 90, 96);
  let cursorY = panelY + 90 + Math.min(2, titleLines.length) * 96 + 16;
  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    ctx.fillText(meta, panelX + 66, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 70;
  }
  if (excerpt) {
    ctx.globalAlpha = 0.86;
    ctx.font = "600 32px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, excerpt, panelW - 132);
    drawLines(ctx, lines.slice(0, 18), panelX + 66, cursorY, 52);
    ctx.globalAlpha = 1;
  }
  if (footer) {
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#6A574B';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, panelX + 66, panelY + panelH - 58);
  }
  ctx.restore();

  drawRedSeal(ctx, '帖', panelX + panelW - 98, panelY + panelH - 96, 104, '#C02C38');
}

async function drawSteleSeal(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pad = 72;
  const title = String(stele.name || '').trim();
  const meta = [stele.dynasty, stele.author, stele.script_type].filter(Boolean).join(' · ');
  const excerpt = String(stele.description || stele.content || '').replace(/\s+/g, ' ').trim();
  const footer = formatSteleFooter(stele);

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText('印谱', pad, 64);
  ctx.globalAlpha = 0.55;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText(`${INKGRID_BRAND_CN} · 名帖`, pad, 118);
  ctx.restore();

  drawRedSeal(ctx, '帖', pad + 190, 380, 300, '#C02C38');
  drawRedSeal(ctx, '墨', pad + 154, 930, 120, '#C02C38');
  drawRedSeal(ctx, '阵', pad + 294, 930, 120, '#C02C38');

  const cardX = pad + 380;
  const cardY = 230;
  const cardW = CANVAS_W - cardX - pad;
  const cardH = 840;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 46);
  ctx.fill();
  ctx.strokeStyle = 'rgba(192,44,56,0.35)';
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardH, 46);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 64px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, title, cardW - 96);
  drawLines(ctx, titleLines.slice(0, 2), cardX + 48, cardY + 56, 82);
  let cursorY = cardY + 56 + Math.min(2, titleLines.length) * 82 + 14;
  if (meta) {
    ctx.globalAlpha = 0.7;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(meta, cardX + 48, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 64;
  }
  if (excerpt) {
    ctx.globalAlpha = 0.86;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, excerpt, cardW - 96);
    drawLines(ctx, lines.slice(0, 12), cardX + 48, cursorY, 48);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Footer
  if (footer) {
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.fillText(footer, pad, CANVAS_H - pad);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(192,44,56,0.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 24px 'Noto Serif SC', serif";
  drawVerticalText(ctx, '朱砂印谱', CANVAS_W - pad + 18, 260, 44);
  ctx.restore();
}

async function drawSteleNight(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const pad = 72;
  const title = normalizeSteleText(stele.name);
  const meta = formatSteleMeta(stele);
  const facts = formatSteleFacts(stele);
  const desc = normalizeSteleText(stele.description);
  const excerptText = steleExcerpt(stele, 3200);
  const quote = pickSteleQuote(excerptText || desc, 72);
  const footer = formatSteleFooter(stele);

  drawNightDust(ctx, `${title}|${meta}`);

  ctx.save();
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "900 44px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, pad, 64);
  ctx.globalAlpha = 0.7;
  ctx.font = "600 24px 'Noto Serif SC', serif";
  ctx.fillText('乌金 · 名帖', pad, 122);
  ctx.restore();

  const panelX = pad;
  const panelY = 240;
  const panelW = CANVAS_W - pad * 2;
  const panelH = CANVAS_H - panelY - pad;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 62);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.26)';
  ctx.lineWidth = 2.2;
  roundRect(ctx, panelX + 16, panelY + 16, panelW - 32, panelH - 32, 54);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#F2E6CE';
  ctx.font = "900 84px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, title, panelW - 100);
  drawLines(ctx, titleLines.slice(0, 2), panelX + 50, panelY + 60, 98);
  let cursorY = panelY + 60 + Math.min(2, titleLines.length) * 98 + 12;
  if (meta) {
    ctx.globalAlpha = 0.75;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    ctx.fillText(meta, panelX + 50, cursorY);
    ctx.globalAlpha = 1;
    cursorY += 64;
  }

  if (facts) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#D4AF37';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.fillText(facts, panelX + 50, cursorY);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#F2E6CE';
    cursorY += 56;
  } else {
    cursorY += 18;
  }

  // Divider
  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 50, cursorY);
  ctx.lineTo(panelX + panelW - 50, cursorY);
  ctx.stroke();
  ctx.restore();
  cursorY += 34;

  const leadText = desc || quote;
  if (leadText) {
    const boxX = panelX + 50;
    const boxY = cursorY;
    const boxW = panelW - 100;
    const boxPad = 26;

    ctx.save();
    ctx.font = "600 30px 'Noto Serif SC', serif";
    const leadLines = wrapText(ctx, leadText, boxW - boxPad * 2);
    const textLines = leadLines.slice(0, 3);
    const boxH = textLines.length * 44 + boxPad * 2 + 40;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.22)';
    ctx.lineWidth = 2;
    roundRect(ctx, boxX + 14, boxY + 14, boxW - 28, boxH - 28, 28);
    ctx.stroke();

    ctx.fillStyle = '#D4AF37';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(desc ? '导读' : '摘句', boxX + boxPad, boxY + boxPad - 2);

    ctx.fillStyle = '#F2E6CE';
    ctx.globalAlpha = 0.9;
    ctx.font = "600 30px 'Noto Serif SC', serif";
    drawLines(ctx, textLines, boxX + boxPad, boxY + boxPad + 36, 44);
    ctx.restore();

    cursorY = boxY + boxH + 34;
  }

  const body = excerptText || desc;
  if (body) {
    ctx.save();
    ctx.fillStyle = '#D4AF37';
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "900 22px 'Noto Serif SC', serif";
    ctx.fillText(excerptText ? '原文节选' : '简介', panelX + 50, cursorY);
    ctx.restore();

    const startY = cursorY + 40;
    const bottomY = panelY + panelH - 170;
    const gap = 64;
    const colW = Math.floor((panelW - 100 - gap) / 2);
    const col1X = panelX + 50;
    const col2X = col1X + colW + gap;
    const lineHeight = 46;
    const maxLinesPerCol = Math.max(0, Math.floor((bottomY - startY) / lineHeight));

    ctx.save();
    ctx.fillStyle = '#F2E6CE';
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 28px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, body, colW);
    const col1 = lines.slice(0, maxLinesPerCol);
    const col2 = lines.slice(maxLinesPerCol, maxLinesPerCol * 2);
    drawLines(ctx, col1, col1X, startY, lineHeight);
    drawLines(ctx, col2, col2X, startY, lineHeight);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(212,175,55,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(col2X - gap / 2, startY - 6);
    ctx.lineTo(col2X - gap / 2, bottomY + 6);
    ctx.stroke();
    ctx.restore();
  }
  if (footer) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#D4AF37';
    ctx.font = "600 26px 'Noto Serif SC', serif";
    ctx.textBaseline = 'bottom';
    ctx.fillText(footer, panelX + 50, panelY + panelH - 46);
  }
  ctx.restore();

  drawRedSeal(ctx, '帖', panelX + panelW - 92, panelY + panelH - 96, 96, '#C02C38');
}
