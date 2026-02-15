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
const INKGRID_GOLD = '#B8860B';

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
  yearLabel?: string;
  dayLabel: string;
  caption: string;
  date?: string;
  glyph: {
    simplified?: string;
    image: string;
    index?: number;
    source?: string;
  };
};

const CANVAS_W = 1080;
const CANVAS_H = 1920;

export async function renderPosterPng(input: PosterInput, options: RenderPosterOptions = {}) {
  const canvas = document.createElement('canvas');

  const scale = typeof options.scale === 'number' ? Math.max(0.25, Math.min(1, options.scale)) : 1;
  const pixelRatio =
    typeof options.pixelRatio === 'number' && options.pixelRatio > 0
      ? options.pixelRatio
      : Math.max(2, Math.floor(window.devicePixelRatio || 1));

  canvas.width = Math.round(CANVAS_W * pixelRatio * scale);
  canvas.height = Math.round(CANVAS_H * pixelRatio * scale);

  const ctxMaybe = canvas.getContext('2d');
  if (!ctxMaybe) throw new Error('Canvas not supported');
  const ctx = ctxMaybe;
  ctx.scale(pixelRatio * scale, pixelRatio * scale);

  const noiseImg = await loadImage('/noise.png').catch(() => null);

  if (input.template === 'folio') {
    drawFolioBase(ctx, noiseImg);
    if (input.kind === 'char') await drawCharFolio(ctx, input.data);
    else await drawSteleFolio(ctx, input.data);
  }

  if (input.template === 'wash') {
    drawWashBase(ctx, noiseImg);
    if (input.kind === 'char') await drawCharWash(ctx, input.data);
    else await drawSteleWash(ctx, input.data);
  }

  if (input.template === 'minimal') {
    drawMinimalBase(ctx, noiseImg);
    if (input.kind === 'char') await drawCharMinimal(ctx, input.data);
    else await drawSteleMinimal(ctx, input.data);
  }

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    width: Math.round(CANVAS_W * scale),
    height: Math.round(CANVAS_H * scale),
  };
}

