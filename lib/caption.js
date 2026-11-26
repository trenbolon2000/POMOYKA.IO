// Подпись поста под карточкой (HTML для Telegram). Общая для post.js и рубрики
// «Абсурд власти» (scripts/power.js): владелец видит выпуск ровно таким, каким
// он выйдет в канале.

import { CAPTION_LIMIT } from './telegram.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Первое предложение выжимки (описывает суть) — минимум 15 символов до
// первого . ! ? …; если пунктуации нет, берём весь текст.
function firstSentence(text) {
  const m = text.match(/^(.{15,}?[.!?…]+)(\s|$)/s);
  return m ? m[1] : text;
}

// caption с HTML: заголовка нет — он уже напечатан на карточке. Подпись
// начинается сразу с выжимки, её первое предложение — жирным. Длину держим по
// видимым символам (теги в лимит Telegram не идут).
export function buildCaption({ summary, sourceName, url }) {
  const tail = `\n\nИсточник: ${sourceName}\n${url}`;
  const budget = CAPTION_LIMIT - tail.length - 2; // 2 символа запаса

  let body = (summary || '').trim();
  if (body.length > budget) body = `${body.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;

  const first = firstSentence(body);
  const rest = body.slice(first.length).trimStart();
  const bodyHtml = rest ? `<b>${esc(first)}</b> ${esc(rest)}` : `<b>${esc(first)}</b>`;

  return `${bodyHtml}\n\nИсточник: ${esc(sourceName)}\n${esc(url)}`;
}
