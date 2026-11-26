// Рубрика «Абсурд власти»: раз в неделю один пост — самая дикая задокументированная
// деталь о людях у власти из расследования или большого материала уважаемого
// издания. Тот же голос, одно матерное слово, надпись рубрики на карточке.
//
// Когда: в первом запуске конвейера после пятницы 12:00 UTC, если выпуска этой
// недели ещё не было (неделя — от пятницы 12:00 UTC до следующей). Опоздания
// расписания GitHub рубрике не страшны. Самый первый запуск только отмечает
// старт: первый выпуск — в ближайшую пятницу.
//
// Источники — ленты с регионом POWER в db/sources.json. Основной отбор
// (filter.js) их записи не трогает.
//
// Как выбирается история:
//   1. все материалы рубрики за 7 дней — отдельный промпт отбора по заголовку и
//      началу текста (оценка 0–10);
//   2. до 10 лучших: полный текст статьи → модель находит одну самую дикую
//      деталь и точную цитату; код проверяет, что цитата правда есть в статье
//      (кавычки, тире, пробелы и регистр приводятся к одному виду); нет цитаты —
//      нет истории;
//   3. модель выбирает одну деталь из прошедших проверку;
//   4. сверка с выпусками рубрики за 8 недель: та же деталь — дубль, новая
//      деталь той же большой истории — можно;
//   5. рерайт тем же голосом (материалы редактора + правило для живых людей),
//      издание названо в тексте;
//   6. запись становится постом; post.js публикует её первой в ближайший слот.
// Пока POWER_REVIEW = true (lib/config.js), выпуск ждёт: карточка и текст
// приходят владельцу в Telegram, в канал — только после его «да». Ничего не
// прошло проверку — неделю пропускаем (и сообщаем владельцу), слабый пост не
// ставим. Каждый выпуск, пропуск и пробу сохраняем в out/power/ — workflow
// кладёт их в ветку power репозитория.
//
// Запуск:  node --env-file=.env scripts/power.js          — как в конвейере
//          node --env-file=.env scripts/power.js --dry    — проба: ленты читаются
//            напрямую, в базу ничего не пишется, в Telegram ничего не уходит.

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extract } from '@extractus/article-extractor';
import { chatJson, LlmError } from '../lib/llm.js';
import { renderCard } from '../lib/card.js';
import { buildCaption } from '../lib/caption.js';
import { getState, setState } from '../lib/state.js';
import { notifyOwner, sendPhoto } from '../lib/telegram.js';
import { POWER_REVIEW } from '../lib/config.js';
import { POWER_LABEL, POWER_REGION, powerSourceIds } from '../lib/power.js';
import { EDITOR_PROMPT, PEOPLE_RULE, violatesRules } from './filter.js';
import { fetchFeed, excerpt as rssExcerpt, toIso } from './parse.js';
import { loadSourceList } from './sources.js';

const DAY = 24 * 3600 * 1000;
const STATE_KEY = 'power';
const POOL_DAYS = 7;
const PREVIOUS_DAYS = 56; // сверка дублей с выпусками за 8 недель
const MIN_SELECT_SCORE = 6; // отбор по заголовку
const TOP_N = 10;
const MIN_DETAIL_SCORE = 6; // деталь из полного текста
const MIN_QUOTE_WORDS = 6;
const ARTICLE_TIMEOUT_MS = 20_000;
const ARTICLE_FOR_MODEL = 20_000; // символов статьи — модели на поиск детали
const ARTICLE_FOR_REWRITE = 6_000;
const SELECT_CONCURRENCY = 4;
const DETAIL_CONCURRENCY = 3;
const OUT_DIR = new URL('../out/power/', import.meta.url);

const iso = (ms) => new Date(ms).toISOString();
const clampScore = (v) => Math.min(10, Math.max(0, Number(v) || 0));
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const dateRu = (ms) =>
  new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

