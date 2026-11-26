// Общие помощники пробных прогонов шага 2 (trial/step2b.js). В базу не пишут.

import { fetchFeed, excerpt as rssExcerpt, toIso, isGarbled } from '../scripts/parse.js';
import { stage1Messages, stage2Messages, violatesRules, fetchArticleText, REWRITE_THRESHOLD } from '../scripts/filter.js';
import { chatJson } from '../lib/llm.js';
import { isSatire } from '../lib/blacklist.js';
import { MAX_AGE_DAYS } from '../lib/config.js';

export const NOW = Date.now();
export const DAY = 24 * 3600 * 1000;

export const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
export const clampScore = (v) => Math.min(10, Math.max(0, Number(v) || 0)); // как в filter.js
export const lang = (s) => {
  const t = String(s || '');
  const cyr = (t.match(/[а-яё]/gi) || []).length;
  const lat = (t.match(/[a-z]/gi) || []).length;
  return cyr > lat ? 'ru' : 'en';
};
export const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
export const cut = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
export const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
export const fmt1 = (v) => (v == null ? '—' : v.toFixed(1));

// retries — повторы при сбое (429, 5xx, таймаут модели), с паузой.
export async function pool(items, limit, fn, retries = 0) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      for (let attempt = 0; ; attempt++) {
        try {
          out[k] = await fn(items[k], k);
          break;
        } catch (e) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          out[k] = { error: e?.message || String(e) };
          break;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function makeSection(report, log = console.log) {
  return async (name, fn) => {
    const t0 = Date.now();
    log(`\n=== ${name} ===`);
    try {
      await fn();
    } catch (e) {
      console.error(`Раздел «${name}» упал:`, e);
      report.errors.push({ section: name, error: e?.stack || String(e) });
    }
    log(`(${Math.round((Date.now() - t0) / 1000)} с)`);
  };
}

export async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// --- ленты ---
export function feedStats(items) {
  const dated = items.filter((i) => i.date).map((i) => Date.parse(i.date));
  const newest = dated.length ? Math.max(...dated) : null;
  const oldest = dated.length ? Math.min(...dated) : null;
  const week = dated.filter((t) => NOW - t <= 7 * DAY).length;
  const stale = dated.filter((t) => NOW - t > MAX_AGE_DAYS * DAY).length;
  let perDay = null;
  if (dated.length) perDay = oldest <= NOW - 7 * DAY ? week / 7 : dated.length / Math.max((NOW - oldest) / DAY, 0.5);
  return {
    count: items.length,
    noDate: items.length - dated.length,
    garbled: items.filter((i) => isGarbled(i.title)).length,
    newestAgeH: newest ? (NOW - newest) / 3600e3 : null,
    perDay,
    week,
    staleShare: dated.length ? stale / dated.length : null,
    lang: lang(items.slice(0, 10).map((i) => i.title).join(' ')),
  };
}

// Пробуем адреса ленты по очереди; берём первый, где есть СВЕЖИЕ записи
// (иначе — первый живой, чтобы показать, что лента заброшена).
export async function checkSite(site) {
  const tried = [];
  let staleHit = null;
  for (const url of site.urls) {
    try {
      const feed = await fetchFeed(url);
      const items = (feed.items || [])
        .map((it) => ({
          site: site.site,
          title: (it.title || '').trim(),
          link: [it.link, it.guid].find((v) => /^https?:\/\//i.test(v || '')) || '',
          date: toIso(it),
          excerpt: rssExcerpt(it),
        }))
        .filter((x) => x.title && x.link);
      if (!items.length) {
        tried.push({ url, error: 'лента пустая или без ссылок' });
        continue;
      }
      const hit = { site: site.site, ok: true, url, tried, items, stats: feedStats(items) };
      if (fresh(items).length) return hit;
      tried.push({ url, error: 'только старые записи' });
      staleHit ||= hit;
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'таймаут 20 с' : e?.message || String(e);
      tried.push({ url, error: cut(msg, 120) });
    }
  }
  return staleHit || { site: site.site, ok: false, url: null, tried, items: [], stats: null };
}

export const fresh = (items) =>
  items
    .filter((i) => i.date && NOW - Date.parse(i.date) <= MAX_AGE_DAYS * DAY && Date.parse(i.date) <= NOW + DAY)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

// Раздел сайта по адресу статьи: первый сегмент пути + второй, если это не
// адрес самой статьи.
export function sitePath(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean);
    return `/${seg[0] || ''}${seg.length > 2 && !/\d/.test(seg[1]) ? `/${seg[1]}` : ''}`;
  } catch {
    return '?';
  }
}

