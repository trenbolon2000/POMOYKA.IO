// Telegram Bot API. Токен и id — только из окружения.

const { TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID } = process.env;

const api = (method) => `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
export const CAPTION_LIMIT = 1024;

export async function sendMessage(chatId, text) {
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage: ${data.description}`);
  return data.result;
}

// Пост с карточкой. caption — уже готовый текст (заголовок, выжимка, источник,
// ссылка), <= CAPTION_LIMIT. Возвращает result с message_id.
export async function sendPhoto(chatId, pngBuffer, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption.slice(0, CAPTION_LIMIT));
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'card.png');

  const res = await fetch(api('sendPhoto'), { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendPhoto: ${data.description}`);
  return data.result;
}

// Личное сообщение владельцу. Молча ничего не делает, если алерт не настроен —
// отсутствие OWNER_CHAT_ID не должно ронять пайплайн.
export async function notifyOwner(text) {
  if (!TELEGRAM_BOT_TOKEN || !OWNER_CHAT_ID) {
    console.warn('notifyOwner: нет TELEGRAM_BOT_TOKEN / OWNER_CHAT_ID — алерт пропущен');
    return;
  }
  try {
    await sendMessage(OWNER_CHAT_ID, text);
  } catch (e) {
    console.error('notifyOwner: не удалось отправить —', e.message);
  }
}
