-- Помойка — стартовый список источников.
-- Каждый RSS-адрес проверен curl'ом (HTTP 200 + валидный <rss> + свежие items).
-- Идемпотентно: on conflict do nothing.
--
-- Итог калибровки Шага 3: рабочий жанр дают только выделенные weird/odd-разделы
-- англоязычных таблоидов. Общие полит/крим-ленты (Bild, El Mundo, La Dépêche,
-- 20 Minutes, ToI) и «человеческие» разделы африканской сети Legit
-- (People/gist/buzz) на тесте дали ~0 попаданий в порог и жгли батч LLM
-- впустую — отключены.

insert into sources (name, rss_url, region, active) values

  -- === Ядро: дают большинство публикаций ===
  ('New York Post — Weird But True', 'https://nypost.com/weird-but-true/feed/',              'US', true),
  ('Metro UK — Weird',               'https://metro.co.uk/news/weird/feed/',                 'UK', true),
  ('Daily Star — Weird News',        'https://www.dailystar.co.uk/news/weird-news/rss.xml',  'UK', true),

  -- === Чистый филлер: мало попаданий, но почти без safety_flag ===
  ('UPI — Odd News',                 'https://rss.upi.com/news/odd_news.rss',                'US', true),
  ('Express — Weird',                'https://www.express.co.uk/posts/rss/80/weird',         'UK', true),
  ('Mirror — Weird News',            'https://www.mirror.co.uk/news/weird-news/rss.xml',     'UK', true),  -- слабее прочих, под наблюдением

  -- === Отключено: общие ленты, 57-90% safety_flag на тесте Шага 3 ===
  ('The Sun — News',                 'https://www.thesun.co.uk/news/feed/',                  'UK', false),  -- + невалидный XML
  ('Bild — News',                    'https://www.bild.de/feed/news.xml',                   'DE', false),
  ('20 Minutes — Faits divers',      'https://www.20minutes.fr/feeds/rss-faits-divers.xml', 'FR', false),  -- «faits divers» = реальный криминал
  ('Ouest-France — Une',             'https://www.ouest-france.fr/rss/une',                  'FR', false),
  ('La Dépêche du Midi',             'https://www.ladepeche.fr/rss.xml',                    'FR', false),
  ('El Mundo — España',              'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml', 'ES', false),
  ('Times of India — World',         'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'IN', false),

  -- === Отключено: африканская сеть Legit (экс-GMEM). People/gist/buzz —
  --     тёплый human-interest и селебрити-сплетня, 0 попаданий на 173 записи.
  --     Выделенной рубрики «жареное» в RSS у сети нет. ===
  ('Legit.ng — People',              'https://www.legit.ng/rss/people.rss',                  'NG', false),
  ('Tuko — People',                  'https://www.tuko.co.ke/rss/people.rss',                'KE', false),
  ('Yen — People',                   'https://yen.com.gh/rss/people.rss',                    'GH', false),
  ('Briefly News — People',          'https://briefly.co.za/rss/people.rss',                 'ZA', false),

  -- === Отключено: мёртвые / недоступные фиды ===
  ('Nice-Matin',                     'https://www.nicematin.com/rss/derniere-minute.xml',   'FR', false),  -- 403/404/406 скриптам
  ('SoraNews24',                     'https://soranews24.com/feed/',                        'JP', false),  -- живой, но потребительские курьёзы, 0 попаданий на 40
  ('Coconuts',                       'https://coconuts.co/feed/',                           'SEA', false),  -- издание закрылось ~2023, фид отдаёт архив
  ('Vice — Weird',                   'https://www.vice.com/en/topic/weird/feed/',           'US', false),  -- раздел не обновляется с дек. 2025
  ('Reuters — Oddly Enough',         'https://www.reuters.com/lifestyle/oddly-enough/',     'WORLD', false),  -- публичный RSS закрыт
  ('Associated Press',               'https://apnews.com/',                                 'WORLD', false),  -- публичного RSS нет
  ('Agence France-Presse',           'https://www.afp.com/en/news-hub',                     'WORLD', false)   -- публичного RSS нет

on conflict (rss_url) do nothing;
