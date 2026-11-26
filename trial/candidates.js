// Кандидаты для пробного прогона шага 2. У каждого сайта несколько вариантов
// адреса ленты: пробуем по очереди, берём первый живой. Все адреса проверяются
// с серверов GitHub — так же, как их будет читать боевой конвейер.

// 1. Замена мёртвым лентам: англоязычные weird-разделы.
export const WEIRD_EN = [
  { site: 'Sky News — Strange', urls: ['https://feeds.skynews.com/feeds/rss/strange.xml', 'https://feeds.skynews.com/feeds/rss/offbeat.xml'] },
  { site: 'HuffPost — Weird News', urls: ['https://www.huffpost.com/section/weird-news/feed', 'https://www.huffpost.com/news/weird-news/feed', 'https://www.huffingtonpost.co.uk/news/weird-news/feed/'] },
  { site: 'The Independent — Weird news', urls: ['https://www.independent.co.uk/topic/weird-news/rss', 'https://www.independent.co.uk/topic/bizarre/rss'] },
  { site: 'The Sun — Weird news', urls: ['https://www.thesun.co.uk/news/weird-news/feed/', 'https://www.thesun.co.uk/topic/weird-news/feed/'] },
  { site: 'New York Post — tag bizarre', urls: ['https://nypost.com/tag/bizarre/feed/', 'https://nypost.com/tag/weird/feed/', 'https://nypost.com/tag/strange/feed/'] },
  { site: 'Daily Record — Weird news', urls: ['https://www.dailyrecord.co.uk/news/weird-news/?service=rss', 'https://www.dailyrecord.co.uk/news/weird-news/rss.xml'] },
  { site: 'News4Jax — AP Oddities', urls: ['https://www.news4jax.com/arc/outboundfeeds/rss/tags_slug/oddities/?outputType=xml', 'https://www.news4jax.com/arc/outboundfeeds/rss/category/news/oddities/?outputType=xml', 'https://www.news4jax.com/arc/outboundfeeds/rss/topic/oddities/?outputType=xml'] },
  { site: 'news.com.au — WTF', urls: ['https://www.news.com.au/lifestyle/real-life/wtf/rss', 'https://www.news.com.au/content-feeds/latest-news-lifestyle/'] },
  { site: 'NDTV — Offbeat', urls: ['https://feeds.feedburner.com/ndtvnews-offbeat-news', 'https://feeds.feedburner.com/ndtvnews-offbeat'] },
  { site: 'ScienceDaily — Strange & Offbeat', urls: ['https://www.sciencedaily.com/rss/strange_offbeat.xml', 'https://www.sciencedaily.com/rss/strange_offbeat/weird_world.xml'] },
  { site: 'The Week — Odd news', urls: ['https://theweek.com/odd-news-0/feed', 'https://theweek.com/feeds/odd-news'] },
  { site: 'Fox News — Odd news', urls: ['https://moxie.foxnews.com/google-publisher/odd-news.xml', 'https://www.foxnews.com/category/odd-news.xml'] },
];

// 2. Светская хроника СНГ (русскоязычные сайты о шоу-бизнесе).
export const SHOWBIZ_RU = [
  { site: 'StarHit', urls: ['https://www.starhit.ru/rss/', 'https://www.starhit.ru/rss.xml', 'https://www.starhit.ru/feed/'] },
  { site: '7 Дней', urls: ['https://7days.ru/rss/', 'https://7days.ru/rss.xml', 'https://7days.ru/news/rss/'] },
  { site: 'Сплетник', urls: ['https://www.spletnik.ru/rss', 'https://www.spletnik.ru/rss.xml', 'https://www.spletnik.ru/export/rss/'] },
  { site: 'Super', urls: ['https://www.super.ru/rss', 'https://www.super.ru/rss.xml', 'https://www.super.ru/feed'] },
  { site: 'Телепрограмма', urls: ['https://teleprogramma.pro/rss/', 'https://teleprogramma.pro/feed/', 'https://teleprogramma.pro/rss.xml'] },
  { site: 'Woman.ru', urls: ['https://www.woman.ru/rss/', 'https://www.woman.ru/rss.xml', 'https://www.woman.ru/stars/rss/'] },
  { site: 'Woman’s Day (wday.ru)', urls: ['https://www.wday.ru/rss/', 'https://www.wday.ru/rss.xml'] },
  { site: 'PeopleTalk', urls: ['https://peopletalk.ru/feed/', 'https://peopletalk.ru/rss/'] },
  { site: 'Афиша Daily', urls: ['https://daily.afisha.ru/rss/'] },
  { site: 'МК — Культура', urls: ['https://www.mk.ru/rss/culture/index.xml'] },
  { site: 'Газета.Ru — Культура', urls: ['https://www.gazeta.ru/export/rss/culture.xml'] },
  { site: 'Лента.ру — Культура', urls: ['https://lenta.ru/rss/news/culture'] },
];

