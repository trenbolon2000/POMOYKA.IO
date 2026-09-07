// Чёрный список сатирических изданий. Проверяется в коде ДО вызова LLM —
// не полагаемся на то, что модель сама распознает сатиру (docs/tz-codex.md §6).
// Дополнять по мере обнаружения.

const SATIRE_DOMAINS = new Set([
  // EN
  'theonion.com',
  'clickhole.com',
  'babylonbee.com',
  'reductress.com',
  'thehardtimes.net',
  'hard-drive.net',
  'thebeaverton.com',
  'thedailymash.co.uk',
  'newsbiscuit.com',
  'thespoof.com',
  'dailysquib.co.uk',
  'waterfordwhispersnews.com',
  'betootaadvocate.com',
  'therochdaleherald.co.uk',
  'newsthump.com',
  'thepoke.co.uk',
  'thescoop.com',
  'worldnewsdailyreport.com',
  'empirenews.net',
  'nationalreport.net',
  // DE
  'der-postillon.com',
  'postillon.com',
  'die-tagespresse.com',
  'eine-zeitung.net',
  // FR
  'legorafi.fr',
  'nordpresse.be',
  'lecourrierdesechos.fr',
  'bilboquet-magazine.fr',
  // RU
  'panorama.pub',
  'ircity.ru',
  // ES / IT / other
  'elmundotoday.com',
  'haynoticia.es',
  'lercio.it',
  'thevalleyreport.com',
]);

// hostname совпадает с доменом из списка или является его поддоменом.
export function isSatire(rawUrl) {
  let host;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (SATIRE_DOMAINS.has(host)) return true;
  for (const d of SATIRE_DOMAINS) {
    if (host.endsWith(`.${d}`)) return true;
  }
  return false;
}
