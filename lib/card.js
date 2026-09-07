// Рендер брендированной карточки HTML/CSS-класса -> PNG, локально на раннере.
// Без внешних API. Фон + крупный заголовок + источник внизу (docs/tz-codex.md §9).

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const FONT_DIR = new URL('../assets/fonts/', import.meta.url);
GlobalFonts.registerFromPath(new URL('PTSans-Bold.ttf', FONT_DIR).pathname, 'PT Sans Bold');
GlobalFonts.registerFromPath(new URL('PTSans-Regular.ttf', FONT_DIR).pathname, 'PT Sans');

const SIZE = 1080;
const MARGIN = 88;
const BG = '#0f0f10';
const ACID = '#c6ff00'; // кислотно-зелёный — вордмарк и подчёркивание
const FG = '#f4f4f4';
const MUTED = '#8a8a8a';

// Жадный перенос по словам под заданный размер шрифта.
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Подбираем самый крупный размер, при котором заголовок влезает в бокс.
function fitTitle(ctx, text, maxWidth, maxHeight) {
  for (let size = 82; size >= 34; size -= 3) {
    ctx.font = `${size}px "PT Sans Bold"`;
    const lineHeight = Math.round(size * 1.18);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * lineHeight <= maxHeight) return { size, lineHeight, lines };
  }
  ctx.font = `34px "PT Sans Bold"`;
  return { size: 34, lineHeight: 40, lines: wrap(ctx, text, maxWidth) };
}

/**
 * @param {{ title: string, source?: string|null }} opts
 * @returns {Buffer} PNG
 */
export function renderCard({ title, source }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Кислотный вордмарк: крупные разряженные капсы + зелёное подчёркивание.
  const markSize = 62;
  ctx.font = `${markSize}px "PT Sans Bold"`;
  ctx.letterSpacing = '10px';
  ctx.fillStyle = ACID;
  ctx.textBaseline = 'alphabetic';
  const markBaseline = MARGIN + markSize;
  ctx.fillText('ПОМОЙКА', MARGIN, markBaseline);
  const markWidth = ctx.measureText('ПОМОЙКА').width;
  ctx.letterSpacing = '0px';
  ctx.fillRect(MARGIN, markBaseline + 16, markWidth, 10);

  // Источник снизу.
  const sourceY = SIZE - MARGIN;
  if (source) {
    ctx.font = '30px "PT Sans"';
    ctx.fillStyle = MUTED;
    ctx.fillText(source, MARGIN, sourceY);
  }

  // Заголовок — по центру вертикали свободной зоны.
  const topLimit = MARGIN + 140;
  const bottomLimit = sourceY - 60;
  const boxWidth = SIZE - MARGIN * 2;
  const { lineHeight, lines } = fitTitle(ctx, title, boxWidth, bottomLimit - topLimit);

  ctx.fillStyle = FG;
  ctx.textBaseline = 'top';
  const blockHeight = lines.length * lineHeight;
  let y = topLimit + Math.max(0, (bottomLimit - topLimit - blockHeight) / 2);
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y);
    y += lineHeight;
  }

  return canvas.toBuffer('image/png');
}
