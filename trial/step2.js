// Пробный прогон шага 2. НИЧЕГО не пишет в базу и НИЧЕГО не публикует.
//
//   1. Здоровье текущих лент + статистика по базе (что даёт каждый источник).
//   2. Ленты-кандидаты: живы ли с серверов GitHub, сколько записей в день, язык.
//   3. Около 100 свежих записей кандидатов -> этап 1 ровно как scripts/filter.js
//      (тот же промпт, та же модель); для 3–5 лучших — этап 2 (рерайт).
//   4. Светская хроника СНГ: доля политики, ловит ли её safety_flag, правило
//      «мат про ситуацию, а не про человека» — до и после.
//   5. Сверка дублей (lib/dedup.js) на истории канала: что ловится, что нет.
//   6. Ленты для рубрики «Абсурд власти»: живы ли, отдают ли полный текст.
//
// Отчёт: trial/report/step2-report.md (+ сырые данные step2-data.json).
// Запуск: GitHub Actions, ветка trial-step2 (.github/workflows/trial-step2.yml).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchFeed, excerpt as rssExcerpt, toIso } from '../scripts/parse.js';
import {
  stage1Messages,
  stage2Messages,
  violatesRules,
  fetchArticleText,
  REWRITE_THRESHOLD,
} from '../scripts/filter.js';
import { chatJson } from '../lib/llm.js';
import { isSatire } from '../lib/blacklist.js';
import { db } from '../lib/db.js';
import { findSameStory, toStory, DEDUP_DAYS } from '../lib/dedup.js';
import { MAX_AGE_DAYS } from '../lib/config.js';
import { WEIRD_EN, SHOWBIZ_RU, POWER, PEOPLE_RULE, KNOWN_DUPLICATES } from './candidates.js';

const OUT_DIR = new URL('./report/', import.meta.url);
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;
const RESTART = Date.parse('2026-11-22T00:00:00Z'); // перезапуск конвейера

const SAMPLE_TARGET = 100; // «около 100 свежих записей»
const PER_SITE_MIN = 5;
const PER_SITE_MAX = 15;
const RU_POLITICS_PER_SITE = 30; // для доли политики берём больше записей
const TOP_REWRITE = 5;
const PEOPLE_DEMO = 3;
const LLM_CONCURRENCY = 6;
const FEED_CONCURRENCY = 8;

const report = { startedAt: new Date(NOW).toISOString(), errors: [] };
const log = (...a) => console.log(...a);

// --- помощники ---
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const clampScore = (v) => Math.min(10, Math.max(0, Number(v) || 0)); // как в filter.js
const lang = (s) => {
  const t = String(s || '');
  const cyr = (t.match(/[а-яё]/gi) || []).length;
  const lat = (t.match(/[a-z]/gi) || []).length;
  return cyr > lat ? 'ru' : 'en';
};
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const cut = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

// retries — повторы при сбое (429, 5xx, таймаут модели), с паузой.
async function pool(items, limit, fn, retries = 0) {
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

async function section(name, fn) {
  const t0 = Date.now();
  log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (e) {
    console.error(`Раздел «${name}» упал:`, e);
    report.errors.push({ section: name, error: e?.stack || String(e) });
  }
  log(`(${Math.round((Date.now() - t0) / 1000)} с)`);
}

async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// --- ленты ---
function feedStats(items) {
  const dated = items.filter((i) => i.date).map((i) => Date.parse(i.date));
  const newest = dated.length ? Math.max(...dated) : null;
  const oldest = dated.length ? Math.min(...dated) : null;
  const week = dated.filter((t) => NOW - t <= 7 * DAY).length;
  const stale = dated.filter((t) => NOW - t > MAX_AGE_DAYS * DAY).length;
  let perDay = null;
  if (dated.length) {
    perDay = oldest <= NOW - 7 * DAY ? week / 7 : dated.length / Math.max((NOW - oldest) / DAY, 0.5);
  }
  return {
    count: items.length,
    noDate: items.length - dated.length,
    newestAgeH: newest ? (NOW - newest) / 3600e3 : null,
    perDay,
    week,
    staleShare: dated.length ? stale / dated.length : null,
    lang: lang(items.slice(0, 10).map((i) => i.title).join(' ')),
  };
}

async function checkSite(site) {
  const tried = [];
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
      return { site: site.site, ok: true, url, tried, items, stats: feedStats(items) };
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'таймаут 20 с' : e?.message || String(e);
      tried.push({ url, error: cut(msg, 120) });
    }
  }
  return { site: site.site, ok: false, url: null, tried, items: [], stats: null };
}