export async function renderCuratedCollagePng(input: CuratedCollageInput, options: RenderPosterOptions = {}) {
  const canvas = document.createElement('canvas');

  const scale = typeof options.scale === 'number' ? Math.max(0.25, Math.min(1, options.scale)) : 1;
  const pixelRatio =
    typeof options.pixelRatio === 'number' && options.pixelRatio > 0
      ? options.pixelRatio
      : Math.max(2, Math.floor(window.devicePixelRatio || 1));

  canvas.width = Math.round(CANVAS_W * pixelRatio * scale);
  canvas.height = Math.round(CANVAS_H * pixelRatio * scale);

  const ctxMaybe = canvas.getContext('2d');
  if (!ctxMaybe) throw new Error('Canvas not supported');
  const ctx = ctxMaybe;
  ctx.scale(pixelRatio * scale, pixelRatio * scale);

  const noiseImg = await loadImage('/noise.png').catch(() => null);

  // --- 桌面底色：参考“故宫日历-多个平铺”氛围 ---
  const desk = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  desk.addColorStop(0, '#B78B52');
  desk.addColorStop(0.55, '#A57A46');
  desk.addColorStop(1, '#8C6537');
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const vignette = ctx.createRadialGradient(CANVAS_W * 0.55, CANVAS_H * 0.25, 0, CANVAS_W * 0.55, CANVAS_H * 0.25, 1200);
  vignette.addColorStop(0, 'rgba(255,255,255,0.15)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }

  const padding = 72;
  const plateX = 48;
  const plateY = 48;
  const plateW = CANVAS_W - 96;
  const plateH = 240;

  // header plate
  ctx.save();
  ctx.fillStyle = 'rgba(246,241,231,0.90)';
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 26;
  roundRect(ctx, plateX, plateY, plateW, plateH, 48);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  roundRect(ctx, plateX, plateY, plateW, plateH, 48);
  ctx.stroke();
  ctx.restore();

  await drawBrandHeader(ctx, plateX + 44, plateY + 34, { tag: input.title?.trim() || '典藏画册' });

  if (input.subtitle) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "800 22px 'Noto Serif SC', serif";
    const lines = wrapText(ctx, input.subtitle.trim(), plateW - 88);
    drawLines(ctx, lines.slice(0, 2), plateX + 44, plateY + 188, 30);
  }

  const cards = (input.cards || []).filter((c) => c.image).slice(0, 8);
  const cardW = 340;
  const cardH = 480;
  const thickness = 28;
  const dx = thickness;
  const dy = Math.round(thickness * 0.62);
  const radius = 34;

  const tones = ['#F6F1E7', '#F4EFE5', '#F8F3EA', '#F1E8DA'];
  const glyphStyles = [
    { scale: 1.12, ox: -18, oy: 10 },
    { scale: 0.98, ox: 0, oy: 0 },
    { scale: 1.18, ox: 14, oy: -18 },
    { scale: 1.08, ox: 22, oy: 16 },
    { scale: 1.22, ox: -10, oy: -22 },
    { scale: 1.04, ox: -24, oy: 6 },
    { scale: 1.16, ox: 8, oy: 24 },
    { scale: 1.10, ox: 26, oy: -8 },
  ];

  const placements = [
    { x: -26, y: 320 },
    { x: 360, y: 300 },
    { x: 730, y: 346 },
    { x: 72, y: 820 },
    { x: 430, y: 784 },
    { x: 780, y: 860 },
    { x: -10, y: 1310 },
    { x: 360, y: 1280 },
  ];

  function drawCoverImage(ctx2: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, scaleMul: number, ox: number, oy: number) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) return;
    const s = Math.max(w / sw, h / sh) * scaleMul;
    const dw = sw * s;
    const dh = sh * s;
    const dx2 = x + (w - dw) / 2 + ox;
    const dy2 = y + (h - dh) / 2 + oy;
    ctx2.drawImage(img, dx2, dy2, dw, dh);
  }

  async function drawBookCard(c: { simplified?: string; image: string }, x: number, y: number, tone: string, style: { scale: number; ox: number; oy: number }) {
    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.filter = 'blur(26px)';
    roundRect(ctx, x + 18, y + 22, cardW + dx, cardH + dy, radius);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // thickness faces
    ctx.save();
    // right face
    ctx.fillStyle = 'rgba(233,221,200,0.96)';
    ctx.beginPath();
    ctx.moveTo(x + cardW, y + radius);
    ctx.lineTo(x + cardW + dx, y + radius + dy);
    ctx.lineTo(x + cardW + dx, y + cardH - radius + dy);
    ctx.lineTo(x + cardW, y + cardH - radius);
    ctx.closePath();
    ctx.fill();

    // bottom face
    ctx.fillStyle = 'rgba(217,200,170,0.96)';
    ctx.beginPath();
    ctx.moveTo(x + radius, y + cardH);
    ctx.lineTo(x + cardW - radius, y + cardH);
    ctx.lineTo(x + cardW - radius + dx, y + cardH + dy);
    ctx.lineTo(x + radius + dx, y + cardH + dy);
    ctx.closePath();
    ctx.fill();

    // top face
    ctx.fillStyle = tone;
    roundRect(ctx, x, y, cardW, cardH, radius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(17,24,39,0.12)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, cardW, cardH, radius);
    ctx.stroke();

    // subtle paper texture
    if (noiseImg) {
      const p = ctx.createPattern(noiseImg, 'repeat');
      if (p) {
        ctx.save();
        roundRect(ctx, x, y, cardW, cardH, radius);
        ctx.clip();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = p;
        ctx.fillRect(x, y, cardW, cardH);
        ctx.restore();
      }
    }

    // spine strip
    ctx.fillStyle = 'rgba(139,0,0,0.12)';
    roundRect(ctx, x + 18, y + 18, 22, cardH - 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,0,0,0.18)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 18, y + 18, 22, cardH - 36, 18);
    ctx.stroke();

    // simplified badge
    const s = String(c.simplified || '').trim();
    if (s) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      roundRect(ctx, x + cardW - 112, y + 22, 88, 54, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(17,24,39,0.10)';
      ctx.lineWidth = 2;
      roundRect(ctx, x + cardW - 112, y + 22, 88, 54, 16);
      ctx.stroke();
      ctx.fillStyle = 'rgba(17,24,39,0.90)';
      ctx.font = "900 34px 'Noto Serif SC', serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x + cardW - 112 + 44, y + 22 + 29);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // glyph (clip to top face)
    const img = await loadImage(c.image).catch(() => null);
    if (img) {
      ctx.save();
      roundRect(ctx, x, y, cardW, cardH, radius);
      ctx.clip();
      ctx.globalAlpha = 0.96;
      ctx.filter = 'contrast(1.12) brightness(1.06)';
      drawCoverImage(ctx, img, x + 40, y + 96, cardW - 80, cardH - 180, style.scale, style.ox, style.oy);
      ctx.filter = 'none';
      ctx.restore();
    }

    // footer
    ctx.fillStyle = 'rgba(17,24,39,0.50)';
    ctx.font = "900 18px 'Noto Serif SC', serif";
    ctx.fillText(INKGRID_BRAND_CN, x + 44, y + cardH - 44);
    ctx.fillStyle = 'rgba(17,24,39,0.38)';
    ctx.font = "800 16px 'Noto Serif SC', serif";
    ctx.fillText(INKGRID_SLOGAN_CN, x + 44, y + cardH - 18);
    ctx.restore();
  }

  for (let i = 0; i < cards.length; i++) {
    const p = placements[i % placements.length];
    const tone = tones[i % tones.length];
    const st = glyphStyles[i % glyphStyles.length];
    await drawBookCard(cards[i], p.x, p.y, tone, st);
  }

  // QR footer (right-lower desk corner)
  const qrSize = 190;
  const qrX = CANVAS_W - padding - qrSize;
  const qrY = CANVAS_H - padding - qrSize;
  ctx.save();
  ctx.fillStyle = 'rgba(246,241,231,0.86)';
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 22;
  roundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 34);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 2;
  roundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 34);
  ctx.stroke();
  ctx.restore();

  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    width: Math.round(CANVAS_W * scale),
    height: Math.round(CANVAS_H * scale),
  };
}

