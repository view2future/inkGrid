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
const INKGRID_SLOGAN_CN = '让书法活起来';
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

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
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

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.scale(pixelRatio * scale, pixelRatio * scale);

  const noiseImg = await loadImage('/noise.png').catch(() => null);
  drawWashBase(ctx, noiseImg);

  const padding = 72;
  await drawBrandHeader(ctx, padding, 72, { tag: input.title?.trim() || '典藏画册' });

  if (input.subtitle) {
    ctx.fillStyle = 'rgba(17,24,39,0.60)';
    ctx.font = "800 22px 'Noto Serif SC', serif";
    ctx.fillText(input.subtitle.trim(), padding, 210);
  }

  const cards = (input.cards || []).slice(0, 8);
  const cardW = 340;
  const cardH = 480;
  const gapX = 72;
  const gapY = 44;
  const startX = 110;
  const startY = 280;

  const rotations = [-6.5, 4.5, -3.8, 6.2, -5.2, 3.6, -2.6, 5.0];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const rot = rotations[i % rotations.length];

    // card shadow
    ctx.save();
    ctx.translate(x + cardW / 2, y + cardH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-cardW / 2, -cardH / 2);

    ctx.fillStyle = 'rgba(17,24,39,0.16)';
    roundRect(ctx, 10, 16, cardW, cardH, 32);
    ctx.filter = 'blur(18px)';
    ctx.fill();
    ctx.filter = 'none';

    // card body
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    roundRect(ctx, 0, 0, cardW, cardH, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(17,24,39,0.10)';
    ctx.lineWidth = 2;
    roundRect(ctx, 0, 0, cardW, cardH, 32);
    ctx.stroke();

    // simplified tag
    const simplified = (c.simplified || '').trim();
    if (simplified) {
      ctx.fillStyle = 'rgba(139,0,0,0.12)';
      roundRect(ctx, 22, 22, 88, 56, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(139,0,0,0.22)';
      ctx.lineWidth = 2;
      roundRect(ctx, 22, 22, 88, 56, 18);
      ctx.stroke();
      ctx.fillStyle = 'rgba(17,24,39,0.90)';
      ctx.font = "900 34px 'Noto Serif SC', serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(simplified, 22 + 44, 22 + 30);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // glyph
    if (c.image) {
      const img = await loadImage(c.image).catch(() => null);
      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.94;
        drawContainImage(ctx, img, 44, 110, cardW - 88, cardH - 170);
        ctx.restore();
      }
    }

    // footer brand
    ctx.fillStyle = 'rgba(17,24,39,0.48)';
    ctx.font = "900 18px 'Noto Serif SC', serif";
    ctx.fillText(INKGRID_BRAND_CN, 44, cardH - 42);
    ctx.fillStyle = 'rgba(17,24,39,0.36)';
    ctx.font = "800 16px 'Noto Serif SC', serif";
    ctx.fillText(INKGRID_SLOGAN_CN, 44, cardH - 18);

    ctx.restore();
  }

  // QR footer
  const qrSize = 190;
  const qrX = CANVAS_W - padding - qrSize;
  const qrY = CANVAS_H - padding - qrSize;
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 24px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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

  const textX = x + (logo ? logoSize + 18 : 0);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111827';
  ctx.font = "900 46px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_BRAND_CN, textX, y + 44);
  ctx.fillStyle = 'rgba(17,24,39,0.62)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText(INKGRID_SLOGAN_CN, textX, y + 78);
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
  drawContainImage(ctx, charImg, padding, 226, mainW, 860);

  const simplified = (data.simplified || '').trim() || '字';
  const pinyin = (data.pinyin || '').trim();
  const meaning = (data.meaning || '').trim();
  const enWord = (data.en_word || '').trim();
  const enMeaning = (data.en_meaning || '').trim();
  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';

  ctx.fillStyle = '#111827';
  ctx.font = "900 104px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1188);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 26px 'Fira Code', monospace";
  if (pinyin) ctx.fillText(pinyin, padding, 1242);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 32px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, meaning || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 3), padding, 1310, 46);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 20px 'Noto Serif SC', serif";
  const meta = `出处：${sourceTitle}   作者：${dynasty}·${author}`;
  drawLines(ctx, wrapText(ctx, meta, mainW), padding, 1445, 30);

  if (enWord || enMeaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "700 20px 'Fira Code', monospace";
    const en = `${enWord}${enWord && enMeaning ? ' — ' : ''}${enMeaning}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1542, 30);
  }

  const qrSize = 190;
  const qrX = rightX + Math.round((300 - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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
  ctx.font = "900 72px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 286, 82);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 446);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 30px 'Noto Serif SC', serif";
  const desc = (stele.description || '').trim();
  const descLines = wrapText(ctx, desc || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 7), padding, 548, 46);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 20px 'Fira Code', monospace";
  const meta1 = `藏地：${stele.location}`;
  const meta2 = `规模：${stele.total_chars} 字`;
  ctx.fillText(meta1, padding, 910);
  ctx.fillText(meta2, padding, 946);

  const excerpt = (stele.content || '').trim().slice(0, 240);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.76)';
    ctx.font = "700 26px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 9), padding, 1026, 40);
  }

  const qrSize = 190;
  const qrX = rightX + Math.round((300 - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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
  drawContainImage(ctx, charImg, padding, 236, mainW, 900);

  // brush title
  ctx.fillStyle = '#111827';
  ctx.font = "900 108px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1228);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 26px 'Fira Code', monospace";
  if (data.pinyin) ctx.fillText(data.pinyin, padding, 1272);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 32px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, (data.meaning || '').trim() || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 4), padding, 1350, 46);

  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';
  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 20px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1532, 30);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1566, 30);

  if (data.en_word || data.en_meaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.60)';
    ctx.font = "700 20px 'Fira Code', monospace";
    const en = `${(data.en_word || '').trim()}${data.en_word && data.en_meaning ? ' — ' : ''}${(data.en_meaning || '').trim()}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1640, 30);
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
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
  await drawQr(ctx, qrX, qrY, qrSize);
}

