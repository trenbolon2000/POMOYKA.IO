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
const SCORE_THRESHOLD = 7;
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

function buildCaption({ title, summary, sourceName, url }) {
  const tail = `\n\nИсточник: ${sourceName}\n${url}`;
  const room = CAPTION_LIMIT - title.length - tail.length - 2;
  let body = summary || '';
  if (body.length > room) body = `${body.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  return `${title}\n\n${body}${tail}`;
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

  const result = await sendPhoto(TELEGRAM_CHANNEL_ID, png, caption);

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
