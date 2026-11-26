// Второй прогон шага 2: новые кандидаты взамен мёртвых лент и предложения для
// хроники СНГ. Якоря и строка про политику добавляются к промпту ТОЛЬКО в памяти
// пробного прогона — prompts/editor.md не меняется, его правит владелец.

// 1. Англоязычные ленты взамен мёртвых. Адреса — из списков лент самих изданий
// и каталогов; проверяются с серверов GitHub.
export const WEIRD_EN_2 = [
  { site: 'NDTV — Offbeat', urls: ['https://feeds.feedburner.com/ndtvnews-offbeat-news'] },
  { site: 'Hindustan Times — Trending', urls: ['https://www.hindustantimes.com/feeds/rss/trending/rssfeed.xml'] },
  { site: 'News18 — Buzz', urls: ['https://www.news18.com/rss/buzz.xml', 'https://www.news18.com/commonfeeds/v1/eng/rss/buzz.xml'] },
  { site: 'South China Morning Post — People & Culture', urls: ['https://www.scmp.com/rss/318202/feed'] },
  {
    site: 'AP — Weird news (местные ТВ-станции)',
    urls: [
      'https://www.ksat.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
      'https://www.click2houston.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
      'https://www.clickondetroit.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
      'https://www.news4jax.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
      'https://www.clickorlando.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
      'https://www.wsls.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml',
    ],
  },
  { site: 'The Jerusalem Post — OMG', urls: ['https://www.jpost.com/Rss/RssFeedsOMG'] },
  { site: 'Mirror — Weird News (лента раздела)', urls: ['https://www.mirror.co.uk/news/weird-news/?service=rss'] },
  { site: 'Daily Star — Weird News (лента раздела)', urls: ['https://www.dailystar.co.uk/news/weird-news/?service=rss'] },
  { site: 'Global News — Odd news', urls: ['https://globalnews.ca/tag/odd-news/feed/', 'https://globalnews.ca/tag/weird-news/feed/', 'https://globalnews.ca/tag/offbeat/feed/'] },
  { site: 'SoraNews24', urls: ['https://soranews24.com/feed/'] },
  { site: 'The US Sun — Weird news', urls: ['https://www.the-sun.com/news/weird-news/feed/', 'https://www.the-sun.com/topic/weird-news/feed/'] },
  { site: 'The Mirror US — Weird news', urls: ['https://www.themirror.com/news/weird-news/?service=rss', 'https://www.themirror.com/news/weird-news?service=rss'] },
  { site: 'Mothership (Сингапур)', urls: ['https://mothership.sg/feed/'] },
  { site: 'Sky News — Offbeat', urls: ['https://feeds.skynews.com/feeds/rss/offbeat.xml'] },
  { site: 'Time — Weird news', urls: ['https://time.com/tag/weird-news/feed/'] },
];

// Текущие ленты Mirror и Daily Star — для сравнения разделов с лентами раздела.
export const CURRENT_REACH = [
  { site: 'Mirror — Weird News (текущая лента)', urls: ['https://www.mirror.co.uk/news/weird-news/rss.xml'] },
  { site: 'Daily Star — Weird News (текущая лента)', urls: ['https://www.dailystar.co.uk/news/weird-news/rss.xml'] },
];

// 2. Светская хроника СНГ: ленты, живые в первом прогоне (+ «Газета.Ru» —
// проверить починку кодировки).
export const SHOWBIZ_RU_2 = [
  { site: 'StarHit', urls: ['https://www.starhit.ru/rss/'] },
  { site: '7 Дней', urls: ['https://7days.ru/rss/'] },
  { site: 'Сплетник', urls: ['https://www.spletnik.ru/rss'] },
  { site: 'Woman.ru', urls: ['https://www.woman.ru/rss/'] },
  { site: 'PeopleTalk', urls: ['https://peopletalk.ru/feed/'] },
  { site: 'Афиша Daily', urls: ['https://daily.afisha.ru/rss/'] },
  { site: 'МК — Культура', urls: ['https://www.mk.ru/rss/culture/index.xml'] },
  { site: 'Газета.Ru — Культура', urls: ['https://www.gazeta.ru/export/rss/culture.xml'] },
  { site: 'Лента.ру — Культура', urls: ['https://lenta.ru/rss/news/culture'] },
];

// Предлагаемые якоря для звёздного кринжа — в формате блока 1 editor.md.
// Владелец решает сам, вставлять ли их и в каком виде.
export const CELEB_ANCHORS = `### Светская хроника и звёзды (предложение)

17. Звезда на полном серьёзе рассказывает о мистическом или странном опыте —
    например, лечит голос разговором с холодильником или ставит на сцене
    «защиту от сглаза» — **9** (тот же личный кринж, что у художника с
    инопланетянами: смешна искренность самой звезды; только то, что она сама
    сказала или сделала публично)
18. Звезда делает нелепую вещь, и это подтверждено документом или её
    собственными словами — застраховала голос на миллион, судится с соседом
    из-за петуха, требует в райдер живого лебедя — **7**
19. Обычная светская хроника — свадьба, развод, роман, беременность, новый
    клип, похудение, пластика, наряд на премии, юбилей, гороскоп, тест,
    подборка — **1, is_absurd = false**
20. Слух без подтверждения — «по словам инсайдеров», «пишут в соцсетях»,
    пересказ чужих постов без реакции самой звезды — **не выше 3**
21. Болезнь, реанимация или смерть звезды; война, армия, мобилизация,
    эмиграция, иноагенты, отмены концертов и запреты по политическим
    причинам, высказывания звезды о власти — **safety_flag = true**, сколько бы
    абсурда в этом ни было`;

// Строка про политику для этапа 1 (это код filter.js, не editor.md).
export const POLITICS_LINE =
  '  Политика — это в том числе война России с Украиной и армия, мобилизация, санкции, ' +
  'эмиграция и «уехавшие», иноагенты и «нежелательные», отмены концертов, запреты и суды ' +
  'по политическим причинам, высказывания о власти — даже в светской хронике.';

const SAFETY_MARK = 'насилие — даже если звучит дико.\n';
const ASK_MARK = '\n\nОцени новость по ЗАГОЛОВКУ';

// Системный промпт этапа 1 «с предложением»: якоря — в конец материалов
// редактора (как если бы их вписали в блок 1), строка про политику — к safety_flag.
export function withProposal(system) {
  if (!system.includes(SAFETY_MARK) || !system.includes(ASK_MARK)) {
    throw new Error('Промпт этапа 1 изменился — не нашёл, куда вставить предложение');
  }
  return system
    .replace(ASK_MARK, `\n\n${CELEB_ANCHORS}${ASK_MARK}`)
    .replace(SAFETY_MARK, `${SAFETY_MARK}${POLITICS_LINE}\n`);
}
