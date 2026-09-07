// Тонкая обёртка над OpenAI-совместимым chat/completions эндпоинтом.
// Провайдер задаётся в .env (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL) —
// код не зависит от конкретного (OpenAI, DeepSeek, Claude-совместимый шлюз).

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
const REQUEST_TIMEOUT_MS = 60_000;

// Ошибка оплаты/ключа: пайплайн НЕ должен помечать записи обработанными,
// после серии таких — алерт владельцу (§8).
export class LlmAuthError extends Error {}
// Прочие ошибки LLM (таймаут, 5xx, кривой JSON): запись остаётся необработанной,
// подхватится следующим запуском, но это не повод слать алерт.
export class LlmError extends Error {}

if (!LLM_BASE_URL || !LLM_API_KEY || !LLM_MODEL) {
  throw new Error('Нет LLM_BASE_URL / LLM_API_KEY / LLM_MODEL в окружении');
}

async function rawCall(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    throw new LlmError(`сеть/таймаут: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 402 || res.status === 403) {
    throw new LlmAuthError(`HTTP ${res.status} (оплата/ключ)`);
  }
  if (!res.ok) {
    throw new LlmError(`HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new LlmError('пустой ответ модели');
  return content;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
    return null;
  }
}

// Возвращает распарсенный JSON-объект. Одна повторная попытка при кривом JSON.
// Слово "json" в промпте обязательно для response_format некоторых провайдеров.
export async function chatJson({ system, user }) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let content = await rawCall(messages);
  let parsed = parseJson(content);
  if (parsed) return parsed;

  messages.push({ role: 'assistant', content });
  messages.push({ role: 'user', content: 'Верни ТОЛЬКО валидный JSON-объект, без пояснений и markdown.' });
  content = await rawCall(messages);
  parsed = parseJson(content);
  if (parsed) return parsed;

  throw new LlmError('модель не вернула валидный JSON после повтора');
}
