// Список лент и сторож молчащих лент.
//
// Список — db/sources.json: имя, адрес ленты, регион, включена ли. В начале
// каждого запуска конвейера parse.js приводит таблицу sources к этому файлу
// (upsert по адресу ленты, пишутся только изменившиеся строки): поменять ленты =
// поправить файл, Supabase открывать не нужно. Ленты, которых нет в файле, не
// трогаются.
//
// Сторож: если от включённой ленты SILENT_DAYS дней не пришло ни одной новой
// записи — один раз пишем владельцу в Telegram (notifyOwner). Лента ожила —
// следующее молчание будет сообщено снова. Отсчёт для ленты идёт с момента, когда
// сторож впервые увидел её включённой: старые записи выключенной когда-то ленты
// (SoraNews24 с сентября) тревогу не поднимают.
//
// Запуск вручную: node --env-file=.env scripts/sources.js — сверить список.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getState, setState } from '../lib/state.js';
import { notifyOwner } from '../lib/telegram.js';

export const SILENT_DAYS = 7;
const DAY = 24 * 3600 * 1000;
const WATCH_KEY = 'feed_watch';

// JSON с ключами по алфавиту: jsonb в базе возвращает ключи в своём порядке,
// а писать состояние стоит только когда оно правда изменилось.
const stable = (v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
    : JSON.stringify(v);

const dateRu = (ms) =>
  new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

export function loadSourceList(path = new URL('../db/sources.json', import.meta.url)) {
  const list = JSON.parse(readFileSync(path, 'utf8'));
  const seen = new Set();
  return list.map((s) => {
    if (!s.name || !/^https?:\/\//.test(s.rss_url || '') || typeof s.active !== 'boolean') {
      throw new Error(`db/sources.json: неполная запись ${JSON.stringify(s)}`);
    }
    if (seen.has(s.rss_url)) throw new Error(`db/sources.json: адрес дважды — ${s.rss_url}`);
    seen.add(s.rss_url);
    return { name: s.name, rss_url: s.rss_url, region: s.region ?? null, active: s.active };
  });
}

// Возвращает { changes: [текст], extra: [включённые в базе, но не в файле] }.
export async function syncSources(db, list = loadSourceList()) {
  const { data: before, error } = await db.from('sources').select('id, name, rss_url, region, active');
  if (error) throw error;
  const byUrl = new Map(before.map((s) => [s.rss_url, s]));
  const changes = [];
  const write = [];
  for (const s of list) {
    const cur = byUrl.get(s.rss_url);
    if (!cur) {
      changes.push(`новая — ${s.name}${s.active ? '' : ' (выключена)'}`);
      write.push(s);
      continue;
    }
    const diff = [];
    if (Boolean(cur.active) !== s.active) diff.push(s.active ? 'включена' : 'выключена');
    if (cur.name !== s.name) diff.push(`имя «${cur.name}» → «${s.name}»`);
    if ((cur.region ?? null) !== s.region) diff.push(`регион ${cur.region ?? '—'} → ${s.region ?? '—'}`);
    if (diff.length) {
      changes.push(`${s.name} — ${diff.join(', ')}`);
      write.push(s);
    }
  }
  if (write.length) {
    const { error: e } = await db.from('sources').upsert(write, { onConflict: 'rss_url' });
    if (e) throw e;
  }
  const inFile = new Set(list.map((s) => s.rss_url));
  const extra = before.filter((s) => s.active && !inFile.has(s.rss_url)).map((s) => s.name);
  return { changes, extra };
}

// sources — включённые ленты ({ id, name, rss_url }). Возвращает, о каких лентах
// сообщили сейчас.
export async function checkSilentFeeds(db, sources, now = Date.now()) {
  const state = (await getState(db, WATCH_KEY)) || {};
  const prev = state.sources || {};
  const next = {};
  const alarms = [];

  for (const s of sources) {
    const { data, error } = await db
      .from('news')
      .select('fetched_at')
      .eq('source_id', s.id)
      .order('fetched_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const last = data?.[0]?.fetched_at ? Date.parse(data[0].fetched_at) : null;
    const st = { since: new Date(now).toISOString(), notified: null, ...prev[s.id] };
    const ref = Math.max(last || 0, Date.parse(st.since));
    const days = Math.floor((now - ref) / DAY);
    if (days >= SILENT_DAYS) {
      if (!st.notified) {
        // В сообщении — сколько на самом деле прошло с последней записи.
        const shown = Math.floor((now - (last || Date.parse(st.since))) / DAY);
        alarms.push({ name: s.name, url: s.rss_url, last, days: shown });
        st.notified = new Date(now).toISOString();
      }
    } else {
      st.notified = null;
    }
    next[s.id] = st;
  }

  const lines = alarms.map(
    (a) =>
      `• «${a.name}» — ${a.days} дн. без новых записей` +
      (a.last ? ` (последняя пришла ${dateRu(a.last)})` : ' (записей от неё ещё не было)') +
      `\n${a.url}`,
  );
  if (lines.length) {
    await notifyOwner(
      `⚠️ Помойка: ${lines.length === 1 ? 'лента молчит' : 'ленты молчат'} ${SILENT_DAYS}+ дней.\n\n` +
        `${lines.join('\n\n')}\n\nВыключить или заменить — скажи Claude.`,
    );
  }

  // Один раз — проверка, что личные сообщения вообще доходят (OWNER_CHAT_ID задан).
  let hello = false;
  if (!state.hello) {
    await notifyOwner(
      '✅ Помойка на связи. Сюда будут приходить служебные сообщения: если лента ' +
        `молчит ${SILENT_DAYS} дней и первый выпуск «Абсурда власти» — до публикации.`,
    );
    hello = true;
  }

  const value = { sources: next, hello: state.hello || new Date(now).toISOString() };
  if (stable(value) !== stable(state)) await setState(db, WATCH_KEY, value);
  return { alarms, hello };
}

async function main() {
  const { db } = await import('../lib/db.js');
  const { changes, extra } = await syncSources(db);
  console.log(changes.length ? `Изменено:\n- ${changes.join('\n- ')}` : 'База совпадает с db/sources.json');
  if (extra.length) console.log(`Включены в базе, но нет в файле: ${extra.join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Фатальная ошибка:', e);
    process.exit(1);
  });
}