const fresh = (items) =>
  items
    .filter((i) => i.date && NOW - Date.parse(i.date) <= MAX_AGE_DAYS * DAY && Date.parse(i.date) <= NOW + DAY)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

// --- модель ---
async function stage1(item) {
  if (isSatire(item.link)) return { satire: true, score: 0, is_absurd: false, safety_flag: false, passed: false };
  const src = `${host(item.link)} (${item.site})`; // как в processRow
  const s1 = await chatJson(stage1Messages({ title: item.title, excerpt: item.excerpt || '', src }));
  const score = clampScore(s1.score);
  const safety = Boolean(s1.safety_flag);
  const isAbsurd = Boolean(s1.is_absurd);
  return { score, is_absurd: isAbsurd, safety_flag: safety, passed: !safety && isAbsurd && score >= REWRITE_THRESHOLD };
}

// Этап 2 ровно как processRow: полный текст статьи -> рерайт -> одна попытка
// исправить нарушение правил. extraRule — только для сравнения «до/после».
async function stage2(item, extraRule = '') {
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

// Только для замера доли политики в светской хронике (не часть конвейера).
function politicsMessages(item) {
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

// ============================================================================
const md = [];
const h = (s) => md.push(`\n## ${s}\n`);
const p = (s = '') => md.push(s);

async function main() {
  const allCandidates = [...WEIRD_EN, ...SHOWBIZ_RU];
  let checkedEn = [];
  let checkedRu = [];
  let checkedPower = [];
  let sample = [];

  // 1. Текущие источники: здоровье лент + статистика по базе.
  await section('Текущие источники', async () => {
    const { data: sources, error } = await db.from('sources').select('id, name, rss_url, active');
    if (error) throw error;
    const active = sources.filter((s) => s.active);
    const checks = await pool(active, FEED_CONCURRENCY, (s) => checkSite({ site: s.name, urls: [s.rss_url] }));

    const rows = await selectAll(() =>
      db
        .from('news')
        .select('source_id, absurdity_score, safety_flag, title_rewritten, posted_to_telegram, fetched_at, original_url, title_original')
        .gte('fetched_at', new Date(NOW - 30 * DAY).toISOString())
        .order('fetched_at', { ascending: true }),
    );
    const bySource = (list) => {
      const m = new Map();
      for (const r of list) {
        const a = m.get(r.source_id) || { n: 0, scored: 0, flag: 0, pass: 0, rewritten: 0, posted: 0, sum: 0 };
        a.n++;
        if (r.absurdity_score != null) {
          a.scored++;
          a.sum += r.absurdity_score;
          if (r.safety_flag) a.flag++;
          else if (r.absurdity_score >= REWRITE_THRESHOLD) a.pass++;
        }
        if (r.title_rewritten) a.rewritten++;
        if (r.posted_to_telegram) a.posted++;
        m.set(r.source_id, a);
      }
      return m;
    };
    const m30 = bySource(rows);
    const mRestart = bySource(rows.filter((r) => Date.parse(r.fetched_at) >= RESTART));

    // Mirror и Daily Star: из каких разделов сайта приходят записи (реклама?).
    const paths = {};
    for (const s of sources.filter((x) => /Mirror|Daily Star/.test(x.name))) {
      const seg = new Map();
      for (const r of rows.filter((x) => x.source_id === s.id)) {
        let k = '?';
        try {
          // раздел сайта: первый сегмент пути + второй, если это не адрес самой статьи
          const seg = new URL(r.original_url).pathname.split('/').filter(Boolean);
          k = `/${seg[0] || ''}${seg.length > 2 && !/\d/.test(seg[1]) ? `/${seg[1]}` : ''}`;
        } catch {}
        const a = seg.get(k) || { n: 0, sum: 0, scored: 0, pass: 0 };
        a.n++;
        if (r.absurdity_score != null) {
          a.scored++;
          a.sum += r.absurdity_score;
          if (!r.safety_flag && r.absurdity_score >= REWRITE_THRESHOLD) a.pass++;
        }
        seg.set(k, a);
      }
      paths[s.name] = [...seg.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    }

    report.current = { sources, checks, m30: Object.fromEntries(m30), mRestart: Object.fromEntries(mRestart), paths };

    h('1. Текущие источники');
    p(`База: записи за 30 дней (${rows.length} шт.) и с перезапуска 22.11 — «прошли» = оценка ≥ ${REWRITE_THRESHOLD} без safety_flag.`);
    p('');
    p('| Источник | Лента сейчас | в день | старше 10 дн. | 30 дн.: записей / прошли / опубл. | с 22.11: записей / прошли / опубл. | ср. оценка |');
    p('|---|---|---|---|---|---|---|');
    for (const s of active) {
      const c = checks.find((x) => x.site === s.name);
      const a = m30.get(s.id) || { n: 0, pass: 0, posted: 0, scored: 0, sum: 0 };
      const b = mRestart.get(s.id) || { n: 0, pass: 0, posted: 0 };
      const live = c?.ok ? `жива, свежая ${Math.round(c.stats.newestAgeH)} ч назад` : `ошибка: ${c?.tried?.[0]?.error}`;
      p(
        `| ${cell(s.name)} | ${cell(live)} | ${c?.ok ? (c.stats.perDay?.toFixed(1) ?? '—') : '—'} | ${c?.ok && c.stats.staleShare != null ? pct(Math.round(c.stats.staleShare * 100), 100) : '—'} | ` +
          `${a.n} / ${a.pass} / ${a.posted} | ${b.n} / ${b.pass} / ${b.posted} | ${a.scored ? (a.sum / a.scored).toFixed(1) : '—'} |`,
      );
    }
    for (const [name, segs] of Object.entries(paths)) {
      p(`\n**${name}: разделы сайта за 30 дней** (раздел — записей, ср. оценка, прошли)\n`);
      for (const [k, a] of segs) p(`- \`${k}\` — ${a.n}, ${a.scored ? (a.sum / a.scored).toFixed(1) : '—'}, ${a.pass}`);
    }
  });

  // 2. Кандидаты: живы ли ленты с серверов GitHub.
  await section('Ленты-кандидаты', async () => {
    const res = await pool(allCandidates, FEED_CONCURRENCY, checkSite);
    checkedEn = res.slice(0, WEIRD_EN.length);
    checkedRu = res.slice(WEIRD_EN.length);
    report.candidates = res.map(({ items, ...rest }) => ({ ...rest, sampleTitles: items.slice(0, 8).map((i) => i.title) }));

    h('2. Ленты-кандидаты (проверено с серверов GitHub)');
    for (const [title, list] of [
      ['Англоязычные weird-разделы', checkedEn],
      ['Светская хроника СНГ', checkedRu],
    ]) {
      p(`\n**${title}**\n`);
      p('| Сайт | Статус | Адрес ленты | в ленте | в день | свежая | старше 10 дн. | язык |');
      p('|---|---|---|---|---|---|---|---|');
      for (const c of list) {
        if (c.ok) {
          p(
            `| ${cell(c.site)} | ✅ | ${c.url} | ${c.stats.count} | ${c.stats.perDay?.toFixed(1) ?? '—'} | ` +
              `${c.stats.newestAgeH != null ? `${Math.round(c.stats.newestAgeH)} ч` : 'без дат'} | ${c.stats.staleShare != null ? pct(Math.round(c.stats.staleShare * 100), 100) : '—'} | ${c.stats.lang} |`,
          );
        } else {
          p(`| ${cell(c.site)} | ❌ | ${cell(c.tried.map((t) => `${t.url} → ${t.error}`).join('; '))} | | | | | |`);
        }
      }
    }
  });

  // 3. Этап 1 на ~100 свежих записях кандидатов.
  await section('Этап 1 на кандидатах', async () => {
    const working = [...checkedEn, ...checkedRu].filter((c) => c.ok && fresh(c.items).length);
    const cap = Math.max(PER_SITE_MIN, Math.min(PER_SITE_MAX, Math.round(SAMPLE_TARGET / Math.max(1, working.length))));
    sample = working.flatMap((c) => fresh(c.items).slice(0, cap).map((i) => ({ ...i, group: checkedRu.includes(c) ? 'ru' : 'en' })));
    log(`Живых кандидатов со свежими записями: ${working.length}, по ${cap} с сайта → выборка ${sample.length}`);

    const s1 = await pool(sample, LLM_CONCURRENCY, stage1, 2);
    sample.forEach((it, k) => (it.s1 = s1[k]));
    const done = sample.filter((i) => i.s1 && !i.s1.error);
    const errs = sample.length - done.length;

    const dist = Array.from({ length: 11 }, (_, k) => done.filter((i) => !i.s1.safety_flag && Math.round(i.s1.score) === k).length);
    const flagged = done.filter((i) => i.s1.safety_flag);
    const passed = done.filter((i) => i.s1.passed);
    report.stage1 = { cap, sample: sample.map(({ excerpt, ...r }) => r), dist, errors: errs };

    h(`3. Этап 1: ${done.length} свежих записей кандидатов (как в scripts/filter.js)`);
    p(`По ${cap} самых свежих записей с каждого живого сайта. Ошибок модели: ${errs}.`);
    p('');
    p(`- прошли порог ${REWRITE_THRESHOLD} (условие рерайта: не safety_flag, is_absurd, оценка ≥ ${REWRITE_THRESHOLD}): **${passed.length}** из ${done.length}`);
    p(`- safety_flag: **${flagged.length}**`);
    p(`- оценки без safety_flag: ${dist.map((n, k) => `${k}: ${n}`).filter((x) => !x.endsWith(': 0')).join(', ')}`);
    p('\n**По сайтам**\n');
    p('| Сайт | записей | прошли | safety_flag | ср. оценка |');
    p('|---|---|---|---|---|');
    for (const site of [...new Set(done.map((i) => i.site))]) {
      const l = done.filter((i) => i.site === site);
      const avg = l.reduce((s, i) => s + i.s1.score, 0) / l.length;
      p(`| ${cell(site)} | ${l.length} | ${l.filter((i) => i.s1.passed).length} | ${l.filter((i) => i.s1.safety_flag).length} | ${avg.toFixed(1)} |`);
    }
    const top = done.filter((i) => !i.s1.safety_flag).sort((a, b) => b.s1.score - a.s1.score).slice(0, 10);
    p('\n**10 лучших (без safety_flag)**\n');
    p('| Оценка | Прошла | Сайт | Заголовок |');
    p('|---|---|---|---|');
    for (const i of top) p(`| ${i.s1.score} | ${i.s1.passed ? 'да' : 'нет'} | ${cell(i.site)} | ${cell(cut(i.title, 110))} |`);
    const topFlag = flagged.sort((a, b) => b.s1.score - a.s1.score).slice(0, 5);
    if (topFlag.length) {
      p('\n**Высокие оценки, но safety_flag (в канал бы не пошли)**\n');
      for (const i of topFlag) p(`- ${i.s1.score} · ${i.site} · ${cut(i.title, 110)}`);
    }
  });

  // Этап 2 для 3–5 лучших.
  await section('Этап 2 для лучших', async () => {
    const best = sample.filter((i) => i.s1?.passed).sort((a, b) => b.s1.score - a.s1.score).slice(0, TOP_REWRITE);
    const rw = await pool(best, 3, (i) => stage2(i), 2);
    report.stage2 = best.map((i, k) => ({ site: i.site, title: i.title, link: i.link, score: i.s1.score, rewrite: rw[k] }));
    h(`Этап 2: рерайт ${best.length} лучших`);
    if (!best.length) p('Порог не прошла ни одна запись — рерайтить нечего.');
    best.forEach((i, k) => {
      const r = rw[k];
      p(`\n**${k + 1}. ${cell(i.site)} · оценка ${i.s1.score}** — ${i.link}`);
      p(`> ${cell(cut(i.title, 200))}\n`);
      if (r?.error) p(`Ошибка: ${r.error}`);
      else {
        p(`**${cell(r.title)}**\n`);
        p(`${r.summary}\n`);
        p(`_полный текст статьи: ${r.fullText ? 'да' : 'нет, по RSS'}; переписано повторно: ${r.retried ? 'да' : 'нет'}${r.stillViolates ? `; осталось нарушение: ${r.stillViolates}` : ''}_`);
      }
    });
  });

  // 4. Светская хроника СНГ: политика и мат рядом с именами.
  await section('Светская хроника СНГ', async () => {
    const ruWorking = checkedRu.filter((c) => c.ok);
    const ruItems = ruWorking.flatMap((c) => fresh(c.items).slice(0, RU_POLITICS_PER_SITE));
    const pol = await pool(ruItems, LLM_CONCURRENCY, (i) => chatJson(politicsMessages(i)), 2);
    ruItems.forEach((it, k) => (it.pol = pol[k]?.error ? null : pol[k]));

    // Этап 1 для политических записей, которых нет в выборке, — чтобы честно
    // посчитать, сколько политики проскакивает мимо safety_flag.
    const inSample = new Map(sample.map((i) => [i.link, i]));
    const political = ruItems.filter((i) => i.pol?.politics);
    const need = political.filter((i) => !inSample.get(i.link)?.s1);
    const s1extra = await pool(need, LLM_CONCURRENCY, stage1, 2);
    need.forEach((it, k) => (it.s1 = s1extra[k]));
    for (const i of political) if (!i.s1) i.s1 = inSample.get(i.link)?.s1;

    const leaks = political.filter((i) => i.s1 && !i.s1.error && !i.s1.safety_flag);
    const leaksPassed = leaks.filter((i) => i.s1.passed);

    // Правило про мат рядом с именами: рерайт «до» и «после» на лучших записях хроники.
    const ruSample = sample.filter((i) => i.group === 'ru' && i.s1 && !i.s1.error && !i.s1.safety_flag);
    const demo = ruSample.sort((a, b) => Number(b.s1.passed) - Number(a.s1.passed) || b.s1.score - a.s1.score).slice(0, PEOPLE_DEMO);
    const before = await pool(demo, 3, (i) => stage2(i), 2);
    const after = await pool(demo, 3, (i) => stage2(i, PEOPLE_RULE), 2);

    report.showbiz = {
      items: ruItems.map(({ excerpt, ...r }) => r),
      leaks: leaks.map((i) => ({ site: i.site, title: i.title, topic: i.pol?.topic, score: i.s1.score, passed: i.s1.passed })),
      demo: demo.map((i, k) => ({ site: i.site, title: i.title, link: i.link, score: i.s1.score, passed: i.s1.passed, before: before[k], after: after[k] })),
    };

    h('4. Светская хроника СНГ: политика и мат рядом с именами');
    p('| Сайт | свежих записей | из них политика | темы |');
    p('|---|---|---|---|');
    for (const c of ruWorking) {
      const l = ruItems.filter((i) => i.site === c.site && i.pol);
      const pl = l.filter((i) => i.pol.politics);
      const topics = [...new Set(pl.map((i) => i.pol.topic))].join(', ');
      p(`| ${cell(c.site)} | ${l.length} | ${pl.length} (${pct(pl.length, l.length)}) | ${cell(topics)} |`);
    }
    p(`\nПолитических записей всего: **${political.length}**. Из них safety_flag поймал: **${political.length - leaks.length}**, проскочили: **${leaks.length}**, а порог ${REWRITE_THRESHOLD} прошли бы (= ушли бы в канал): **${leaksPassed.length}**.`);
    if (leaks.length) {
      p('\n**Проскочившая политика** (оценка · тема · заголовок)\n');
      for (const i of leaks.slice(0, 12)) p(`- ${i.s1.score}${i.s1.passed ? ' ⚠️ прошла' : ''} · ${i.pol.topic} · ${i.site}: ${cut(i.title, 110)}`);
    }
    p('\n**Мат рядом с именем: рерайт без правила и с правилом**\n');
    p(`Правило: ${PEOPLE_RULE}\n`);
    demo.forEach((i, k) => {
      p(`\n${k + 1}. ${cell(i.site)} · оценка ${i.s1.score}${i.s1.passed ? '' : ' (порог не прошла, рерайт — только для примера)'} — ${cell(cut(i.title, 150))}`);
      for (const [label, r] of [
        ['Без правила', before[k]],
        ['С правилом', after[k]],
      ]) {
        if (r?.error) p(`   - ${label}: ошибка ${r.error}`);
        else p(`   - **${label}:** ${cell(r.title)} — ${cell(r.summary)}`);
      }
    });
  });

  // 5. Сверка дублей на истории канала.
  await section('Сверка дублей', async () => {
    const rows = await selectAll(() =>
      db
        .from('news')
        .select('id, fetched_at, posted_at, posted_to_telegram, title_original, content_original, title_rewritten, source:sources(name)')
        .not('title_rewritten', 'is', null)
        .order('fetched_at', { ascending: true }),
    );
    const win = DEDUP_DAYS * DAY;
    const jobs = rows
      .map((b) => ({
        b,
        list: rows.filter((a) => a.id !== b.id && Date.parse(a.fetched_at) < Date.parse(b.fetched_at) && Date.parse(b.fetched_at) - Date.parse(a.fetched_at) <= win),
      }))
      .filter((j) => j.list.length);
    log(`Переписанных записей: ${rows.length}, проверок: ${jobs.length}`);

    const res = await pool(jobs, LLM_CONCURRENCY, ({ b, list }) => findSameStory(toStory(b), list.map(toStory)), 2);
    const cluster = (title) => KNOWN_DUPLICATES.find((k) => k.re.test(title || ''))?.key || null;
    const byId = new Map(rows.map((r) => [r.id, r]));

    const caught = [];
    const missed = [];
    const other = [];
    let errors = 0;
    jobs.forEach(({ b, list }, k) => {
      const r = res[k];
      if (r?.error) {
        errors++;
        return;
      }
      const cb = cluster(b.title_original);
      const expected = cb && list.some((a) => cluster(a.title_original) === cb);
      const match = r ? byId.get(r.story.id) : null;
      const entry = {
        b: { title: b.title_original, source: b.source?.name, at: b.fetched_at, posted: b.posted_to_telegram },
        a: match ? { title: match.title_original, source: match.source?.name, at: match.fetched_at } : null,
        reason: r?.reason || '',
        cluster: cb,
      };
      if (expected) (match && cluster(match.title_original) === cb ? caught : missed).push(entry);
      else if (match) other.push(entry);
    });
    report.dedup = { checks: jobs.length, errors, caught, missed, other };

    h('5. Сверка дублей на истории канала');
    p(`Каждую переписанную запись сверили с тем, что было опубликовано или стояло в очереди за ${DEDUP_DAYS} дней до неё (как будет в конвейере). Проверок: ${jobs.length}, ошибок модели: ${errors}.`);
    p(`\n**Известные дубли: поймано ${caught.length}, пропущено ${missed.length}**\n`);
    for (const e of caught) p(`- ✅ ${e.cluster}: «${cut(e.b.title, 90)}» ≈ «${cut(e.a.title, 90)}»`);
    for (const e of missed) p(`- ❌ ${e.cluster}: «${cut(e.b.title, 90)}» → ${e.a ? `спутал с «${cut(e.a.title, 80)}»` : 'не нашёл пары'}`);
    p(`\n**Другие срабатывания: ${other.length}** (проверить вручную: настоящий дубль или ложная тревога)\n`);
    for (const e of other) p(`- «${cut(e.b.title, 90)}» (${e.b.source}) ≈ «${cut(e.a.title, 90)}» (${e.a.source}) — ${cut(e.reason, 120)}`);
  });

  // 6. Ленты для рубрики «Абсурд власти».
  await section('Ленты «Абсурд власти»', async () => {
    checkedPower = await pool(POWER, FEED_CONCURRENCY, checkSite);
    const text = await pool(checkedPower, 4, async (c) => {
      if (!c.ok) return null;
      const newest = [...c.items].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))[0];
      const t = await fetchArticleText(newest.link);
      return { link: newest.link, chars: t ? t.length : 0 };
    });
    report.power = checkedPower.map(({ items, ...rest }, k) => ({ ...rest, fullText: text[k], sampleTitles: items.slice(0, 5).map((i) => i.title) }));

    h('6. Ленты для рубрики «Абсурд власти»');
    p('| Издание | Статус | в день | свежая | полный текст статьи |');
    p('|---|---|---|---|---|');
    checkedPower.forEach((c, k) => {
      if (!c.ok) return p(`| ${cell(c.site)} | ❌ ${cell(c.tried[0]?.error)} | | | |`);
      const t = text[k];
      const ft = t?.error ? `ошибка` : t?.chars ? `да, ${t.chars}+ знаков` : 'нет (пейволл или защита)';
      p(`| ${cell(c.site)} | ✅ ${c.url} | ${c.stats.perDay?.toFixed(1) ?? '—'} | ${c.stats.newestAgeH != null ? `${Math.round(c.stats.newestAgeH)} ч` : '—'} | ${ft} |`);
    });
  });
}

main()
  .catch((e) => {
    console.error('Фатальная ошибка:', e);
    report.errors.push({ section: 'main', error: e?.stack || String(e) });
  })
  .finally(() => {
    mkdirSync(OUT_DIR, { recursive: true });
    const head = [
      '# Пробный прогон шага 2',
      '',
      `Запуск: ${report.startedAt} (сервер GitHub Actions). В базу ничего не записано, в канал ничего не отправлено.`,
    ];
    if (report.errors.length) head.push('', `⚠️ Ошибок разделов: ${report.errors.length} — подробности в step2-data.json.`);
    writeFileSync(new URL('step2-report.md', OUT_DIR), `${[...head, ...md].join('\n')}\n`);
    writeFileSync(new URL('step2-data.json', OUT_DIR), JSON.stringify(report, null, 1));
    log('\nОтчёт: trial/report/step2-report.md');
  });
