// Шаг 4. Публикация готовых записей в Telegram-канал.
//
// Выпуск рубрики «Абсурд власти» (scripts/power.js), если он одобрен и ждёт,
// выходит первым — с надписью рубрики на карточке.
//
// Отбор (§7): absurdity_score >= 7, safety_flag = false, posted_to_telegram = false,
// есть переписанный заголовок и выжимка, новость не старше MAX_AGE_DAYS.
// Темп: не чаще одной публикации в MIN_GAP_MINUTES (см. lib/config.js).
// Пост: карточка с заголовком (sendPhoto) + caption = выжимка / источник + ссылка.
// Заголовок в подписи не повторяется: он уже на карточке. В базе он остаётся —
// он нужен карточке, «Итогам дня» и «Джекпоту».
// После успеха: posted_to_telegram = true, telegram_message_id, posted_at.
//
// Запуск: node --env-file=.env scripts/post.js [сколько_постов]
//
// Отказоустойчивость: падение одной публикации логируется и не мешает остальным.

import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { db } from '../lib/db.js';
import { renderCard } from '../lib/card.js';
import { sendPhoto } from '../lib/telegram.js';
import { buildCaption } from '../lib/caption.js';
import { MAX_AGE_DAYS, MIN_GAP_MINUTES } from '../lib/config.js';
import { POWER_LABEL, POWER_REGION, powerSourceIds, idList } from '../lib/power.js';

export { buildCaption }; // подпись теперь в lib/caption.js — общая с рубрикой

const POST_LIMIT_DEFAULT = 1;
const SCORE_THRESHOLD = 5;
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

// Выпуск рубрики «Абсурд власти» живёт дольше обычной новости: его может
// задержать проверка владельцем.
const POWER_MAX_AGE_DAYS = 30;
const COLS = 'id, original_url, title_rewritten, content_summary, source:sources(name, region)';

async function publishRow(row) {
  const sourceName = row.source?.name || hostName(row.original_url);
  const label = row.source?.region === POWER_REGION ? POWER_LABEL : null;
  const png = renderCard({ title: row.title_rewritten, source: sourceName, label });
  const caption = buildCaption({
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

  // Сначала — одобренный выпуск «Абсурда власти», если он ждёт (scripts/power.js
  // делает его публикуемым раз в неделю). Он выходит первым в ближайший слот.
  let rows = [];
  const powerIds = await powerSourceIds(db);
  if (powerIds.length) {
    const powerSince = new Date(Date.now() - POWER_MAX_AGE_DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await db
      .from('news')
      .select(COLS)
      .in('source_id', powerIds)
      .gte('absurdity_score', SCORE_THRESHOLD)
      .eq('safety_flag', false)
      .eq('posted_to_telegram', false)
      .not('title_rewritten', 'is', null)
      .not('content_summary', 'is', null)
      .gte('fetched_at', powerSince)
      .order('fetched_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    rows = data;
  }
  if (rows.length) console.log('Выпуск «Абсурда власти» — первым.');

  const freshSince = new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000).toISOString();
  let regularQuery = db
    .from('news')
    .select(COLS)
    .gte('absurdity_score', SCORE_THRESHOLD)
    .eq('safety_flag', false)
    .eq('posted_to_telegram', false)
    .not('title_rewritten', 'is', null)
    .not('content_summary', 'is', null)
    .gte('source_published_at', freshSince)
    .order('absurdity_score', { ascending: false })
    .order('source_published_at', { ascending: false, nullsFirst: false })
    .limit(limit - rows.length);
  // Записи рубрики в обычный поток не идут — только как выпуск выше.
  if (powerIds.length) regularQuery = regularQuery.not('source_id', 'in', idList(powerIds));
  if (rows.length < limit) {
    const { data: regular, error } = await regularQuery;
    if (error) throw error;
    rows = [...rows, ...regular];
  }

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
