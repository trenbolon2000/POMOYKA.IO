// Шаг 3. Двухэтапная LLM-обработка необработанных записей news.
//
//   Этап 1 (дешёвый): заголовок + выжимка из RSS -> is_absurd, score 1-10, safety_flag.
//   Этап 2 (рерайт):   только для прошедших порог. Догружаем полный текст статьи
//                      (article-extractor) и переписываем по нему на русском.
//
// Запуск:  node --env-file=.env scripts/filter.js [сколько_записей]
//          (без аргумента — BATCH_DEFAULT; для теста Шага 3: `... filter.js 200`)
//
// Отказоустойчивость (§8):
//   - ошибка LLM НЕ помечает запись обработанной — она подхватится следующим
//     запуском;
//   - запуск, где не удалось обработать ни одной записи, увеличивает счётчик
//     llm_fail_streak; на 3-м подряд — личное сообщение владельцу в Telegram.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extract } from '@extractus/article-extractor';
import { db } from '../lib/db.js';
import { isSatire } from '../lib/blacklist.js';
import { chatJson, LlmAuthError, LlmError } from '../lib/llm.js';
import { notifyOwner } from '../lib/telegram.js';

const BATCH_DEFAULT = 40;
const REWRITE_THRESHOLD = 7; // §7: публикуются score >= 7
const FAIL_STREAK_ALERT = 3; // §8
const ARTICLE_TIMEOUT_MS = 15_000;
const ARTICLE_MAX_CHARS = 4000;

const EDITOR_PROMPT = readFileSync(new URL('../prompts/editor.md', import.meta.url), 'utf8').trim();
if (EDITOR_PROMPT.length < 40) {
  throw new Error('prompts/editor.md пуст — это Шаг 0, его заполняет владелец');
}

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const clampScore = (v) => Math.min(10, Math.max(0, Number(v) || 0));

// Полный текст статьи для этапа 2. Тянем только для прошедших порог (~единицы за
// прогон). Ошибка/пейволл/таймаут -> null, рерайт делается по выжимке из RSS.
async function fetchArticleText(url) {
  try {
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('timeout')), ARTICLE_TIMEOUT_MS),
    );
    const art = await Promise.race([extract(url), timeout]);
    const text = String(art?.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 120 ? text.slice(0, ARTICLE_MAX_CHARS) : null;
  } catch {
    return null;
  }
}

// --- app_state: счётчик подряд неудачных LLM-этапов ---
async function getState(key) {
  const { data } = await db.from('app_state').select('value').eq('key', key).maybeSingle();
  return data?.value;
}
async function setState(key, value) {
  await db.from('app_state').upsert({ key, value, updated_at: new Date().toISOString() });
}

// --- LLM-этапы ---
function stage1Messages({ title, excerpt, src }) {
  return {
    system:
      'Ты — редактор Telegram-канала подлинных абсурдных новостей. Ниже рабочие ' +
      'материалы редактора (якоря оценки и примеры стиля).\n\n' +
      EDITOR_PROMPT +
      '\n\nОцени новость по ЗАГОЛОВКУ и НАЧАЛУ ТЕКСТА:\n' +
      '- score: насколько это абсурдный курьёз, число 1-10 (ориентир — якоря выше);\n' +
      '- is_absurd: true, если это подлинный курьёз, а не обычная новость;\n' +
      '- safety_flag: true, если это криминал, политика, реальная трагедия или ' +
      'насилие — даже если звучит дико.\n' +
      'Ничего не переписывай. Верни строгий JSON: ' +
      '{"is_absurd": boolean, "score": number, "safety_flag": boolean}',
    user: `ЗАГОЛОВОК: ${title}\nНАЧАЛО ТЕКСТА: ${excerpt || '(нет)'}\nИСТОЧНИК: ${src}`,
  };
}

function stage2Messages({ title, excerpt, src }) {
  return {
    system:
      'Ты — автор Telegram-канала абсурдных новостей. Ниже материалы редактора ' +
      '(якоря оценки и примеры авторского стиля). Перенеси авторский стиль из ' +
      'примеров.\n\n' +
      EDITOR_PROMPT +
      '\n\nПо исходной новости сделай:\n' +
      '- rewritten_title_ru: хлёсткий заголовок на русском;\n' +
      '- summary_ru: выжимка 1-2 абзаца на русском.\n' +
      'СТРОГО: не добавляй фактов, цифр, цитат и деталей, которых нет в исходном ' +
      'тексте. Верни строгий JSON: {"rewritten_title_ru": string, "summary_ru": string}',
    user: `ЗАГОЛОВОК: ${title}\nТЕКСТ: ${excerpt || '(нет)'}\nИСТОЧНИК: ${src}`,
  };
}