export async function renderNewYearPosterPng(input: NewYearPosterInput, options: RenderPosterOptions = {}) {
  const canvas = document.createElement('canvas');

  const scale = typeof options.scale === 'number' ? Math.max(0.25, Math.min(1, options.scale)) : 1;
  const pixelRatio =
    typeof options.pixelRatio === 'number' && options.pixelRatio > 0
      ? options.pixelRatio
      : Math.max(2, Math.floor(window.devicePixelRatio || 1));

  canvas.width = Math.round(CANVAS_W * pixelRatio * scale);
  canvas.height = Math.round(CANVAS_H * pixelRatio * scale);

  const ctxMaybe = canvas.getContext('2d');
  if (!ctxMaybe) throw new Error('Canvas not supported');
  const ctx = ctxMaybe;
  ctx.scale(pixelRatio * scale, pixelRatio * scale);

  const noiseImg = await loadImage('/noise.png').catch(() => null);

  // base paper
  ctx.fillStyle = '#F6F1E7';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const redWash = ctx.createRadialGradient(CANVAS_W * 0.22, CANVAS_H * 0.16, 0, CANVAS_W * 0.22, CANVAS_H * 0.16, 820);
  redWash.addColorStop(0, 'rgba(139,0,0,0.18)');
  redWash.addColorStop(1, 'rgba(139,0,0,0)');
  ctx.fillStyle = redWash;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const warm = ctx.createRadialGradient(CANVAS_W * 0.85, CANVAS_H * 0.68, 0, CANVAS_W * 0.85, CANVAS_H * 0.68, 980);
  warm.addColorStop(0, 'rgba(184,134,11,0.12)');
  warm.addColorStop(1, 'rgba(184,134,11,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }

  const padding = 72;
  await drawBrandHeader(ctx, padding, 72, { tag: (input.yearLabel || '馬年').trim() });

  const frameX = padding;
  const frameY = 250;
  const frameW = CANVAS_W - padding * 2;
  const frameH = 1200;
  const r = 64;

  // frame
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  roundRect(ctx, frameX, frameY, frameW, frameH, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, frameX, frameY, frameW, frameH, r);
  ctx.stroke();
  ctx.restore();

  const glyphImg = await loadImage(input.glyph.image).catch(() => null);
  if (glyphImg) {
    const clipPad = 10;
    ctx.save();
    roundRect(ctx, frameX + clipPad, frameY + clipPad, frameW - clipPad * 2, frameH - clipPad * 2, r - 10);
    ctx.clip();

    // subtle paper texture background
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.04;
    const tileW = frameW * 0.38;
    const tileH = frameH * 0.38;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const x = frameX + frameW * 0.10 + col * (tileW + frameW * 0.05) + (row % 2 ? 16 : -8);
        const y = frameY + frameH * 0.06 + row * (tileH + frameH * 0.05);
        drawContainImage(ctx, glyphImg, x, y, tileW, tileH);
      }
    }
    ctx.restore();

    // main glyph - sharper rendering
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    const mainW = frameW * 0.88;
    const mainH = frameH * 0.88;
    const x = frameX + (frameW - mainW) / 2;
    const y = frameY + (frameH - mainH) / 2 - 10;
    drawCoverImage(ctx, glyphImg, x, y, mainW, mainH, 1.0, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  // day text
  const day = String(input.dayLabel || '').trim();
  const caption = String(input.caption || '').trim();
  const simplified = String(input.glyph.simplified || '').trim();
  const baseY = frameY + frameH + 100;

  ctx.fillStyle = '#111827';
  ctx.font = "900 120px 'Noto Serif SC', serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (day) ctx.fillText(day, padding, baseY);

  if (caption) {
    ctx.fillStyle = 'rgba(17,24,39,0.68)';
    ctx.font = "800 46px 'Noto Serif SC', serif";
    ctx.fillText(caption, padding, baseY + 80);
  }

  if (simplified) {
    ctx.save();
    ctx.fillStyle = 'rgba(139,0,0,0.10)';
    roundRect(ctx, padding, baseY + 116, 140, 74, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,0,0,0.22)';
    ctx.lineWidth = 2;
    roundRect(ctx, padding, baseY + 116, 140, 74, 24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(17,24,39,0.92)';
    ctx.font = "900 52px 'Noto Serif SC', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(simplified, padding + 70, baseY + 116 + 39);
    ctx.restore();
  }

  if (input.date) {
    ctx.fillStyle = 'rgba(17,24,39,0.52)';
    ctx.font = "700 24px 'Fira Code', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(input.date, padding, baseY + 230);
  }

  if (input.glyph.source || input.glyph.index) {
    const sourceText = input.glyph.source || '嶧山刻石 · 李斯';
    const indexText = input.glyph.index ? `第 ${input.glyph.index} 字` : '';
    ctx.save();
    ctx.fillStyle = 'rgba(139,0,0,0.08)';
    const infoW = 380;
    const infoH = 56;
    roundRect(ctx, padding, baseY + 280, infoW, infoH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,0,0,0.18)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, padding, baseY + 280, infoW, infoH, 20);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(139,0,0,0.72)';
    ctx.font = "700 22px 'Noto Serif SC', serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sourceText, padding + 20, baseY + 280 + infoH/2);
    
    if (indexText) {
      ctx.fillStyle = 'rgba(17,24,39,0.44)';
      ctx.font = "800 20px 'Fira Code', monospace";
      ctx.textAlign = 'right';
      ctx.fillText(indexText, padding + infoW - 20, baseY + 280 + infoH/2);
    }
    ctx.restore();
  }

  const qrSize = 200;
  const qrX = CANVAS_W - padding - qrSize;
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, qrX + qrSize / 2, 260, qrY - 150);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    width: Math.round(CANVAS_W * scale),
    height: Math.round(CANVAS_H * scale),
  };
}

