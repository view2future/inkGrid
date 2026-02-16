import QRCode from 'qrcode';

export type PosterTemplate = 'folio' | 'wash' | 'minimal';
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.decoding = 'async'; img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => { if (!blob) { reject(new Error('Failed to create blob')); return; } resolve(blob); }, 'image/png');
  });
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
  const sW = 600, sH = 1200, sX = (CANVAS_W - sW) / 2, sY = 320;
  ctx.save(); ctx.fillStyle = '#C0C8C8'; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.fillRect(sX - 30, sY - 30, sW + 60, sH + 60); ctx.fillStyle = '#F7F9FA'; ctx.fillRect(sX, sY, sW, sH); ctx.restore();
  await drawStandardHeader(env, '#2F4F4F'); if (glyphImg) { drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-520)/2, sY + 60, 520); drawRedSeal(ctx, input.glyph.simplified || '', sX + sW - 80, sY + 100, 90); }
  drawStandardFooter(env, sY + 680, '#2F2F2F');
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
async function drawSceneNY07_Human(env: SceneEnv) {
  const { ctx, noiseImg, glyphImg, input } = env; drawTextureBackground(ctx, '#F7F9F5', noiseImg, 0.1);
  ctx.save(); ctx.fillStyle = 'rgba(50, 80, 50, 0.04)'; ctx.beginPath(); ctx.moveTo(CANVAS_W, 100); ctx.lineTo(CANVAS_W - 300, 400); ctx.lineTo(CANVAS_W, 700); ctx.fill(); ctx.restore();
  await drawStandardHeader(env, '#555'); if (glyphImg) { ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.arc(CANVAS_W/2, 650, 450, 0, Math.PI*2); ctx.stroke(); ctx.restore(); drawFloatingInkGlyph(ctx, glyphImg, (CANVAS_W-650)/2, 325, 650); drawRedSeal(ctx, input.glyph.simplified || '', CANVAS_W/2 + 220, 850, 90, '#C02C38'); }
  drawStandardFooter(env, 1320, '#333'); await drawFooterQR(env, CANVAS_W - 192, CANVAS_H - 180, '#333');
}

// --- MAIN ENTRYPOINT & EXPORTS ---

export async function renderPosterPng(input: PosterInput, options: RenderPosterOptions = {}) {
  const canvas = document.createElement('canvas');
  const scale = typeof options.scale === 'number' ? Math.max(0.25, Math.min(1, options.scale)) : 1;
  const pixelRatio = options.pixelRatio || 2;
  canvas.width = Math.round(CANVAS_W * pixelRatio * scale); canvas.height = Math.round(CANVAS_H * pixelRatio * scale);
  const ctx = canvas.getContext('2d')!; ctx.scale(pixelRatio * scale, pixelRatio * scale);
  const noiseImg = await loadImage('/noise.png').catch(() => null);
  if (input.template === 'folio') { drawFolioBase(ctx, noiseImg); if (input.kind === 'char') await drawCharFolio(ctx, input.data); else await drawSteleFolio(ctx, input.data); }
  else if (input.template === 'wash') { drawWashBase(ctx, noiseImg); if (input.kind === 'char') await drawCharWash(ctx, input.data); else await drawSteleWash(ctx, input.data); }
  else if (input.template === 'minimal') { drawMinimalBase(ctx, noiseImg); if (input.kind === 'char') await drawCharMinimal(ctx, input.data); else await drawSteleMinimal(ctx, input.data); }
  const blob = await canvasToBlob(canvas); return { blob, width: CANVAS_W, height: CANVAS_H };
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
  const canvas = document.createElement('canvas');
  const scale = options.scale || 1; const pixelRatio = options.pixelRatio || 2;
  canvas.width = Math.round(CANVAS_W * pixelRatio * scale); canvas.height = Math.round(CANVAS_H * pixelRatio * scale);
  const ctx = canvas.getContext('2d')!; ctx.scale(pixelRatio * scale, pixelRatio * scale);
  const [noiseImg, logoImg, glyphImg] = await Promise.all([loadImage('/noise.png').catch(() => null), loadBrandLogo().catch(() => null), loadImage(input.glyph.image).catch(() => null)]);
  const env: SceneEnv = { ctx, input, noiseImg, logoImg, glyphImg };
  switch (input.id) {
    case 'ny_08': await drawSceneNY08_Eve(env); break; case 'ny_01': await drawSceneNY01_Spring(env); break; case 'ny_02': await drawSceneNY02_Home(env); break; case 'ny_03': await drawSceneNY03_Quiet(env); break;
    case 'ny_04': await drawSceneNY04_Stove(env); break; case 'ny_05': await drawSceneNY05_Wealth(env); break; case 'ny_06': await drawSceneNY06_Travel(env); break; case 'ny_07': await drawSceneNY07_Human(env); break;
    default: await drawSceneNY01_Spring(env); break;
  }
  const blob = await canvasToBlob(canvas); return { blob, width: CANVAS_W, height: CANVAS_H };
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

// --- LEGACY ---
function drawFolioBase(ctx: any, n: any) { ctx.fillStyle = '#F6F1E7'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }
function drawWashBase(ctx: any, n: any) { ctx.fillStyle = '#F7F2E9'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }
function drawMinimalBase(ctx: any, n: any) { ctx.fillStyle = '#FFF'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }
async function drawCharFolio(ctx: any, data: any) { ctx.font="900 140px serif"; ctx.fillText(data.simplified||'',72,1220); }
async function drawSteleFolio(ctx: any, stele: any) { ctx.font="900 96px serif"; ctx.fillText(stele.name,72,300); }
async function drawCharWash(ctx: any, data: any) { ctx.font="900 144px serif"; ctx.fillText(data.simplified||'',72,1260); }
async function drawSteleWash(ctx: any, stele: any) { ctx.font="900 104px serif"; ctx.fillText(stele.name,72,300); }
async function drawCharMinimal(ctx: any, data: any) { ctx.font="900 160px serif"; ctx.fillText(data.simplified||'',72,540); }
async function drawSteleMinimal(ctx: any, stele: any) { ctx.font="900 96px serif"; ctx.fillText(stele.name,72,300); }