async function processRow(row) {
  const src = `${host(row.original_url)}${row.source?.name ? ` (${row.source.name})` : ''}`;

  // Сатирический домен — отсекаем в коде, без LLM. score 0 = не опубликуется.
  if (isSatire(row.original_url)) {
    await db.from('news').update({ absurdity_score: 0, safety_flag: false }).eq('id', row.id);
    return { kind: 'satire' };
  }

  const input = { title: row.title_original || '', excerpt: row.content_original || '', src };

  const s1 = await chatJson(stage1Messages(input));
  const score = clampScore(s1.score);
  const safety = Boolean(s1.safety_flag);
  const patch = { absurdity_score: score, safety_flag: safety };

  let rewritten = false;
  let fullText = false;
  if (!safety && s1.is_absurd && score >= REWRITE_THRESHOLD) {
    const article = await fetchArticleText(row.original_url);
    fullText = Boolean(article);
    const s2 = await chatJson(stage2Messages({ ...input, excerpt: article || input.excerpt }));
    patch.title_rewritten = String(s2.rewritten_title_ru || '').trim() || null;
    patch.content_summary = String(s2.summary_ru || '').trim() || null;
    rewritten = Boolean(patch.title_rewritten && patch.content_summary);
  }

  const { error } = await db.from('news').update(patch).eq('id', row.id);
  if (error) throw new LlmError(`БД update: ${error.message}`);
  return { kind: 'scored', score, safety, rewritten, fullText };
}

async function main() {
  const batch = Number(process.argv[2]) || BATCH_DEFAULT;

  const { data: rows, error } = await db
    .from('news')
    .select('id, original_url, title_original, content_original, source:sources(name)')
    .is('absurdity_score', null)
    .order('fetched_at', { ascending: true })
    .limit(batch);
  if (error) throw error;

  console.log(`К обработке: ${rows.length} (лимит ${batch})\n`);

  let ok = 0;
  let errs = 0;
  let satire = 0;
  let flagged = 0;
  let rewrites = 0;
  let authError = null;

  for (const row of rows) {
    try {
      const r = await processRow(row);
      ok++;
      if (r.kind === 'satire') {
        satire++;
        console.log(`SATIRE  ${row.title_original?.slice(0, 80)}`);
      } else {
        if (r.safety) flagged++;
        if (r.rewritten) rewrites++;
        const tag = r.safety ? 'FLAG' : String(r.score).padStart(2);
        const mark = r.rewritten ? (r.fullText ? ' ✍+текст' : ' ✍(RSS)') : '';
        console.log(`${tag}${mark} ${row.title_original?.slice(0, 80)}`);
      }
    } catch (e) {
      if (e instanceof LlmAuthError) {
        authError = e;
        break; // дальше долбить мёртвый ключ смысла нет
      }
      errs++;
      console.error(`ERR   ${e.message} — ${row.title_original?.slice(0, 60)}`);
    }
  }

  console.log(
    `\nОбработано ${ok} (рерайт ${rewrites}, safety_flag ${flagged}, сатира ${satire}), ` +
      `ошибок ${errs}${authError ? ', LLM auth/оплата: ' + authError.message : ''}`,
  );

  // §8: учёт подряд неудачных запусков.
  const attempted = ok + errs + (authError ? 1 : 0);
  if (attempted > 0 && ok === 0) {
    const streak = (Number(await getState('llm_fail_streak')) || 0) + 1;
    await setState('llm_fail_streak', streak);
    console.error(`Неудачных LLM-запусков подряд: ${streak}`);
    if (streak >= FAIL_STREAK_ALERT) {
      await notifyOwner(
        `⚠️ Помойка: LLM-этап не отработал ${streak} запуска подряд. ` +
          `Проверь баланс и ключ (модель ${process.env.LLM_MODEL}). ` +
          `Последняя ошибка: ${authError?.message || 'нет успешных обработок'}`,
      );
    }
    process.exit(1);
  }
  if (ok > 0) await setState('llm_fail_streak', 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('Фатальная ошибка:', e);
    process.exit(1);
  });
}