async function drawQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, INKGRID_QR_URL, {
    width: size,
    margin: 1,
    color: {
      dark: '#111111',
      light: '#00000000',
    },
  });
  ctx.drawImage(qrCanvas, x, y, size, size);
}

function drawFolioBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  ctx.fillStyle = '#F6F1E7';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const rightW = 300;
  ctx.fillStyle = '#FBF7EF';
  ctx.fillRect(CANVAS_W - rightW, 0, rightW, CANVAS_H);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(CANVAS_W - rightW, 0, 1, CANVAS_H);

  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(241,232,218,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }
}

function drawWashBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  ctx.fillStyle = '#F7F2E9';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const wash1 = ctx.createRadialGradient(CANVAS_W * 0.15, CANVAS_H * 0.18, 0, CANVAS_W * 0.15, CANVAS_H * 0.18, 520);
  wash1.addColorStop(0, 'rgba(17,24,39,0.12)');
  wash1.addColorStop(1, 'rgba(17,24,39,0)');
  ctx.fillStyle = wash1;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const wash2 = ctx.createRadialGradient(CANVAS_W * 0.9, CANVAS_H * 0.76, 0, CANVAS_W * 0.9, CANVAS_H * 0.76, 640);
  wash2.addColorStop(0, 'rgba(139,0,0,0.10)');
  wash2.addColorStop(1, 'rgba(139,0,0,0)');
  ctx.fillStyle = wash2;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(242,233,219,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }
}