// --- модель ---
// Этап 1 ровно как processRow в filter.js. tweak — правка системного промпта
// (только для сравнения «как сейчас» и «с предложением»).
export async function stage1(item, tweak = null) {
  if (isSatire(item.link)) return { satire: true, score: 0, is_absurd: false, safety_flag: false, passed: false };
  if (isGarbled(item.title, item.excerpt)) return { garbled: true, score: 0, is_absurd: false, safety_flag: false, passed: false };
  const src = `${host(item.link)} (${item.site})`;
  const msgs = stage1Messages({ title: item.title, excerpt: item.excerpt || '', src });
  if (tweak) msgs.system = tweak(msgs.system);
  const s1 = await chatJson(msgs);
  const score = clampScore(s1.score);
  const safety = Boolean(s1.safety_flag);
  const isAbsurd = Boolean(s1.is_absurd);
  return { score, is_absurd: isAbsurd, safety_flag: safety, passed: !safety && isAbsurd && score >= REWRITE_THRESHOLD };
}

// Этап 2 ровно как processRow: полный текст статьи -> рерайт -> одна попытка
// исправить нарушение правил. extraRule — только для сравнения «до/после».
export async function stage2(item, extraRule = '') {
  const src = `${host(item.link)} (${item.site})`;
  const input = { title: item.title, excerpt: item.excerpt || '', src };
  const article = await fetchArticleText(item.link);
  const msgs = stage2Messages({ ...input, excerpt: article || input.excerpt });
  if (extraRule) msgs.system = `${msgs.system}\n\n${extraRule}`;
  let s2 = await chatJson(msgs);
  const problem = violatesRules(s2.summary_ru);
  if (problem) {
    s2 = await chatJson({
      system: msgs.system,
      user:
        `${msgs.user}\n\nТвой предыдущий вариант summary_ru нарушил правило: ${problem}.\n` +
        `Прежний текст: «${s2.summary_ru}»\n` +
        'Перепиши: РОВНО одно матерное слово, один абзац, максимум 4 предложения. Тот же JSON.',
    });
  }
  return {
    title: String(s2.rewritten_title_ru || '').trim(),
    summary: String(s2.summary_ru || '').trim(),
    fullText: Boolean(article),
    retried: Boolean(problem),
    stillViolates: violatesRules(s2.summary_ru),
  };
}

// Только для замера доли политики (не часть конвейера).
export function politicsMessages(item) {
  return {
    system:
      'Ты классифицируешь новости. Касается ли новость политики? Политика здесь — война ' +
      'России с Украиной и армия, мобилизация, санкции, эмиграция и «уехавшие», иноагенты ' +
      'и «нежелательные», запреты и отмены концертов или выступлений по политическим ' +
      'причинам, высказывания о власти, выборы, политические суды, пропаганда. Верни ' +
      'строгий JSON: {"politics": boolean, "topic": "war" | "emigration" | "foreign_agent" | ' +
      '"cancellation" | "other" | "none"}',
    user: `ЗАГОЛОВОК: ${item.title}\nНАЧАЛО ТЕКСТА: ${item.excerpt || '(нет)'}`,
  };
}

export { chatJson, fetchArticleText, REWRITE_THRESHOLD };