async function drawSteleWash(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const padding = 78;
  const rightW = 280;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  await drawBrandHeader(ctx, padding, 72, { tag: '名帖赏析' });

  ctx.fillStyle = '#111827';
  ctx.font = "900 78px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 286, 88);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 472);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 30px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 9), padding, 588, 46);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.75)';
    ctx.font = "700 26px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 10), padding, 1032, 40);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 20px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1456);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1492);

  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.fillRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);

  const qrSize = 190;
  const qrX = rightX + Math.round((rightW - qrSize) / 2);
  const qrY = CANVAS_H - padding - qrSize;
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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
  drawContainImage(ctx, charImg, padding, 240, mainW, 720);
  ctx.restore();

  ctx.fillStyle = '#111827';
  ctx.font = "900 120px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 520);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 26px 'Fira Code', monospace";
  if (pinyin) ctx.fillText(pinyin, padding, 566);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 32px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, meaning, mainW);
  drawLines(ctx, meaningLines.slice(0, 5), padding, 650, 46);

  const en = `${enWord}${enWord && enMeaning ? ' — ' : ''}${enMeaning}`.trim();
  if (en) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "700 20px 'Fira Code', monospace";
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 900, 30);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.52)';
  ctx.font = "700 20px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1020, 30);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1054, 30);

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
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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
  ctx.font = "900 72px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 3), padding, 286, 82);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 470);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 30px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 10), padding, 548, 46);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.70)';
    ctx.font = "700 26px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 12), padding, 1030, 40);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 20px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1456);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1492);

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
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  drawGoldFoilText(ctx, INKGRID_QR_LABEL, qrX - 12, qrY - 18);
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