function drawMinimalBase(ctx: CanvasRenderingContext2D, noiseImg: HTMLImageElement | null) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (noiseImg) {
    const p = ctx.createPattern(noiseImg, 'repeat');
    if (p) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }
}

async function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: {
    tag?: string;
    tagAlign?: 'right' | 'left';
  } = {}
) {
  const logoSize = 56;
  const logo = await loadBrandLogo().catch(() => null);

  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawContainImage(ctx, logo, x, y, logoSize, logoSize);
    ctx.restore();
  }

  const textX = x + (logo ? logoSize + 22 : 0);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111827';
  ctx.font = "900 56px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, textX, y + 52);
  ctx.fillStyle = 'rgba(17,24,39,0.62)';
  ctx.font = "800 26px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, textX, y + 92);
  ctx.restore();

  if (opts.tag) {
    const tagText = String(opts.tag).trim();
    if (tagText) {
      ctx.save();
      const padX = 18;
      const padY = 10;
      ctx.font = "900 20px 'Noto Serif SC', serif";
      const w = Math.ceil(ctx.measureText(tagText).width);
      const pillW = w + padX * 2;
      const pillH = 44;
      const pillX = opts.tagAlign === 'left' ? x : CANVAS_W - x - pillW;
      const pillY = y + 6;

      ctx.fillStyle = 'rgba(139,0,0,0.10)';
      roundRect(ctx, pillX, pillY, pillW, pillH, 999);
      ctx.fill();
      ctx.strokeStyle = 'rgba(139,0,0,0.22)';
      ctx.lineWidth = 2;
      roundRect(ctx, pillX, pillY, pillW, pillH, 999);
      ctx.stroke();

      ctx.fillStyle = 'rgba(139,0,0,0.86)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, pillX + pillW / 2, pillY + pillH / 2 + 1);
      ctx.restore();
    }
  }
}

function drawGoldFoilText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const t = String(text || '').trim();
  if (!t) return;

  const w = Math.max(1, ctx.measureText(t).width);
  const g = ctx.createLinearGradient(x, y - 26, x + w, y + 6);
  g.addColorStop(0, '#6B4E00');
  g.addColorStop(0.18, '#B8860B');
  g.addColorStop(0.45, '#F2E6CE');
  g.addColorStop(0.68, '#B8860B');
  g.addColorStop(1, '#4A3500');

  ctx.save();
  ctx.fillStyle = g;
  ctx.fillText(t, x, y);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeText(t, x, y);
  ctx.restore();
}

function drawUrlLabelAboveQr(ctx: CanvasRenderingContext2D, qrX: number, qrY: number, qrSize: number) {
  const label = INKGRID_QR_LABEL;
  ctx.save();
  ctx.font = "800 30px 'Fira Code', monospace";
  const w = Math.ceil(ctx.measureText(label).width);
  const padX = 22;
  const pillW = w + padX * 2;
  const pillH = 60;
  const xRaw = qrX + (qrSize - pillW) / 2;
  const x = Math.max(24, Math.min(CANVAS_W - pillW - 24, xRaw));
  const y = qrY - pillH - 18;

  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(17,24,39,0.92)';
  roundRect(ctx, x, y, pillW, pillH, 999);
  ctx.fill();

  ctx.shadowBlur = 0;
  const gloss = ctx.createLinearGradient(0, y, 0, y + pillH);
  gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
  gloss.addColorStop(0.55, 'rgba(255,255,255,0.04)');
  gloss.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = gloss;
  roundRect(ctx, x, y, pillW, pillH, 999);
  ctx.fill();

  ctx.strokeStyle = 'rgba(184,134,11,0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, pillW, pillH, 999);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#F2E6CE';
  ctx.fillText(label, x + padX, y + pillH / 2 + 1);
  ctx.restore();
}

