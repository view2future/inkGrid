import QRCode from 'qrcode';

export type PosterTemplate = 'folio' | 'wash' | 'minimal';
export type PosterKind = 'char' | 'stele';

export const INKGRID_QR_URL = 'https://www.inkgrid.art';
export const INKGRID_QR_LABEL = 'www.inkgrid.art';

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

const CANVAS_W = 1080;
const CANVAS_H = 1920;

export async function renderPosterPng(input: PosterInput) {
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.max(2, Math.floor(window.devicePixelRatio || 1));
  canvas.width = CANVAS_W * pixelRatio;
  canvas.height = CANVAS_H * pixelRatio;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.scale(pixelRatio, pixelRatio);

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
    width: CANVAS_W,
    height: CANVAS_H,
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

async function drawCharFolio(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const rightX = CANVAS_W - 300;
  const padding = 72;
  const mainW = rightX - padding * 2;

  ctx.fillStyle = '#111827';
  ctx.font = "900 54px 'Noto Serif SC', serif";
  ctx.fillText('墨流', padding, 132);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 20px 'Noto Serif SC', serif";
  ctx.fillText('篆字研习', padding, 172);

  const charImg = await loadImage(data.image);
  drawContainImage(ctx, charImg, padding, 250, mainW, 820);

  const simplified = (data.simplified || '').trim() || '字';
  const pinyin = (data.pinyin || '').trim();
  const meaning = (data.meaning || '').trim();
  const enWord = (data.en_word || '').trim();
  const enMeaning = (data.en_meaning || '').trim();
  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';

  ctx.fillStyle = '#111827';
  ctx.font = "900 88px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1180);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 24px 'Fira Code', monospace";
  if (pinyin) ctx.fillText(pinyin, padding, 1230);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 28px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, meaning || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 3), padding, 1295, 40);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 20px 'Noto Serif SC', serif";
  const meta = `出处：${sourceTitle}   作者：${dynasty}·${author}`;
  drawLines(ctx, wrapText(ctx, meta, mainW), padding, 1445, 30);

  if (enWord || enMeaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.62)';
    ctx.font = "700 18px 'Fira Code', monospace";
    const en = `${enWord}${enWord && enMeaning ? ' — ' : ''}${enMeaning}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1520, 26);
  }

  await drawQr(ctx, rightX + 60, 1320, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 44, 1525);

  // small seal
  ctx.save();
  ctx.translate(rightX + 84, 1120);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.strokeStyle = 'rgba(139,0,0,0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 120, 120);
  ctx.fillStyle = 'rgba(139,0,0,0.07)';
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = 'rgba(139,0,0,0.85)';
  ctx.font = "900 30px 'Noto Serif SC', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('墨', 60, 44);
  ctx.fillText('流', 60, 82);
  ctx.restore();
}

async function drawSteleFolio(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const rightX = CANVAS_W - 300;
  const padding = 72;
  const mainW = rightX - padding * 2;

  ctx.fillStyle = '#111827';
  ctx.font = "900 54px 'Noto Serif SC', serif";
  ctx.fillText('墨流', padding, 132);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 20px 'Noto Serif SC', serif";
  ctx.fillText('名帖赏析', padding, 172);

  ctx.fillStyle = '#111827';
  ctx.font = "900 64px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 290, 76);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 20px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 430);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  const desc = (stele.description || '').trim();
  const descLines = wrapText(ctx, desc || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 7), padding, 520, 40);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 18px 'Fira Code', monospace";
  const meta1 = `藏地：${stele.location}`;
  const meta2 = `规模：${stele.total_chars} 字`;
  ctx.fillText(meta1, padding, 860);
  ctx.fillText(meta2, padding, 892);

  const excerpt = (stele.content || '').trim().slice(0, 240);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.76)';
    ctx.font = "700 22px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 9), padding, 980, 36);
  }

  await drawQr(ctx, rightX + 60, 1320, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 44, 1525);

  ctx.save();
  ctx.translate(rightX + 84, 1120);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.strokeStyle = 'rgba(139,0,0,0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 120, 120);
  ctx.fillStyle = 'rgba(139,0,0,0.07)';
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = 'rgba(139,0,0,0.85)';
  ctx.font = "900 26px 'Noto Serif SC', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('名', 60, 44);
  ctx.fillText('帖', 60, 82);
  ctx.restore();
}

async function drawCharWash(ctx: CanvasRenderingContext2D, data: PosterChar) {
  const padding = 78;
  const rightW = 280;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  ctx.fillStyle = 'rgba(17,24,39,0.75)';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText('墨流', padding, 138);

  const simplified = (data.simplified || '').trim() || '字';
  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText('篆字研习', padding, 176);

  const charImg = await loadImage(data.image);
  drawContainImage(ctx, charImg, padding, 250, mainW, 880);

  // brush title
  ctx.fillStyle = '#111827';
  ctx.font = "900 90px 'Noto Serif SC', serif";
  ctx.fillText(simplified, padding, 1215);

  ctx.fillStyle = '#8B0000';
  ctx.font = "700 22px 'Fira Code', monospace";
  if (data.pinyin) ctx.fillText(data.pinyin, padding, 1258);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  const meaningLines = wrapText(ctx, (data.meaning || '').trim() || '以形观势，以势入心。', mainW);
  drawLines(ctx, meaningLines.slice(0, 4), padding, 1330, 38);

  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';
  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 18px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1502, 28);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1534, 28);

  if (data.en_word || data.en_meaning) {
    ctx.fillStyle = 'rgba(17,24,39,0.60)';
    ctx.font = "700 18px 'Fira Code', monospace";
    const en = `${(data.en_word || '').trim()}${data.en_word && data.en_meaning ? ' — ' : ''}${(data.en_meaning || '').trim()}`;
    drawLines(ctx, wrapText(ctx, en, mainW), padding, 1606, 26);
  }

  // right column
  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.fillRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  await drawQr(ctx, rightX + 50, 1380, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 34, 1585);
}

async function drawSteleWash(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const padding = 78;
  const rightW = 280;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  ctx.fillStyle = 'rgba(17,24,39,0.75)';
  ctx.font = "900 42px 'Noto Serif SC', serif";
  ctx.fillText('墨流', padding, 138);
  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 22px 'Noto Serif SC', serif";
  ctx.fillText('名帖赏析', padding, 176);

  ctx.fillStyle = '#111827';
  ctx.font = "900 70px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 2), padding, 290, 82);

  ctx.fillStyle = 'rgba(17,24,39,0.60)';
  ctx.font = "800 20px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 460);

  ctx.fillStyle = 'rgba(17,24,39,0.74)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 9), padding, 560, 40);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.75)';
    ctx.font = "700 22px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 10), padding, 980, 36);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.56)';
  ctx.font = "700 18px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1400);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1430);

  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.fillRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  ctx.strokeStyle = 'rgba(17,24,39,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX + 18, 120, rightW - 36, CANVAS_H - 240);
  await drawQr(ctx, rightX + 50, 1380, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 34, 1585);
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

  ctx.fillStyle = 'rgba(17,24,39,0.75)';
  ctx.font = "700 22px 'Noto Serif SC', serif";
  ctx.textAlign = 'left';
  ctx.fillText('○', padding, 120);
  ctx.font = "900 26px 'Noto Serif SC', serif";
  ctx.fillText((data.simplified || '').trim() || '字', padding + 44, 120);

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = "900 54px 'Noto Serif SC', serif";
  ctx.fillText('一字入墨', padding, 210);
  ctx.fillText('轻翻成流', padding, 280);

  const charImg = await loadImage(data.image);
  ctx.globalAlpha = 0.08;
  drawContainImage(ctx, charImg, padding, 320, mainW, 620);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 28px 'Noto Serif SC', serif";
  const meaning = (data.meaning || '').trim() || '以形观势，以势入心。';
  const meaningLines = wrapText(ctx, meaning, mainW);
  drawLines(ctx, meaningLines.slice(0, 9), padding, 560, 44);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 18px 'Fira Code', monospace";
  const en = `${(data.en_word || '').trim()}${data.en_word && data.en_meaning ? ' — ' : ''}${(data.en_meaning || '').trim()}`.trim();
  if (en) drawLines(ctx, wrapText(ctx, en, mainW), padding, 1040, 28);

  const sourceTitle = data.sourceTitle || '嶧山刻石';
  const author = data.author || '李斯';
  const dynasty = data.dynasty || '秦';
  ctx.fillStyle = 'rgba(17,24,39,0.50)';
  ctx.font = "700 18px 'Noto Serif SC', serif";
  drawLines(ctx, wrapText(ctx, `出处：${sourceTitle}`, mainW), padding, 1140, 28);
  drawLines(ctx, wrapText(ctx, `作者：${dynasty}·${author}`, mainW), padding, 1172, 28);

  ctx.fillStyle = 'rgba(17,24,39,0.35)';
  ctx.font = "700 18px 'Fira Code', monospace";
  ctx.fillText('APPROACHES TO LEARNING', padding, CANVAS_H - 120);

  // QR on right
  ctx.fillStyle = 'rgba(17,24,39,0.04)';
  ctx.fillRect(rightX, 0, rightW, CANVAS_H);
  await drawQr(ctx, rightX + 40, 1460, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.62)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 30, 1665);
}

async function drawSteleMinimal(ctx: CanvasRenderingContext2D, stele: PosterStele) {
  const padding = 96;
  const rightW = 260;
  const mainW = CANVAS_W - rightW - padding * 2;
  const rightX = CANVAS_W - rightW;

  ctx.strokeStyle = 'rgba(17,24,39,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, CANVAS_W - 96, CANVAS_H - 96);

  ctx.fillStyle = 'rgba(17,24,39,0.70)';
  ctx.font = "900 22px 'Noto Serif SC', serif";
  ctx.fillText('名帖赏析', padding, 128);

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = "900 58px 'Noto Serif SC', serif";
  const titleLines = wrapText(ctx, stele.name, mainW);
  drawLines(ctx, titleLines.slice(0, 3), padding, 220, 72);

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "800 18px 'Noto Serif SC', serif";
  ctx.fillText(`${stele.dynasty} · ${stele.author} · ${stele.script_type}`, padding, 420);

  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.font = "700 26px 'Noto Serif SC', serif";
  const descLines = wrapText(ctx, (stele.description || '').trim() || '以气韵读帖，以笔法入心。', mainW);
  drawLines(ctx, descLines.slice(0, 10), padding, 520, 40);

  const excerpt = (stele.content || '').trim().slice(0, 260);
  if (excerpt) {
    ctx.fillStyle = 'rgba(17,24,39,0.70)';
    ctx.font = "700 22px 'Noto Serif SC', serif";
    const quoteLines = wrapText(ctx, `「${excerpt}…」`, mainW);
    drawLines(ctx, quoteLines.slice(0, 12), padding, 980, 34);
  }

  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = "700 18px 'Fira Code', monospace";
  ctx.fillText(`藏地：${stele.location}`, padding, 1440);
  ctx.fillText(`规模：${stele.total_chars} 字`, padding, 1470);

  ctx.fillStyle = 'rgba(17,24,39,0.35)';
  ctx.font = "700 18px 'Fira Code', monospace";
  ctx.fillText('APPROACHES TO LEARNING', padding, CANVAS_H - 120);

  ctx.fillStyle = 'rgba(17,24,39,0.04)';
  ctx.fillRect(rightX, 0, rightW, CANVAS_H);
  await drawQr(ctx, rightX + 40, 1460, 180);
  ctx.fillStyle = 'rgba(17,24,39,0.62)';
  ctx.font = "800 16px 'Fira Code', monospace";
  ctx.fillText(INKGRID_QR_LABEL, rightX + 30, 1665);
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
