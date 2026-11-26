// Защита от дублей: одна и та же история из разных изданий выходит один раз.
//
// parse.js ловит только одинаковые ссылки и одинаковые заголовки, а одна история
// в двух изданиях выходит под разными заголовками («Hyrox winner soils herself…»
// в Daily Star и «Hyrox athlete competes despite diarrhea…» в New York Post).
// Такое ловит только смысл, поэтому перед рерайтом (этап 2 в scripts/filter.js)
// спрашиваем модель: не та же ли это история, что уже опубликована или стоит в
// очереди за последние DEDUP_DAYS дней.
//
// Цена: один короткий вызов модели на каждую запись, прошедшую порог (единицы
// за прогон); в списке — заголовки и начало текста за неделю.
//
// Чем конкретнее текст, тем меньше ложных тревог: у новой записи сравниваем
// начало полного текста статьи (там имена, ники, места), у опубликованных —
// наш рерайт (в нём те же подробности). Без этого два разных «путешественника
// во времени» с похожими заголовками выглядели одной историей.

import { chatJson } from './llm.js';

export const DEDUP_DAYS = 7;
const LIST_SNIPPET = 320; // символов начала текста на элемент списка
const CANDIDATE_SNIPPET = 800;

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

// Запись из news -> элемент списка для сравнения. Текст — наш рерайт, если он
// есть (в нём имена и подробности), иначе выжимка из RSS.
export const toStory = (r) => ({
  id: r.id,
  title: r.title_original || r.title_rewritten || '',
  text: r.content_summary || r.content_original || '',
});

// Опубликованное за DEDUP_DAYS дней + очередь (переписано, но ещё не опубликовано).
export async function loadRecentStories(db, now = Date.now()) {
  const since = new Date(now - DEDUP_DAYS * 24 * 3600 * 1000).toISOString();
  const cols = 'id, title_original, content_original, title_rewritten, content_summary';
  const [published, queued] = await Promise.all([
    db.from('news').select(cols).eq('posted_to_telegram', true).gte('posted_at', since),
    db
      .from('news')
      .select(cols)
      .eq('posted_to_telegram', false)
      .eq('safety_flag', false)
      .not('title_rewritten', 'is', null)
      .gte('fetched_at', since),
  ]);
  if (published.error) throw published.error;
  if (queued.error) throw queued.error;
  return [...published.data, ...queued.data].map(toStory);
}

export function dedupMessages(candidate, list) {
  const lines = list.map(
    (s, i) => `${i + 1}. ${clip(s.title, 200)}${s.text ? ` — ${clip(s.text, LIST_SNIPPET)}` : ''}`,
  );
  return {
    system:
      'Ты — выпускающий редактор новостного канала. Задача — не опубликовать одну и ту же ' +
      'историю дважды. Дано: НОВАЯ новость и СПИСОК уже опубликованных или стоящих в очереди.\n' +
      'Одна и та же история — тот же конкретный случай: те же люди (или то же животное, ' +
      'тот же предмет, то же место) и то же событие. Это та же история, даже если её ' +
      'пересказало другое издание — другими словами, на другом языке, с другими деталями, ' +
      'под другим углом — или если это продолжение того же случая (реакция, извинения, ' +
      'новые подробности).\n' +
      'НЕ та же история — другой случай на похожую тему: другой «путешественник во ' +
      'времени», другой человек с похожим опытом, другое нападение акулы, другое НЛО.\n' +
      'Если сомневаешься — это разные истории.\n' +
      'Верни строгий JSON: {"same_as": номер из списка или null, "reason": "коротко, почему"}',
    user:
      `НОВАЯ НОВОСТЬ:\n${clip(candidate.title, 300)}\n${clip(candidate.text, CANDIDATE_SNIPPET)}` +
      `\n\nСПИСОК:\n${lines.join('\n')}`,
  };
}

// null — новая история; иначе { story, reason } — с чем совпала.
// Ошибку модели пробрасываем: запись останется необработанной и подхватится
// следующим запуском (как и остальные ошибки LLM в filter.js).
export async function findSameStory(candidate, list) {
  if (!list.length) return null;
  const r = await chatJson(dedupMessages(candidate, list));
  const n = Number(r?.same_as);
  if (!Number.isInteger(n) || n < 1 || n > list.length) return null;
  return { story: list[n - 1], reason: String(r?.reason || '').trim() };
}