function drawVerticalMotto(ctx: CanvasRenderingContext2D, xCenter: number, topY: number, bottomY: number) {
  const motto = INKGRID_SLOGAN_CN.replace(/\s+/g, '').replace(/\./g, '·');
  const units = Array.from(motto);
  if (!units.length) return;

  const lineHeight = 46;
  const totalH = units.length * lineHeight;
  const y0 = topY + Math.max(0, (bottomY - topY - totalH) / 2);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = "900 30px 'Noto Serif SC', serif";
  ctx.fillStyle = 'rgba(184,134,11,0.45)';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 12;

  let y = y0;
  for (const u of units) {
    ctx.fillText(u, xCenter, y);
    y += lineHeight;
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function drawCharFolio(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const rightX = CANVAS_W - 300;
  const padding = 72;
  const mainW = rightX - padding * 2;

  await drawBrandHeader(ctx, padding, 72, { tag: '篆字研习' });

  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 200);
  ctx.lineTo(rightX - padding, 200);
  ctx.stroke();

  const charImg = await loadImage(data.image);
  drawContainImage(ctx, charImg, padding, 226, mainW, 920);

  const simplified = (data.simplified || '').trim() || '字';
  const pinyin = (data.pinyin || '').trim();
  const meaning = (data.meaning || '').trim();
  const enWord = (data.en_word || '').trim();
  const enMeaning = (data.en_meaning || '').trim();
  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';

  ctx.fillStyle = '#111827';
  ctx.font = "900 140px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1220);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 32px 'Fira Code', monospace";
  if (pinyin) ctx.fillText(pinyin, padding, 1280);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 42px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, meaning || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 3), padding, 1360, 52);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  const meta = `出处：${sourceTitle}   作者：${dynasty}·${author}`;
  drawLines(ctx, wrapText(ctx, meta, mainW), padding, 1510, 36);

  if (enWord || enMeaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "700 24px 'Fira Code', monospace";
    const en = `${enWord}${enWord && enMeaning ? ' — ' : ''}${enMeaning}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1620, 36);
  }

  const qrSize = 190;
  const qrX = rightX + Math.round((300 - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + 150, 240, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawSteleFolio(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const rightX = CANVAS_W - 300;
  const padding = 72;
  const mainW = rightX - padding * 2;

  await drawBrandHeader(ctx, padding, 72, { tag: '名帖赏析' });

  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 200);
  ctx.lineTo(rightX - padding, 200);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = "900 96px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 300, 98);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 28px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 470);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 40px 'Noto Serif SC', serif";
  const desc = (stele.description || '').trim();
  const descLines = wrapText(ctx, desc || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 6), padding, 580, 52);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 26px 'Fira Code', monospace";
  const meta1 = `藏地：${stele.location}`;
  const meta2 = `规模：${stele.total_chars} 字`;
  ctx.fillText(meta1, padding, 960);
  ctx.fillText(meta2, padding, 1000);

  const excerpt = (stele.content || '').trim().slice(0, 240);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.76)';
    ctx.font = "700 34px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 8), padding, 1090, 46);
  }

  const qrSize = 190;
  const qrX = rightX + Math.round((300 - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + 150, 240, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawCharWash(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const padding = 78;
  const rightW = 280;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  await drawBrandHeader(ctx, padding, 72, { tag: '篆字研习' });

  const simplified = (data.simplified || '').trim() || '字';

  const charImg = await loadImage(data.image);
  drawContainImage(ctx, charImg, padding, 236, mainW, 960);

  // brush title
  ctx.fillStyle = '#111827';
  ctx.font = "900 144px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1260);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 32px 'Fira Code', monospace";
  if (data.pinyin) ctx.fillText(data.pinyin, padding, 1310);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 42px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, (data.meaning || '').trim() || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 4), padding, 1400, 52);

  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';
  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1600, 36);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1640, 36);

  if (data.en_word || data.en_meaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.60)';
    ctx.font = "700 24px 'Fira Code', monospace";
    const en = `${(data.en_word || '').trim()}${data.en_word && data.en_meaning ? ' — ' : ''}${(data.en_meaning || '').trim()}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1720, 36);
  }

  // right column
  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.fillRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);

  const qrSize = 190;
  const qrX = rightX + Math.round((rightW - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + rightW / 2, 240, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawSteleWash(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const padding = 78;
  const rightW = 280;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  await drawBrandHeader(ctx, padding, 72, { tag: '名帖赏析' });

  ctx.fillStyle = '#111827';
  ctx.font = "900 104px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 300, 104);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 28px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 500);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 40px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 8), padding, 620, 52);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.75)';
    ctx.font = "700 34px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 9), padding, 1100, 46);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 26px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1540);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1580);

  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.fillRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);

  const qrSize = 190;
  const qrX = rightX + Math.round((rightW - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + rightW / 2, 240, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawCharMinimal(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const padding = 96;
  const rightW = 260;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  // subtle border
  ctx.strokeStyle = 'rgba(17,24,39,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, CANVAS_W - 96, CANVAS_H - 96);

  await drawBrandHeader(ctx, padding, 72, { tag: '篆字研习' });

  const simplified = (data.simplified || '').trim() || '字';
  const pinyin = (data.pinyin || '').trim();
  const meaning = (data.meaning || '').trim() || '以形观势，以势入心。';
  const enWord = (data.en_word || '').trim();
  const enMeaning = (data.en_meaning || '').trim();
  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';

  const charImg = await loadImage(data.image);
  ctx.save();
  ctx.globalAlpha = 0.10;
  drawContainImage(ctx, charImg, padding, 240, mainW, 800);
  ctx.restore();

  ctx.fillStyle = '#111827';
  ctx.font = "900 160px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 540);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 32px 'Fira Code', monospace";
  if (pinyin) ctx.fillText(pinyin, padding, 590);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 42px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, meaning, mainW);
  drawLines(ctx, meaningLines.slice(0, 4), padding, 690, 52);

  const en = `${enWord}${enWord && enMeaning ? ' — ' : ''}${enMeaning}`.trim();
  if (en) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "700 24px 'Fira Code', monospace";
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 970, 36);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.52)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1100, 36);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1140, 36);

  // right column and QR
  ctx.fillStyle = 'rgba(17,24,39,0.03)';
  ctx.fillRect(rightX, 0, rightW, CANVAS_H);
  ctx.strokeStyle = 'rgba(17,24,39,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 0);
  ctx.lineTo(rightX, CANVAS_H);
  ctx.stroke();

  const qrSize = 190;
  const qrX = rightX + Math.round((rightW - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + rightW / 2, 260, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawSteleMinimal(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const padding = 96;
  const rightW = 260;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  ctx.strokeStyle = 'rgba(17,24,39,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, CANVAS_W - 96, CANVAS_H - 96);

  await drawBrandHeader(ctx, padding, 72, { tag: '名帖赏析' });

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = "900 96px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 3), padding, 300, 98);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 28px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 500);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 40px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 8), padding, 580, 52);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.70)';
    ctx.font = "700 34px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 10), padding, 1100, 46);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 26px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1560);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1600);

  ctx.fillStyle = 'rgba(17,24,39,0.03)';
  ctx.fillRect(rightX, 0, rightW, CANVAS_H);
  ctx.strokeStyle = 'rgba(17,24,39,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 0);
  ctx.lineTo(rightX, CANVAS_H);
  ctx.stroke();

  const qrSize = 190;
  const qrX = rightX + Math.round((rightW - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  drawVerticalMotto(ctx, rightX + rightW / 2, 260, qrY - 110);
  drawUrlLabelAboveQr(ctx, qrX, qrY, qrSize);
  await drawQr(ctx, qrX, qrY, qrSize);
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;
  const scale = Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  scaleMul = 1,
  offsetX = 0,
  offsetY = 0
) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;
  const s = Math.max(w / sw, h / sh) * (scaleMul || 1);
  const dw = sw * s;
  const dh = sh * s;
  const dx = x + (w - dw) / 2 + (offsetX || 0);
  const dy = y + (h - dh) / 2 + (offsetY || 0);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  let currentY = y;
  for (const line of lines) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [] as string[];

  const units = t.includes(' ') ? t.split(' ') : Array.from(t);
  const lines: string[] = [];
  let current = '';

  for (const unit of units) {
    const next = current ? (t.includes(' ') ? `${current} ${unit}` : `${current}${unit}`) : unit;
    const w = ctx.measureText(next).width;
    if (w <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = unit;
  }

  if (current) lines.push(current);
  return lines;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
