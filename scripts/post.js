// Шаг 4. Публикация готовых записей в Telegram-канал.
//
// Отбор (§7): absurdity_score >= 7, safety_flag = false, posted_to_telegram = false,
// есть переписанный заголовок и выжимка, новость не старше MAX_AGE_DAYS.
// Темп: не чаще одной публикации в MIN_GAP_MINUTES (см. lib/config.js).
// Пост: карточка (sendPhoto) + caption = заголовок / выжимка / источник + ссылка.
// После успеха: posted_to_telegram = true, telegram_message_id, posted_at.
//
// Запуск: node --env-file=.env scripts/post.js [сколько_постов]
//
// Отказоустойчивость: падение одной публикации логируется и не мешает остальным.

import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { db } from '../lib/db.js';
import { renderCard } from '../lib/card.js';
import { sendPhoto, CAPTION_LIMIT } from '../lib/telegram.js';
import { MAX_AGE_DAYS, MIN_GAP_MINUTES } from '../lib/config.js';

const POST_LIMIT_DEFAULT = 1;
const SCORE_THRESHOLD = 6;
const GAP_MS = 1500; // пауза между постами, чтобы не ловить 429

const { TELEGRAM_CHANNEL_ID } = process.env;
if (!TELEGRAM_CHANNEL_ID) throw new Error('Нет TELEGRAM_CHANNEL_ID в окружении');

const hostName = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Первое предложение выжимки (описывает суть) — минимум 15 символов до
// первого . ! ? …; если пунктуации нет, берём весь текст.
function firstSentence(text) {
  const m = text.match(/^(.{15,}?[.!?…]+)(\s|$)/s);
  return m ? m[1] : text;
}

// caption с HTML: первое предложение выжимки — жирным. Длину держим по видимым
// символам (теги в лимит Telegram не идут).
function buildCaption({ title, summary, sourceName, url }) {
  const t = (title || '').trim();
  const tail = `\n\nИсточник: ${sourceName}\n${url}`;
  const budget = CAPTION_LIMIT - t.length - tail.length - 4;

  let body = (summary || '').trim();
  if (body.length > budget) body = `${body.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;

  const first = firstSentence(body);
  const rest = body.slice(first.length).trimStart();
  const bodyHtml = rest ? `<b>${esc(first)}</b> ${esc(rest)}` : `<b>${esc(first)}</b>`;

  return `${esc(t)}\n\n${bodyHtml}\n\nИсточник: ${esc(sourceName)}\n${esc(url)}`;
}

async function publishRow(row) {
  const sourceName = row.source?.name || hostName(row.original_url);
  const png = renderCard({ title: row.title_rewritten, source: sourceName });
  const caption = buildCaption({
    title: row.title_rewritten,
    summary: row.content_summary,
    sourceName,
    url: row.original_url,
  });

  const result = await sendPhoto(TELEGRAM_CHANNEL_ID, png, caption, 'HTML');

  const { error } = await db
    .from('news')
    .update({
      posted_to_telegram: true,
      telegram_message_id: String(result.message_id),
      posted_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) throw new Error(`БД update после публикации: ${error.message}`);
  return result.message_id;
}

async function lastPostedAt() {
  const { data } = await db
    .from('news')
    .select('posted_at')
    .eq('posted_to_telegram', true)
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.posted_at ? Date.parse(data.posted_at) : 0;
}

async function main() {
  const limit = Number(process.argv[2]) || POST_LIMIT_DEFAULT;

  // Темп: не чаще одной публикации в MIN_GAP_MINUTES.
  const sinceLast = (Date.now() - (await lastPostedAt())) / 60000;
  if (sinceLast < MIN_GAP_MINUTES) {
    console.log(
      `Рано: последняя публикация ${Math.round(sinceLast)} мин назад ` +
        `(минимум ${MIN_GAP_MINUTES}). Пропускаем.`,
    );
    return;
  }

  const freshSince = new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await db
    .from('news')
    .select('id, original_url, title_rewritten, content_summary, source:sources(name)')
    .gte('absurdity_score', SCORE_THRESHOLD)
    .eq('safety_flag', false)
    .eq('posted_to_telegram', false)
    .not('title_rewritten', 'is', null)
    .not('content_summary', 'is', null)
    .gte('source_published_at', freshSince)
    .order('absurdity_score', { ascending: false })
    .order('source_published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;

  console.log(`К публикации: ${rows.length} (лимит ${limit})`);

  let posted = 0;
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    try {
      const mid = await publishRow(row);
      posted++;
      console.log(`OK   msg ${mid} — ${row.title_rewritten}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${e.message} — ${row.title_rewritten}`);
    }
    if (i < rows.length - 1) await sleep(GAP_MS);
  }

  console.log(`\nОпубликовано ${posted}, ошибок ${failed}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Фатальная ошибка:', e);
    process.exit(1);
  });
}
