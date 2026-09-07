// Шаг 2. RSS активных источников -> черновые записи в news. Без LLM.
//
// Запуск локально:  node --env-file=.env scripts/parse.js
// В GitHub Actions переменные окружения приходят из Secrets, --env-file не нужен.
//
// Дедупликация:
//   1. original_url — unique-констрейнт в БД (upsert ignoreDuplicates).
//   2. нормализованный заголовок — сверка с последними ~200 записями и с тем,
//      что уже добавлено в этом же прогоне (одна новость расходится по многим
//      изданиям с разными URL).
//
// Отказоустойчивость: падение одного источника логируется и не роняет прогон.

import { pathToFileURL } from 'node:url';
import Parser from 'rss-parser';
import { db } from '../lib/db.js';

const RSS_TIMEOUT_MS = 20_000;
const RECENT_TITLES_LIMIT = 200;
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$)/i;

const parser = new Parser({ headers: { 'User-Agent': UA } });

export const normalizeTitle = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Убираем трекинговые query-параметры, чтобы одинаковые статьи с разными
// хвостами не считались разными.
export const canonicalUrl = (raw) => {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return raw;
  }
};

// Некоторые фиды (Bild) пишут дату с буквенной таймзоной вроде "CEST",
// которую new Date() не понимает. Приводим к числовому смещению.
const TZ_ABBR = {
  GMT: '+0000', UTC: '+0000', UT: '+0000', Z: '+0000',
  BST: '+0100', WEST: '+0100', IST: '+0100',
  CET: '+0100', CEST: '+0200', MET: '+0100', MEST: '+0200',
  EET: '+0200', EEST: '+0300',
  EST: '-0500', EDT: '-0400', CST: '-0600', CDT: '-0500',
  MST: '-0700', MDT: '-0600', PST: '-0800', PDT: '-0700',
};

// Короткая выжимка из RSS для дешёвого скоринга на Шаге 3 (заголовок + ~300
// символов). contentSnippet у rss-parser уже без тегов; для остального — грубый
// стрип HTML.
export const excerpt = (item, limit = 500) => {
  const raw = item.contentSnippet || item.summary || item.content || item['content:encoded'] || '';
  const text = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, limit) : null;
};

export const toIso = (item) => {
  let raw = item.isoDate || item.pubDate || null;
  if (!raw) return null;
  let d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const fixed = raw.replace(/\b([A-Z]{1,4})\s*$/, (m, abbr) => TZ_ABBR[abbr] ?? m);
    d = new Date(fixed);
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function fetchFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RSS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parser.parseString(xml);
  } finally {
    clearTimeout(timer);
  }
}

async function loadRecentTitles() {
  const { data, error } = await db
    .from('news')
    .select('title_original')
    .order('fetched_at', { ascending: false })
    .limit(RECENT_TITLES_LIMIT);
  if (error) throw error;
  return new Set((data || []).map((r) => normalizeTitle(r.title_original)).filter(Boolean));
}

async function processSource(source, seenTitles) {
  const feed = await fetchFeed(source.rss_url);
  const items = feed.items || [];

  const rows = [];
  const rowUrls = new Set();
  let dupTitle = 0;
  let noLink = 0;

  for (const item of items) {
    const link = [item.link, item.guid].find((v) => /^https?:\/\//i.test(v || ''));
    if (!link) {
      noLink++;
      continue;
    }
    const url = canonicalUrl(link.trim());
    if (rowUrls.has(url)) continue;

    const norm = normalizeTitle(item.title);
    if (norm && seenTitles.has(norm)) {
      dupTitle++;
      continue;
    }

    rowUrls.add(url);
    if (norm) seenTitles.add(norm);
    rows.push({
      source_id: source.id,
      original_url: url,
      title_original: item.title?.trim() || null,
      content_original: excerpt(item),
      source_published_at: toIso(item),
    });
  }

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await db
      .from('news')
      .upsert(rows, { onConflict: 'original_url', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    inserted = data?.length || 0;
  }

  return { items: items.length, inserted, dupUrl: rows.length - inserted, dupTitle, noLink };
}

async function main() {
  const { data: sources, error } = await db
    .from('sources')
    .select('id, name, rss_url')
    .eq('active', true);
  if (error) throw error;

  console.log(`Активных источников: ${sources.length}`);
  const seenTitles = await loadRecentTitles();
  console.log(`Загружено недавних заголовков для дедупа: ${seenTitles.size}\n`);

  let totalNew = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      const r = await processSource(source, seenTitles);
      totalNew += r.inserted;
      console.log(
        `OK   ${source.name} — items ${r.items}, новых ${r.inserted}, ` +
          `дубль-url ${r.dupUrl}, дубль-заголовок ${r.dupTitle}, без ссылки ${r.noLink}`,
      );
    } catch (e) {
      failed++;
      console.error(`FAIL ${source.name} — ${e.message}`);
    }
  }

  console.log(`\nИтого: новых записей ${totalNew}, источников с ошибкой ${failed}/${sources.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Фатальная ошибка:', e);
    process.exit(1);
  });
}
