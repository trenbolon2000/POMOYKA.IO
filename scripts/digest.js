// Шаг 5. Дайджест дня: один пост-подборка поверх уже опубликованного за сутки.
// БЕЗ вызова LLM — чистое форматирование записей из БД (docs/tz-codex.md §10).
//
// Отбор: топ по absurdity_score среди записей с posted_at за последние 24 часа.
// Формат: список «переписанный заголовок + ссылка на пост в самом канале».
// Картинка: тот же рендер, фиксированный текст «Итоги дня».
//
// Запуск: node --env-file=.env scripts/digest.js
// Расписание: отдельный суточный workflow (.github/workflows/digest.yml).

import { pathToFileURL } from 'node:url';
import { db } from '../lib/db.js';
import { renderCard } from '../lib/card.js';
import { sendPhoto, CAPTION_LIMIT } from '../lib/telegram.js';

const TOP_N = 7;
const WINDOW_HOURS = 24;
const TITLE_MAX = 140; // обрезка одной строки списка

const { TELEGRAM_CHANNEL_ID, TELEGRAM_CHANNEL_USERNAME } = process.env;
if (!TELEGRAM_CHANNEL_ID || !TELEGRAM_CHANNEL_USERNAME) {
  throw new Error('Нужны TELEGRAM_CHANNEL_ID и TELEGRAM_CHANNEL_USERNAME в окружении');
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const dateRu = (d) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

function buildCaption(rows) {
  const header = 'Итоги дня\n\n';
  const lines = rows.map((r, i) => {
    const link = `https://t.me/${TELEGRAM_CHANNEL_USERNAME}/${r.telegram_message_id}`;
    return `${i + 1}. ${clip(r.title_rewritten, TITLE_MAX)}\n${link}`;
  });
  let caption = header + lines.join('\n\n');
  // На всякий случай ужимаем до лимита, отбрасывая последние позиции.
  while (caption.length > CAPTION_LIMIT && lines.length > 1) {
    lines.pop();
    caption = header + lines.join('\n\n');
  }
  return caption;
}

async function main() {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

  const { data: rows, error } = await db
    .from('news')
    .select('title_rewritten, telegram_message_id, absurdity_score, posted_at')
    .eq('posted_to_telegram', true)
    .not('telegram_message_id', 'is', null)
    .gte('posted_at', since)
    .order('absurdity_score', { ascending: false })
    .limit(TOP_N);
  if (error) throw error;

  if (!rows.length) {
    console.log('За последние 24 часа опубликованных записей нет — дайджест не отправляем.');
    return;
  }

  const caption = buildCaption(rows);
  const png = renderCard({ title: 'Итоги дня', source: dateRu(new Date()) });
  const result = await sendPhoto(TELEGRAM_CHANNEL_ID, png, caption);

  console.log(`Дайджест отправлен: msg ${result.message_id}, позиций ${rows.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Фатальная ошибка:', e);
    process.exit(1);
  });
}
