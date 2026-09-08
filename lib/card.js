// Рендер брендированной карточки -> PNG, локально на раннере. Без внешних API.
// Тёмный фон, кислотный логотип, крупный узкий заголовок (последняя строка —
// акцентным цветом), нижняя строка с источником и иконками, гранж-рамка + шум.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const F = new URL('../assets/fonts/', import.meta.url);
GlobalFonts.registerFromPath(new URL('PTSans-Bold.ttf', F).pathname, 'PT Sans Bold');
GlobalFonts.registerFromPath(new URL('PTSans-Regular.ttf', F).pathname, 'PT Sans');
GlobalFonts.registerFromPath(new URL('PTSansNarrow-Bold.ttf', F).pathname, 'PT Sans Narrow');

const SIZE = 1080;
const PAD = 84;
const BG = '#0d0d0e';
const ACID = '#ccff00'; // кислотно-зелёный, ярче прежнего
const FUCHSIA = '#ff249c';
const FG = '#f3f3f3';
const MUTED = '#8c8c8c';
const FRAME = '#2a2a2c';

const wrap = (ctx, text, maxWidth) => {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
};

const fitText = (ctx, text, font, maxW, maxH, max, min) => {
  for (let size = max; size >= min; size -= 3) {
    ctx.font = `${size}px "${font}"`;
    const lh = Math.round(size * 1.06);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * lh <= maxH) return { size, lh, lines };
  }
  ctx.font = `${min}px "${font}"`;
  return { size: min, lh: Math.round(min * 1.06), lines: wrap(ctx, text, maxW) };
};

const roundRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Схематичный «глобус».
const globe = (ctx, cx, cy, r, color) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const star = (ctx, cx, cy, r, color) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const send = (ctx, cx, cy, r, color) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx - r, cy + r);
  ctx.lineTo(cx - r * 0.35, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const noise = (ctx, n) => {
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
  }
  ctx.restore();
};

// Рисует строку в два цвета: слова до серединной точки — fuchsia, дальше — acid.
const drawSplitLine = (ctx, words, x, y, splitAt) => {
  let cx = x;
  words.forEach((w, i) => {
    ctx.fillStyle = i < splitAt ? FUCHSIA : ACID;
    const piece = i === words.length - 1 ? w : `${w} `;
    ctx.fillText(piece, cx, y);
    cx += ctx.measureText(piece).width;
  });
};

/**
 * @param {{ title: string, source?: string|null }} opts
 * @returns {Buffer} PNG
 */
export function renderCard({ title, source }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);
  noise(ctx, 1400);

  // Гранж-рамка (двойной неровный штрих).
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = 2;
  roundRectPath(ctx, 34, 34, SIZE - 68, SIZE - 68, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(198,255,0,0.10)';
  roundRectPath(ctx, 40, 40, SIZE - 80, SIZE - 80, 18);
  ctx.stroke();

  // Логотип.
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '6px';
  ctx.font = '54px "PT Sans Bold"';
  ctx.fillStyle = ACID;
  ctx.fillText('POMOYKA.IO', PAD, PAD + 44);
  const logoW = ctx.measureText('POMOYKA.IO').width;
  ctx.letterSpacing = '0px';
  ctx.fillRect(PAD, PAD + 60, logoW, 8);

  ctx.font = '22px "PT Sans"';
  ctx.fillStyle = MUTED;
  ctx.letterSpacing = '3px';
  ctx.fillText('НОВОСТИ СО ВСЕГО ИНТЕРНЕТА', PAD, PAD + 96);
  ctx.letterSpacing = '0px';

  // Декор справа сверху.
  globe(ctx, SIZE - PAD - 22, PAD + 26, 22, MUTED);

  // Нижняя строка.
  const metaY = SIZE - PAD - 6;
  globe(ctx, PAD + 16, metaY - 10, 16, MUTED);
  ctx.font = '24px "PT Sans"';
  ctx.fillStyle = MUTED;
  ctx.letterSpacing = '1px';
  ctx.fillText((source || '').toUpperCase(), PAD + 44, metaY);
  ctx.letterSpacing = '0px';
  star(ctx, SIZE - PAD - 74, metaY - 12, 15, MUTED);
  send(ctx, SIZE - PAD - 24, metaY - 12, 15, MUTED);

  // Заголовок — узкий, капсом. Центрируем в зоне под логотипом.
  const boxTop = 330;
  const boxBottom = metaY - 64;
  const boxW = SIZE - PAD * 2;
  const text = (title || '').toUpperCase();
  const { lh, lines } = fitText(ctx, text, 'PT Sans Narrow', boxW, boxBottom - boxTop, 132, 46);

  ctx.textBaseline = 'top';
  const block = lines.length * lh;
  let y = boxTop + Math.max(0, (boxBottom - boxTop - block) / 2);

  if (lines.length === 1) {
    // одна строка — делим по словам
    const words = lines[0].split(' ');
    drawSplitLine(ctx, words, PAD, y, Math.ceil(words.length / 2));
  } else {
    // верхняя половина строк — fuchsia, нижняя — acid
    const mid = Math.ceil(lines.length / 2);
    lines.forEach((line, i) => {
      ctx.fillStyle = i < mid ? FUCHSIA : ACID;
      ctx.fillText(line, PAD, y);
      y += lh;
    });
  }

  return canvas.toBuffer('image/png');
}