// 3. Рубрика «Абсурд власти» (шаг 3): только проверка лент и полного текста, без модели.
export const POWER = [
  { site: 'ProPublica', urls: ['https://www.propublica.org/feeds/propublica/main'] },
  { site: 'The Guardian — US politics', urls: ['https://www.theguardian.com/us-news/us-politics/rss'] },
  { site: 'The Guardian — Jeffrey Epstein', urls: ['https://www.theguardian.com/us-news/jeffrey-epstein/rss'] },
  { site: 'NPR — Politics', urls: ['https://feeds.npr.org/1014/rss.xml'] },
  { site: 'BBC — US & Canada', urls: ['https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'] },
  { site: 'The New York Times — Politics', urls: ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml'] },
  { site: 'The Washington Post — Politics', urls: ['https://feeds.washingtonpost.com/rss/politics'] },
  { site: 'Politico', urls: ['https://rss.politico.com/politics-news.xml'] },
  { site: 'The New Yorker — News', urls: ['https://www.newyorker.com/feed/news'] },
  { site: 'The Atlantic — Politics', urls: ['https://www.theatlantic.com/feed/channel/politics/'] },
  { site: 'Rolling Stone — Politics', urls: ['https://www.rollingstone.com/politics/feed/'] },
];

// Предлагаемое правило для живых людей (шаг 2, п. 5): в пробном прогоне его
// добавляют к промпту рерайта, чтобы сравнить «до» и «после». prompts/editor.md
// не меняется — его правит владелец.
export const PEOPLE_RULE =
  'ПРАВИЛО ДЛЯ ЖИВЫХ ЛЮДЕЙ. Матерное слово — только про ситуацию, событие или их итог ' +
  '(«вышел полный пиздец», «затея оказалась хуёвой»). Никогда — как оценка, ярлык или ' +
  'описание названного живого человека, его внешности, тела, семьи или работы; не ставь ' +
  'матерное слово в одно предложение с именем человека. Слух оставляй слухом: «по словам», ' +
  '«якобы», «как пишет …» — не превращай чужое заявление в факт.';

// Известные дубли из истории канала (сентябрь–ноябрь 2026): одна история, вышедшая
// в канал несколько раз из разных изданий. По ним проверяем сверку дублей.
export const KNOWN_DUPLICATES = [
  { key: 'Остров в Британской Колумбии', re: /island (re)?appears|appears and disappears/i },
  { key: 'Семейка Аддамс и кукла', re: /Addams Family/i },
  { key: 'Лох-несские чудовища из космоса', re: /Loch Ness Monsters'? (spotted|witnessed) from space/i },
  { key: 'Имплант звезды WWE', re: /WWE legend.*implant/i },
  { key: 'Boeing 737 в саду', re: /737.*garden|garden.*737/i },
  { key: 'НЛО в трансляции SpaceX', re: /SpaceX.*mothership/i },
  { key: 'Hyrox', re: /Hyrox/i },
  { key: 'Ноев ковчег', re: /Noah'?s Ark/i },
];