// Начало недели рубрики: последняя пятница 12:00 UTC, не позже now.
export function weekStart(now) {
  const d = new Date(now);
  const sinceFriday = (d.getUTCDay() - 5 + 7) % 7;
  const fri = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceFriday, 12, 0, 0);
  return fri <= now ? fri : fri - 7 * DAY;
}

// --- текст статьи и проверка цитаты ---

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  ndash: '–', mdash: '—', minus: '−', hyphen: '-', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“',
  rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', hellip: '…',
  prime: '′', Prime: '″', shy: '', zwj: '', zwnj: '', middot: '·', bull: '•', deg: '°',
};
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(cp);
      } catch {
        return ' ';
      }
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? ' ';
  });
}

export function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
      // строчные теги убираем без пробела, чтобы не рвать слова
      .replace(/<\/?(a|em|strong|b|i|u|span|sup|sub|abbr|small|mark|q|cite|time)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

async function articleText(url) {
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ARTICLE_TIMEOUT_MS));
    const art = await Promise.race([extract(url), timeout]);
    const text = htmlToText(art?.content);
    if (text.includes('�') || text.length < 400) return null;
    return text;
  } catch {
    return null;
  }
}

// Приводим цитату и текст статьи к одному виду: регистр, все виды кавычек и
// апострофов (убираются), тире и дефисы, пробелы (в т. ч. неразрывные),
// многоточие. Иначе настоящие цитаты выбывали бы из-за «ёлочек» и длинных тире.
export function normQuote(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/[‐-―−⁃﹘﹣－-]/g, '-')
    .replace(/["'`«»‘-‟′-‷‹›❛-❞〝-〟＂＇]/g, '')
    .replace(/…/g, '...')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Цитата есть в статье? Многоточие внутри цитаты (пропуск) допускаем, если
// каждый кусок длиннее трёх слов и куски идут по порядку.
export function quoteInText(quote, text) {
  const q = normQuote(quote).replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, '');
  if (q.split(' ').length < MIN_QUOTE_WORDS) return false;
  const t = normQuote(text);
  const parts = q.split(/\s*\.\.\.\s*/).map((p) => p.replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, '')).filter(Boolean);
  let from = 0;
  for (const p of parts) {
    if (parts.length > 1 && p.split(' ').length < 3) return false;
    const at = t.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

// --- промпты ---

const ROLE =
  'Ты — редактор рубрики «Абсурд власти» в Telegram-канале подлинных абсурдных новостей. ' +
  'Раз в неделю рубрика публикует одну историю: самую дикую реальную деталь о людях у ' +
  'власти из расследования или большого материала уважаемого издания. Голос канала ровный, ' +
  'почти протокольный: смешно не потому, что мы шутим, а потому, что это правда.\n';

const NOT_OURS =
  'Не наш жанр: колонки, мнения, анализ без новых фактов, подкасты, прямые трансляции, ' +
  'опросы, гонка кампаний и рейтинги; истории, где смешное — страдание жертв (смерти, ' +
  'насилие, катастрофы, болезни); война России с Украиной и всё про армию России; истории, ' +
  'суть которых — обвинение названного человека в преступлении (уголовное дело, коррупция, ' +
  '«по словам источников»).';

export function selectMessages(item) {
  return {
    system:
      ROLE +
      'Оцени материал по ЗАГОЛОВКУ и НАЧАЛУ ТЕКСТА.\n' +
      'Цель — люди у власти: президент США и его окружение, конгрессмены и сенаторы, ' +
      'министры, губернаторы, чиновники, ведомства, суды как власть.\n' +
      'Абсурд должен быть в задокументированном факте: документ, судебная запись, ' +
      'расходы, приказ, официальное заявление, цитата под запись. Мнение, оценка или ' +
      'прогноз — не факт.\n' +
      `${NOT_OURS} Такое — score 0–2.\n` +
      'Выше ставим расследования и большие материалы с конкретикой — цифрами, датами, ' +
      'названиями документов; нелепость, которую власть сделала сама и публично или ' +
      'которая записана в документах.\n' +
      'Шкала: 9–10 — дичь, в которую трудно поверить, подтверждённая документом; 6–8 — ' +
      'явная нелепость власти с конкретикой; 3–5 — странно, но для политики обычно; 0–2 — ' +
      'не наш жанр.\n' +
      'Верни строгий JSON: {"score": number, "target": "кто у власти", "why": "коротко, в чём абсурд"}',
    user: `ЗАГОЛОВОК: ${item.title}\nНАЧАЛО ТЕКСТА: ${item.excerpt || '(нет)'}\nИЗДАНИЕ: ${item.source}`,
  };
}

export function detailMessages(item, text) {
  return {
    system:
      ROLE +
      'Ниже полный текст статьи. Найди в нём ОДНУ самую дикую, абсурдную деталь о людях у ' +
      'власти — задокументированный факт (документ, запись, расходы, приказ, официальное ' +
      'заявление, цитата под запись), а не мнение.\n' +
      `${NOT_OURS} Такие детали не бери.\n` +
      'quote — ТОЧНАЯ цитата из текста статьи, слово в слово, на языке статьи: 8–40 слов, ' +
      'одно-два предложения подряд, без пропусков и многоточий внутри. Ничего не переводи и ' +
      'не пересказывай в quote. detail_ru — эта же деталь по-русски, одно-два предложения, ' +
      'только факты из статьи. Если подходящей детали нет — score 0.\n' +
      'Верни строгий JSON: {"score": number 0-10, "detail_ru": string, "quote": string, ' +
      '"target": "кто у власти", "why": "почему это абсурд"}',
    user:
      `ЗАГОЛОВОК: ${item.title}\nИЗДАНИЕ: ${item.source}\n` +
      `ТЕКСТ СТАТЬИ:\n${text.slice(0, ARTICLE_FOR_MODEL)}`,
  };
}

export function pickMessages(cands) {
  return {
    system:
      ROLE +
      'Ниже кандидаты недели: у каждого — деталь и точная цитата из статьи. Выбери ОДНУ — ' +
      'самую дикую и самую конкретную нелепость людей у власти, которая сработает в короткой ' +
      'заметке без долгого контекста. Цель — власть, а не жертвы.\n' +
      'Верни строгий JSON: {"best": номер кандидата, "reason": "коротко, почему"}',
    user: cands
      .map(
        (c, i) =>
          `${i + 1}. [${c.item.source}] ${clip(c.item.title, 200)}\n` +
          `Деталь: ${clip(c.detail_ru, 400)}\nЦитата: ${clip(c.quote, 400)}\nПочему: ${clip(c.why, 200)}`,
      )
      .join('\n\n'),
  };
}

export function powerDedupMessages(cand, previous) {
  return {
    system:
      'Ты — выпускающий редактор рубрики «Абсурд власти». Задача — не повторить выпуск. ' +
      'Дано: НОВАЯ деталь и СПИСОК прошлых выпусков рубрики.\n' +
      'Дубль — та же деталь: тот же факт, тот же документ, тот же эпизод, даже пересказанный ' +
      'другим изданием или другими словами.\n' +
      'НЕ дубль — новая деталь той же большой истории (файлы Эпштейна, расследование о ' +
      'конгрессмене, суд о президентских указах): новая подробность, новый документ, новый ' +
      'эпизод.\nЕсли сомневаешься — это не дубль.\n' +
      'Верни строгий JSON: {"same_as": номер из списка или null, "reason": "коротко, почему"}',
    user:
      `НОВАЯ ДЕТАЛЬ:\n${clip(cand.item.title, 300)}\n${clip(cand.detail_ru, 400)}\n${clip(cand.quote, 400)}` +
      `\n\nСПИСОК:\n${previous.map((p, i) => `${i + 1}. ${clip(p.title, 200)} — ${clip(p.text, 400)}`).join('\n')}`,
  };
}

export function rewriteMessages(cand) {
  return {
    system:
      'Ты — автор Telegram-канала абсурдных новостей. Ниже материалы редактора (якоря ' +
      'оценки и примеры авторского стиля). Перенеси авторский стиль из примеров.\n\n' +
      EDITOR_PROMPT +
      '\n\nСейчас — выпуск рубрики «Абсурд власти»: в центре одна задокументированная деталь ' +
      'о людях у власти (она ниже вместе с точной цитатой и текстом статьи).\n' +
      '- rewritten_title_ru: хлёсткий заголовок на русском (без мата), про эту деталь;\n' +
      '- summary_ru: РОВНО один абзац, максимум 4 предложения. Сначала где и кто, потом сама ' +
      'деталь — прямо, без эвфемизмов. Обязательно назови издание, откуда факт («как ' +
      'выяснила ProPublica», «пишет BBC», «по документам, которые получило NPR») — латиницей, ' +
      'как в оригинале.\n' +
      'ЖЁСТКОЕ ПРАВИЛО: в summary_ru РОВНО ОДНО матерное слово — про ситуацию, не про ' +
      'человека. Не ноль, не два.\n' +
      'СТРОГО: не добавляй фактов, цифр, цитат и деталей, которых нет в тексте статьи; не ' +
      'выдумывай прямую речь. Верни строгий JSON: {"rewritten_title_ru": string, "summary_ru": string}' +
      `\n\n${PEOPLE_RULE}`,
    user:
      `ДЕТАЛЬ: ${cand.detail_ru}\nЦИТАТА: ${cand.quote}\nЗАГОЛОВОК: ${cand.item.title}\n` +
      `ИЗДАНИЕ: ${cand.item.source}\nТЕКСТ СТАТЬИ:\n${cand.text.slice(0, ARTICLE_FOR_REWRITE)}`,
  };
}

// Название издания, которое должно прозвучать в тексте («BBC — US & Canada» → BBC).
const BRAND_ALIASES = {
  bbc: ['bbc', 'би-би-си'],
  'new yorker': ['new yorker', 'нью-йоркер'],
  'rolling stone': ['rolling stone', 'роллинг стоун'],
  propublica: ['propublica', 'пропублика'],
};
export function namesOutlet(summary, sourceName) {
  const brand = String(sourceName || '').split(' — ')[0].replace(/^The\s+/i, '').trim().toLowerCase();
  const aliases = BRAND_ALIASES[brand] || [brand];
  const s = String(summary || '').toLowerCase();
  return aliases.some((a) => a && s.includes(a));
}

// --- отбор ---

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      try {
        out[k] = await fn(items[k]);
      } catch (e) {
        out[k] = { error: e };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// items: [{ id?, title, excerpt, url, source, published }]
// previous: [{ title, text }] — прошлые выпуски рубрики.
// Возвращает { chosen | null, report }.
export async function pickIssue(items, previous, log = console.log) {
  const report = { pool: items.length, bySource: {}, scored: [], details: [], pick: null, dups: [], notes: [], reason: null };
  for (const it of items) report.bySource[it.source] = (report.bySource[it.source] || 0) + 1;
  if (!items.length) {
    report.reason = 'за неделю в лентах рубрики нет ни одного материала';
    return { chosen: null, report };
  }

  // 1. Отбор по заголовку.
  const s1 = await pool(items, SELECT_CONCURRENCY, async (it) => {
    const r = await chatJson(selectMessages(it));
    return { item: it, score: clampScore(r.score), why: String(r.why || ''), target: String(r.target || '') };
  });
  const failed = s1.filter((r) => r.error);
  if (failed.length > items.length / 2) {
    throw new LlmError(`отбор: модель не ответила на ${failed.length} из ${items.length}`);
  }
  report.scored = s1.filter((r) => !r.error).sort((a, b) => b.score - a.score);
  const top = report.scored.filter((r) => r.score >= MIN_SELECT_SCORE).slice(0, TOP_N);
  log(`Рубрика: материалов ${items.length}, оценка ≥ ${MIN_SELECT_SCORE} — у ${top.length}`);
  if (!top.length) {
    report.reason = `ни один из ${items.length} материалов не набрал ${MIN_SELECT_SCORE} баллов на отборе`;
    return { chosen: null, report };
  }

  // 2. Деталь и цитата из полного текста; цитату проверяет код.
  const raw = await pool(top, DETAIL_CONCURRENCY, async (t) => {
    const d = { item: t.item, selectScore: t.score, ok: false, note: '' };
    const text = await articleText(t.item.url);
    if (!text) {
      d.note = 'полный текст не открылся';
      return d;
    }
    let r;
    try {
      r = await chatJson(detailMessages(t.item, text));
    } catch (e) {
      d.note = `модель не ответила: ${e.message}`;
      return d;
    }
    Object.assign(d, {
      score: clampScore(r.score),
      detail_ru: String(r.detail_ru || '').trim(),
      quote: String(r.quote || '').trim(),
      why: String(r.why || '').trim(),
      target: String(r.target || '').trim(),
      text,
    });
    if (d.score < MIN_DETAIL_SCORE) d.note = `деталь слабая (${d.score})`;
    else if (!quoteInText(d.quote, text)) d.note = 'цитаты нет в статье';
    else {
      d.ok = true;
      d.note = 'цитата найдена в статье';
    }
    return d;
  });
  report.details = raw.map((d, i) =>
    d.error ? { item: top[i].item, selectScore: top[i].score, ok: false, note: `ошибка: ${d.error.message}` } : d,
  );
  const verified = report.details.filter((d) => d.ok);
  log(`Рубрика: деталь с подтверждённой цитатой — у ${verified.length} из ${top.length}`);

  // 3–4. Выбор модели + сверка с прошлыми выпусками; дубль — выбираем снова.
  let cands = verified;
  while (cands.length) {
    let best = 0;
    if (cands.length > 1) {
      try {
        const r = await chatJson(pickMessages(cands));
        const n = Number(r.best);
        best = Number.isInteger(n) && n >= 1 && n <= cands.length ? n - 1 : 0;
        report.pick = { title: cands[best].item.title, reason: String(r.reason || '') };
      } catch {
        best = cands.reduce((bi, c, i) => (c.score > cands[bi].score ? i : bi), 0);
        report.pick = { title: cands[best].item.title, reason: 'модель не ответила — взята самая высокая оценка' };
      }
    } else {
      report.pick = { title: cands[0].item.title, reason: 'единственный кандидат' };
    }
    const cand = cands[best];
    if (previous.length) {
      let r = null;
      try {
        r = await chatJson(powerDedupMessages(cand, previous));
      } catch (e) {
        // Сверка не ответила — не теряем неделю: выпуск всё равно проходит проверку.
        report.notes.push(`Сверка дублей не ответила (${e.message}) — выпуск взят без неё.`);
      }
      const n = Number(r?.same_as);
      if (Number.isInteger(n) && n >= 1 && n <= previous.length) {
        report.dups.push({ title: cand.item.title, same: previous[n - 1].title, reason: String(r.reason || '') });
        cands = cands.filter((c) => c !== cand);
        continue;
      }
    }
    return { chosen: cand, report };
  }
  report.reason = verified.length
    ? 'все подходящие детали уже были в прошлых выпусках'
    : `ни у одного из ${top.length} лучших материалов не нашлось сильной детали с цитатой, которая есть в статье`;
  return { chosen: null, report };
}

// Рерайт выпуска: одна попытка исправить нарушения (мат, длина, нет издания).
export async function writeIssue(cand) {
  const msgs = rewriteMessages(cand);
  const problems = (s) =>
    [violatesRules(s.summary_ru), namesOutlet(s.summary_ru, cand.item.source) ? null : 'не названо издание']
      .filter(Boolean)
      .join('; ');
  let s = await chatJson(msgs);
  let problem = problems(s);
  let retried = false;
  if (problem) {
    retried = true;
    s = await chatJson({
      system: msgs.system,
      user:
        `${msgs.user}\n\nТвой предыдущий вариант summary_ru нарушил правило: ${problem}.\n` +
        `Прежний текст: «${s.summary_ru}»\n` +
        'Перепиши: РОВНО одно матерное слово, один абзац, максимум 4 предложения, издание ' +
        'названо латиницей. Тот же JSON.',
    });
    problem = problems(s);
  }
  return {
    title: String(s.rewritten_title_ru || '').trim(),
    summary: String(s.summary_ru || '').trim(),
    retried,
    problem: problem || null,
  };
}

// --- данные ---

async function loadPool(db, ids, now) {
  const { data, error } = await db
    .from('news')
    .select('id, original_url, title_original, content_original, source_published_at, source:sources(name)')
    .in('source_id', ids)
    .is('title_rewritten', null)
    .gte('source_published_at', iso(now - POOL_DAYS * DAY))
    .order('source_published_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    title: r.title_original || '',
    excerpt: r.content_original || '',
    url: r.original_url,
    source: r.source?.name || '',
    published: r.source_published_at,
  }));
}

async function loadPrevious(db, ids, now) {
  const { data, error } = await db
    .from('news')
    .select('title_rewritten, content_summary')
    .in('source_id', ids)
    .not('title_rewritten', 'is', null)
    .gte('fetched_at', iso(now - PREVIOUS_DAYS * DAY));
  if (error) throw error;
  return data.map((r) => ({ title: r.title_rewritten, text: r.content_summary || '' }));
}

// Проба: ленты рубрики из db/sources.json читаются напрямую.
async function poolFromFeeds(now) {
  const feeds = loadSourceList().filter((s) => s.active && s.region === POWER_REGION);
  const items = [];
  for (const f of feeds) {
    try {
      const feed = await fetchFeed(f.rss_url);
      for (const it of feed.items || []) {
        const url = [it.link, it.guid].find((v) => /^https?:\/\//i.test(v || ''));
        const published = toIso(it);
        if (!url || !it.title || !published || now - Date.parse(published) > POOL_DAYS * DAY) continue;
        items.push({ id: null, title: it.title.trim(), excerpt: rssExcerpt(it) || '', url, source: f.name, published });
      }
    } catch (e) {
      console.error(`Проба: лента ${f.name} не открылась — ${e.message}`);
    }
  }
  return items;
}

// --- отчёт (ветка power) ---

function saveReport(kind, weekMs, { chosen, report, rw, png, mode }) {
  mkdirSync(OUT_DIR, { recursive: true });
  const name = `${iso(weekMs).slice(0, 10)}-${kind}`;
  const L = [];
  const head = { vypusk: 'выпуск', proba: 'проба (в канал не идёт)', propusk: 'пропуск недели' }[kind];
  L.push(`# «Абсурд власти» — ${head}`, '');
  L.push(`Неделя с ${dateRu(weekMs)} (пятница 12:00 UTC). Собрано ${iso(Date.now()).slice(0, 16).replace('T', ' ')} UTC. ${mode}`, '');
  if (chosen && rw) {
    if (png) {
      writeFileSync(new URL(`${name}.png`, OUT_DIR), png);
      L.push(`![карточка](${name}.png)`, '');
    }
    L.push(`**Заголовок:** ${rw.title}`, '', `**Текст:** ${rw.summary}`, '');
    L.push(`**Деталь:** ${chosen.detail_ru}`, '', `**Цитата** (найдена в тексте статьи): «${chosen.quote}»`, '');
    L.push(`**Источник:** ${chosen.item.source} — ${chosen.item.url}`, '');
    L.push(`Рерайт: ${rw.retried ? 'переписан повторно' : 'с первого раза'}; нарушения: ${rw.problem || 'нет'}.`, '');
  } else {
    L.push(`**Выпуска нет:** ${report.reason}.`, '');
  }
  L.push('## Как выбирали', '');
  L.push(`Материалов за ${POOL_DAYS} дней: ${report.pool} (${Object.entries(report.bySource).map(([k, v]) => `${k} — ${v}`).join(', ') || '—'}).`, '');
  const dist = {};
  for (const r of report.scored) dist[r.score] = (dist[r.score] || 0) + 1;
  L.push(`Оценки отбора: ${Object.entries(dist).sort((a, b) => b[0] - a[0]).map(([k, v]) => `«${k}» — ${v}`).join(', ') || '—'}.`, '');
  if (report.scored.length) {
    L.push('| Оценка | Издание | Заголовок | Почему |', '|---|---|---|---|');
    for (const r of report.scored.slice(0, 15)) {
      L.push(`| ${r.score} | ${r.item.source} | ${clip(r.item.title, 110).replace(/\|/g, '/')} | ${clip(r.why, 90).replace(/\|/g, '/')} |`);
    }
    L.push('');
  }
  if (report.details.length) {
    L.push('**Детали из полного текста**', '', '| Отбор | Деталь | Цитата | Проверка |', '|---|---|---|---|');
    for (const d of report.details) {
      L.push(`| ${d.selectScore} → ${d.score ?? '—'} | ${clip(d.detail_ru || d.item.title, 140).replace(/\|/g, '/')} | ${clip(d.quote, 140).replace(/\|/g, '/')} | ${d.ok ? '✅' : '❌'} ${d.note} |`);
    }
    L.push('');
  }
  if (report.pick) L.push(`**Выбор модели:** ${report.pick.title} — ${report.pick.reason}`, '');
  for (const d of report.dups) L.push(`Дубль прошлого выпуска: ${d.title} ≈ ${d.same} — ${d.reason}`);
  for (const n of report.notes) L.push(n);
  writeFileSync(new URL(`${name}.md`, OUT_DIR), `${L.join('\n')}\n`);
  return name;
}

// --- владелец ---

async function previewToOwner({ chosen, rw, png, first, report }) {
  const caption = buildCaption({ summary: rw.summary, sourceName: chosen.item.source, url: chosen.item.url });
  if (process.env.OWNER_CHAT_ID && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await sendPhoto(process.env.OWNER_CHAT_ID, png, caption, 'HTML');
    } catch (e) {
      console.error(`Рубрика: карточку владельцу отправить не удалось — ${e.message}`);
    }
  }
  const passed = report.details.filter((d) => d.ok).length;
  await notifyOwner(
    `👆 «Абсурд власти» — ${first ? 'первый выпуск' : 'выпуск недели'}. В канал не ушёл, ждёт твоего «да».\n\n` +
      `Деталь: ${chosen.detail_ru}\n\nЦитата из статьи: «${clip(chosen.quote, 500)}»\n\n` +
      `${chosen.item.source}: ${chosen.item.url}\n\n` +
      `Из ${report.pool} материалов недели на отборе прошли ${report.details.length}, цитату ` +
      `подтвердили ${passed}.${rw.problem ? `\nНарушение правил рерайта: ${rw.problem}.` : ''}\n\n` +
      'Опубликовать — скажи Claude «да». Не нравится — скажи, что поправить.',
  );
}

// --- запуск ---

export async function runPower(db, now = Date.now(), log = console.log) {
  const ids = await powerSourceIds(db);
  if (!ids.length) return log('Рубрика: лент рубрики нет — пропуск');
  const week = weekStart(now);
  const state = await getState(db, STATE_KEY);

  if (!state) {
    await setState(db, STATE_KEY, { week: iso(week), status: 'start', at: iso(now) });
    return log(`Рубрика запущена. Первый выпуск — в первом запуске после ${dateRu(week + 7 * DAY)}, 12:00 UTC.`);
  }

  // Владелец сказал «да» (POWER_REVIEW = false) — ждущий выпуск уходит в канал.
  if (state.status === 'held' && !POWER_REVIEW) {
    const { error } = await db.from('news').update({ safety_flag: false }).eq('id', state.rowId);
    if (error) throw error;
    Object.assign(state, { status: 'released', releasedAt: iso(now) });
    await setState(db, STATE_KEY, state);
    log(`Рубрика: выпуск «${state.title}» одобрен — выходит в ближайший слот`);
  }

  if (state.week >= iso(week)) return log(`Рубрика: выпуск недели с ${dateRu(Date.parse(state.week))} — ${state.status}`);

  const items = await loadPool(db, ids, now);
  const previous = await loadPrevious(db, ids, now);
  const { chosen, report } = await pickIssue(items, previous, log);

  if (!chosen) {
    await setState(db, STATE_KEY, { week: iso(week), status: 'skipped', at: iso(now), reason: report.reason });
    saveReport('propusk', week, { report, mode: 'Выпуска нет.' });
    await notifyOwner(`«Абсурд власти»: на этой неделе выпуска нет — ${report.reason}. Слабый пост не ставим.`);
    return log(`Рубрика: неделя пропущена — ${report.reason}`);
  }

  const rw = await writeIssue(chosen);
  const { error } = await db
    .from('news')
    .update({
      title_rewritten: rw.title,
      content_summary: rw.summary,
      absurdity_score: Math.max(5, chosen.score),
      safety_flag: POWER_REVIEW, // ждёт «да» владельца — до тех пор не публикуется
    })
    .eq('id', chosen.item.id);
  if (error) throw error;
  const status = POWER_REVIEW ? 'held' : 'released';
  await setState(db, STATE_KEY, { week: iso(week), status, rowId: chosen.item.id, at: iso(now), title: rw.title });

  const png = renderCard({ title: rw.title, source: chosen.item.source, label: POWER_LABEL });
  saveReport('vypusk', week, {
    chosen, report, rw, png,
    mode: POWER_REVIEW ? 'Ждёт «да» владельца.' : 'Публикуется в ближайший слот.',
  });
  if (POWER_REVIEW) await previewToOwner({ chosen, rw, png, first: !previous.length, report });
  return log(`Рубрика: выпуск «${rw.title}» — ${POWER_REVIEW ? 'ждёт «да» владельца' : 'в ближайший слот'}`);
}

export async function runDry(db, now = Date.now(), log = console.log) {
  const ids = await powerSourceIds(db).catch(() => []);
  const items = await poolFromFeeds(now);
  const previous = ids.length ? await loadPrevious(db, ids, now).catch(() => []) : [];
  const { chosen, report } = await pickIssue(items, previous, log);
  const week = weekStart(now);
  if (!chosen) {
    saveReport('proba', week, { report, mode: 'Проба: в базу ничего не записано, в Telegram ничего не ушло.' });
    return log(`Проба: выпуска нет — ${report.reason}`);
  }
  const rw = await writeIssue(chosen);
  const png = renderCard({ title: rw.title, source: chosen.item.source, label: POWER_LABEL });
  const name = saveReport('proba', week, {
    chosen, report, rw, png,
    mode: 'Проба: в базу ничего не записано, в Telegram ничего не ушло.',
  });
  return log(`Проба: «${rw.title}» — out/power/${name}.md`);
}

async function main() {
  const { db } = await import('../lib/db.js');
  if (process.argv.includes('--dry')) await runDry(db);
  else await runPower(db);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Рубрика «Абсурд власти» — ошибка:', e);
    process.exit(1);
  });
}
