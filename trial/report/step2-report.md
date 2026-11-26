# Пробный прогон шага 2

Запуск: 2026-11-26T03:22:44.135Z (сервер GitHub Actions). В базу ничего не записано, в канал ничего не отправлено.

## 1. Текущие источники

База: записи за 30 дней (392 шт.) и с перезапуска 22.11 — «прошли» = оценка ≥ 5 без safety_flag.

| Источник | Лента сейчас | в день | старше 10 дн. | 30 дн.: записей / прошли / опубл. | с 22.11: записей / прошли / опубл. | ср. оценка |
|---|---|---|---|---|---|---|
| New York Post — Weird But True | жива, свежая 318 ч назад | 0.0 | 100% | 7 / 4 / 3 | 0 / 0 / 0 | 4.6 |
| UPI — Odd News | жива, свежая 9 ч назад | 3.7 | 0% | 92 / 14 / 11 | 41 / 3 / 1 | 3.0 |
| Metro UK — Weird | жива, свежая 15 ч назад | 0.9 | 53% | 25 / 9 / 9 | 12 / 5 / 5 | 4.2 |
| Daily Star — Weird News | жива, свежая 10 ч назад | 6.6 | 0% | 93 / 12 / 7 | 49 / 6 / 2 | 2.3 |
| Mirror — Weird News | жива, свежая 12 ч назад | 9.6 | 0% | 166 / 6 / 6 | 51 / 1 / 1 | 1.5 |
| Express — Weird | ошибка: HTTP 403 | — | — | 9 / 1 / 0 | 6 / 1 / 0 | 1.8 |
| Oddity Central | жива, свежая 1640 ч назад | 0.0 | 100% | 0 / 0 / 0 | 0 / 0 / 0 | — |

**Daily Star — Weird News: разделы сайта за 30 дней** (раздел — записей, ср. оценка, прошли)

- `/news/latest-news` — 48, 2.5, 9
- `/news/weird-news` — 16, 2.9, 2
- `/real-life` — 6, 2.0, 0
- `/news/uk-news` — 5, 2.2, 1
- `/travel` — 3, 1.0, 0
- `/news/world-news` — 3, 2.0, 0
- `/travel/gallery` — 2, 1.5, 0
- `/showbiz` — 2, 1.0, 0

**Mirror — Weird News: разделы сайта за 30 дней** (раздел — записей, ср. оценка, прошли)

- `/news/uk-news` — 41, 1.6, 2
- `/lifestyle` — 19, 1.5, 0
- `/money/shopping-deals` — 17, 1.1, 0
- `/news/health` — 14, 1.2, 0
- `/lifestyle/food-drink` — 12, 1.1, 0
- `/news/weird-news` — 10, 4.2, 3
- `/travel` — 7, 1.3, 0
- `/news/real-life-stories` — 6, 1.2, 0

## 2. Ленты-кандидаты (проверено с серверов GitHub)


**Англоязычные weird-разделы**

| Сайт | Статус | Адрес ленты | в ленте | в день | свежая | старше 10 дн. | язык |
|---|---|---|---|---|---|---|---|
| Sky News — Strange | ✅ | https://feeds.skynews.com/feeds/rss/strange.xml | 3 | 0.0 | 637 ч | 100% | en |
| HuffPost — Weird News | ✅ | https://www.huffpost.com/section/weird-news/feed | 1 | 0.8 | 30 ч | 0% | en |
| The Independent — Weird news | ❌ | https://www.independent.co.uk/topic/weird-news/rss → лента пустая или без ссылок; https://www.independent.co.uk/topic/bizarre/rss → лента пустая или без ссылок | | | | | |
| The Sun — Weird news | ❌ | https://www.thesun.co.uk/news/weird-news/feed/ → Unexpected close tag Line: 0 Column: 431 Char: >; https://www.thesun.co.uk/topic/weird-news/feed/ → Feed not recognized as RSS 1 or 2. | | | | | |
| New York Post — tag bizarre | ❌ | https://nypost.com/tag/bizarre/feed/ → лента пустая или без ссылок; https://nypost.com/tag/weird/feed/ → лента пустая или без ссылок; https://nypost.com/tag/strange/feed/ → лента пустая или без ссылок | | | | | |
| Daily Record — Weird news | ✅ | https://www.dailyrecord.co.uk/news/weird-news/?service=rss | 1 | 0.1 | 164 ч | 0% | en |
| News4Jax — AP Oddities | ❌ | https://www.news4jax.com/arc/outboundfeeds/rss/tags_slug/oddities/?outputType=xml → лента пустая или без ссылок; https://www.news4jax.com/arc/outboundfeeds/rss/category/news/oddities/?outputType=xml → лента пустая или без ссылок; https://www.news4jax.com/arc/outboundfeeds/rss/topic/oddities/?outputType=xml → HTTP 404 | | | | | |
| news.com.au — WTF | ❌ | https://www.news.com.au/lifestyle/real-life/wtf/rss → Unable to parse XML.; https://www.news.com.au/content-feeds/latest-news-lifestyle/ → Feed not recognized as RSS 1 or 2. | | | | | |
| NDTV — Offbeat | ✅ | https://feeds.feedburner.com/ndtvnews-offbeat-news | 20 | 8.3 | 1 ч | 0% | en |
| ScienceDaily — Strange & Offbeat | ✅ | https://www.sciencedaily.com/rss/strange_offbeat.xml | 60 | 2.1 | 1 ч | 68% | en |
| The Week — Odd news | ❌ | https://theweek.com/odd-news-0/feed → Invalid character in entity name Line: 113 Column: 60571 Char:; https://theweek.com/feeds/odd-news → HTTP 404 | | | | | |
| Fox News — Odd news | ❌ | https://moxie.foxnews.com/google-publisher/odd-news.xml → HTTP 400; https://www.foxnews.com/category/odd-news.xml → HTTP 404 | | | | | |

**Светская хроника СНГ**

| Сайт | Статус | Адрес ленты | в ленте | в день | свежая | старше 10 дн. | язык |
|---|---|---|---|---|---|---|---|
| StarHit | ✅ | https://www.starhit.ru/rss/ | 100 | 31.0 | 0 ч | 0% | ru |
| 7 Дней | ✅ | https://7days.ru/rss/ | 50 | 19.3 | 1 ч | 0% | ru |
| Сплетник | ✅ | https://www.spletnik.ru/rss | 40 | 27.3 | 4 ч | 0% | ru |
| Super | ❌ | https://www.super.ru/rss → HTTP 404; https://www.super.ru/rss.xml → HTTP 404; https://www.super.ru/feed → HTTP 404 | | | | | |
| Телепрограмма | ❌ | https://teleprogramma.pro/rss/ → HTTP 404; https://teleprogramma.pro/feed/ → HTTP 404; https://teleprogramma.pro/rss.xml → HTTP 404 | | | | | |
| Woman.ru | ✅ | https://www.woman.ru/rss/ | 99 | 22.3 | 4 ч | 0% | ru |
| Woman’s Day (wday.ru) | ❌ | https://www.wday.ru/rss/ → HTTP 404; https://www.wday.ru/rss.xml → HTTP 404 | | | | | |
| PeopleTalk | ✅ | https://peopletalk.ru/feed/ | 50 | 18.0 | 7 ч | 0% | ru |
| Афиша Daily | ✅ | https://daily.afisha.ru/rss/ | 5 | 3.3 | 13 ч | 0% | ru |
| МК — Культура | ✅ | https://www.mk.ru/rss/culture/index.xml | 50 | 7.8 | 1 ч | 0% | ru |
| Газета.Ru — Культура | ✅ | https://www.gazeta.ru/export/rss/culture.xml | 15 | 1.3 | 8 ч | 7% | en |
| Лента.ру — Культура | ✅ | https://lenta.ru/rss/news/culture | 196 | 16.4 | 4 ч | 20% | ru |

## 3. Этап 1: 87 свежих записей кандидатов (как в scripts/filter.js)

По 8 самых свежих записей с каждого живого сайта. Ошибок модели: 0.

- прошли порог 5 (условие рерайта: не safety_flag, is_absurd, оценка ≥ 5): **2** из 87
- safety_flag: **18**
- оценки без safety_flag: 1: 48, 2: 18, 4: 1, 5: 2

**По сайтам**

| Сайт | записей | прошли | safety_flag | ср. оценка |
|---|---|---|---|---|
| HuffPost — Weird News | 1 | 0 | 0 | 2.0 |
| Daily Record — Weird news | 1 | 0 | 1 | 1.0 |
| NDTV — Offbeat | 8 | 1 | 0 | 2.3 |
| ScienceDaily — Strange & Offbeat | 8 | 0 | 0 | 2.0 |
| StarHit | 8 | 0 | 2 | 1.1 |
| 7 Дней | 8 | 0 | 1 | 1.1 |
| Сплетник | 8 | 0 | 4 | 1.0 |
| Woman.ru | 8 | 0 | 1 | 1.0 |
| PeopleTalk | 8 | 0 | 1 | 1.0 |
| Афиша Daily | 5 | 0 | 0 | 1.2 |
| МК — Культура | 8 | 0 | 4 | 1.3 |
| Газета.Ru — Культура | 8 | 1 | 2 | 2.0 |
| Лента.ру — Культура | 8 | 0 | 2 | 1.0 |

**10 лучших (без safety_flag)**

| Оценка | Прошла | Сайт | Заголовок |
|---|---|---|---|
| 5 | да | NDTV — Offbeat | Just 2 Feet Tall, Worth Rs 1 Crore: Meet Pinky, The Tiny Buffalo Turning Heads At Pushkar Fair |
| 5 | да | Газета.Ru — Культура | "� ������������ � ������, ��� �������� � ����� �����": �������� � ������� ������� �������� |
| 4 | нет | NDTV — Offbeat | "Did You Check In The Toilet?" Man Gets Seat No. 54 Ticket, Finds Coach Has Only 52 Berths |
| 2 | нет | HuffPost — Weird News | What Is The ‘Cousin Walk’? The Blunt Truth About This Thanksgiving Trend. |
| 2 | нет | NDTV — Offbeat | Ex-Wall Street Trader Reveals How She Earns Rs 4.6 Lakh Monthly Renting Clothes Online |
| 2 | нет | NDTV — Offbeat | Did Jensen Huang Send Inappropriate Text To Colette Kress? Viral Screenshots Debunked |
| 2 | нет | NDTV — Offbeat | Japanese Woman's First Overnight Train Journey In India Goes Viral, Internet Reacts |
| 2 | нет | ScienceDaily — Strange & Offbeat | Scientists discover mysterious lakes more than a mile beneath the Red Sea |
| 2 | нет | ScienceDaily — Strange & Offbeat | Physicists just sent an unblockable message through a brick wall using gravity |
| 2 | нет | ScienceDaily — Strange & Offbeat | A black hole the size of an atom could destroy an entire star |

**Высокие оценки, но safety_flag (в канал бы не пошли)**

- 2 · 7 Дней · Суд, завещание и спорная подпись — сын Кашпировского пытается вернуть имущество отца
- 2 · МК — Культура · Изымают на границе, выбрасывают в помойку: незавидная судьба книг на Украине
- 2 · Газета.Ru — Культура · �� "������" �� ������� � ��������� — ��������� Shaman
- 1 · Daily Record — Weird news · 'I'm a forensic pathologist and there's one way to die worse than any other'
- 1 · StarHit · Врачи опасаются за жизнь перенесшего инфаркт Джигурды: «Может случиться повторный инфаркт или оторваться тром…

## Этап 2: рерайт 2 лучших


**1. NDTV — Offbeat · оценка 5** — https://www.ndtv.com/offbeat/just-2-feet-tall-worth-rs-1-crore-meet-pinky-the-tiny-buffalo-turning-heads-at-pushkar-fair-12374228#publisher=newsstand
> Just 2 Feet Tall, Worth Rs 1 Crore: Meet Pinky, The Tiny Buffalo Turning Heads At Pushkar Fair

**Двухфутовая буйволица Пинки оценена в 1 крор рупий и собирает толпы на ярмарке в Пушкаре**

В Раджастане на ярмарке в Пушкаре буйволица Пинки ростом всего два фута стала неожиданной звездой. Владелец просит за неё 1 крор рупий, и любопытные посетители, блядь, собираются вокруг большими толпами.

_полный текст статьи: нет, по RSS; переписано повторно: нет_

**2. Газета.Ru — Культура · оценка 5** — https://www.gazeta.ru/culture/2026/11/25/long-23917387.shtml
> "� ������������ � ������, ��� �������� � ����� �����": �������� � ������� ������� ��������

**«Газета.Ru» прислала новость сплошными кракозябрами — и это лучшее, что случилось за день**

В редакцию пришёл материал из «Газеты.Ru» целиком из кракозябр: читаются только цифра три и название источника. Ни города, ни героев, ни сути в нём не разобрать. Остаётся публиковать как есть — хуй с ним, зато без вранья.

_полный текст статьи: нет, по RSS; переписано повторно: нет_

## 4. Светская хроника СНГ: политика и мат рядом с именами

| Сайт | свежих записей | из них политика | темы |
|---|---|---|---|
| StarHit | 30 | 1 (3%) | cancellation |
| 7 Дней | 30 | 0 (0%) |  |
| Сплетник | 30 | 2 (7%) | other |
| Woman.ru | 30 | 0 (0%) |  |
| PeopleTalk | 30 | 0 (0%) |  |
| Афиша Daily | 5 | 0 (0%) |  |
| МК — Культура | 30 | 1 (3%) | war |
| Газета.Ru — Культура | 14 | 4 (29%) | foreign_agent, other, war |
| Лента.ру — Культура | 30 | 5 (17%) | emigration, foreign_agent, war |

Политических записей всего: **13**. Из них safety_flag поймал: **8**, проскочили: **5**, а порог 5 прошли бы (= ушли бы в канал): **1**.

**Проскочившая политика** (оценка · тема · заголовок)

- 2 · foreign_agent · Газета.Ru — Культура: "��������, �� ��� ������": ������ ������� �������� � ������� � �����������-����������� ��-�� ���
- 2 · other · Газета.Ru — Культура: ������ "������������� ����" ��������� �� ���� � ���������� � �����������. ��� ��������?
- 6 ⚠️ прошла · war · Газета.Ru — Культура: "���������� ���������"? � "�������" ������ ������ �� ���� ������ ���������
- 1 · emigration · Лента.ру — Культура: Эмигрировавший в США Бурковский закрыл бизнес в России
- 1 · foreign_agent · Лента.ру — Культура: Моргенштерн анонсировал свой последний концерт

**Мат рядом с именем: рерайт без правила и с правилом**

Правило: ПРАВИЛО ДЛЯ ЖИВЫХ ЛЮДЕЙ. Матерное слово — только про ситуацию, событие или их итог («вышел полный пиздец», «затея оказалась хуёвой»). Никогда — как оценка, ярлык или описание названного живого человека, его внешности, тела, семьи или работы; не ставь матерное слово в одно предложение с именем человека. Слух оставляй слухом: «по словам», «якобы», «как пишет …» — не превращай чужое заявление в факт.


1. Газета.Ru — Культура · оценка 5 — "� ������������ � ������, ��� �������� � ����� �����": �������� � ������� ������� ��������
   - **Без правила:** В театре устроили спектакль, которого не было в программке: зрители требуют объяснений — В театре во время представления зрители получили не то, что было обещано программкой. Организаторы уверяют, что всё шло по плану, и подробностей пока немного. Публика, сука, требует объяснений, а руководство обещает разобраться. По описанию «Газеты.Ru», обсуждают случившееся громче самой постановки.
   - **С правилом:** В российском городе открыли памятник тому, чего не существует — В одном из российских городов торжественно открыли объект современного искусства — скульптуру, изображающую, по задумке авторов, то, чего в природе нет. Прохожие долго гадали, что это вообще такое, и часть публики сочла объект насмешкой. В итоге вокруг безобидной железяки развернулся настоящий пиздец, и объясняться пришлось создателям. Те настаивают, что всё задумано именно так.

2. StarHit · оценка 2 (порог не прошла, рерайт — только для примера) — Анна Седокова натянула кружевные чулки и пошла смущать десятки мужчин: «Мне нечего терять»
   - **Без правила:** Анна Седокова вышла к десяткам мужчин в кружевных чулках и прозрачном корсете: терять ей больше нечего — 42-летняя Анна Седокова явилась на премию Voice Man Awards в чёрном прозрачном корсете, кружевных чулках и юбке с разрезом почти до бедра — перед десятками мужчин, и ни хуя не смутилась. Снимки выложила в личный блог с пояснением: женщина, способная выйти в чулках и прозрачном корсете перед десятками журналистов, способна на всё, а терять ей больше нечего. Там же предупредила, что никого не сделает известным, пока сама этого не захочет. На критику по поводу чулок певица ранее отвечала, что её фото в чулках — подушка безопасности.
   - **С правилом:** Седокова натянула чулки и вышла к десяткам мужчин: «Мне нечего терять» — На премии Voice Man Awards 42-летняя певица появилась перед десятками мужчин в прозрачном корсете, кружевных чулках и юбке с разрезом до бедра. Снимки она выложила в личный блог с заявлением, что женщина в чулках способна на всё и ей нечего терять. Последние месяцы вокруг её имени идёт судебный пиздец: семья бывшего супруга оспаривает брачный договор. Певицу мало волнует, какое впечатление она производит на окружающих.

3. Афиша Daily · оценка 2 (порог не прошла, рерайт — только для примера) — Банан на стене — это искусство: все, что нужно знать про главный арт-объект XXI века
   - **Без правила:** В «ГЭС-2» повесят банан за 6,2 миллиона и закупят десять килограммов запасных — В московском «ГЭС-2» с 4 декабря по 4 апреля покажут «Комедианта» Маурицио Каттелана — банан, приклеенный серым скотчем к стене, который в 2024 году ушёл за 6,2 миллиона долларов. Для экспозиции закупят десять килограммов бананов: фрукт чернеет за несколько дней, и его меняют на свежий. Покупатель оплачивает не банан, а сертификат подлинности и конфиденциальную инструкцию, как эту хуйню правильно приклеить. Вход бесплатный.
   - **С правилом:** В Москве покажут банан, приклеенный скотчем к стене. За такой когда-то отдали 6,2 миллиона долларов — В «ГЭС-2» привезут «Комедианта» Маурицио Каттелана — банан, приклеенный серой лентой к стене, который в 2024 году продали за 6,2 миллиона долларов. Для показа закупят 10 килограммов бананов: фрукт чернеет за несколько дней, и его меняют на свежий. Покупатель платит не за банан, а за сертификат подлинности и инструкцию, как приклеить его к стене, — весь этот пиздец держится на праве называть банан искусством. Вход на выставку бесплатный.

## 5. Сверка дублей на истории канала

Каждую переписанную запись сверили с тем, что было опубликовано или стояло в очереди за 7 дней до неё (как будет в конвейере). Проверок: 168, ошибок модели: 0.

**Известные дубли: поймано 10, пропущено 0**

- ✅ Hyrox: «Hyrox issues apology for allowing race to continue after athlete soils herself» ≈ «Hyrox winner soils herself at event but carries on anyway before issuing defiant response»
- ✅ Hyrox: «Diarrhea-soaked Hyrox athlete divides internet over whether she should have quit» ≈ «Hyrox winner soils herself at event but carries on anyway before issuing defiant response»
- ✅ Hyrox: «Hyrox athlete competes despite diarrhea — using shared equipment and horrifying onlookers» ≈ «Hyrox winner soils herself at event but carries on anyway before issuing defiant response»
- ✅ Имплант звезды WWE: «WWE legend known as 'First Lady of Wrestling' flogs boob implant after bidding frenzy» ≈ «WWE legend, 62, giving fans the chance to 'hold' her by flogging her breast implant»
- ✅ Лох-несские чудовища из космоса: «'Family of Loch Ness Monsters' witnessed from space in baffling Google Earth images» ≈ «'Family of Loch Ness Monsters' spotted from space in bizarre Google Earth images»
- ✅ Семейка Аддамс и кукла: «Real-life Addams Family let children play with haunted 'Annie' doll that 'weeps acid tear…» ≈ «Real-life Addams Family let children play with haunted doll that 'wept tears of acid'»
- ✅ Ноев ковчег: «Scale of 'Noah's Ark' 515ft resting place explained in new site update» ≈ «Noah's Ark resting place '100% confirmed' after 4,300 years as huge discovery made»
- ✅ НЛО в трансляции SpaceX: «SpaceX Starship live feed viewers claim spot 'alien mothership' in orbit» ≈ «SpaceX live feed 'captures UFO mothership over Earth' as Starship reaches orbit»
- ✅ Ноев ковчег: «Noah's Ark hunt takes stunning turn as forgotten map 'matches' new discovery» ≈ «Scale of 'Noah's Ark' 515ft resting place explained in new site update»
- ✅ Boeing 737 в саду: «Dad buries Boeing 737 jet in back garden to turn it into 'war bunker and party pad'» ≈ «'I've buried a 737 jet in my back garden to be a war bunker and party pad'»

**Другие срабатывания: 5** (проверить вручную: настоящий дубль или ложная тревога)

- «'I had near-death experience and was almost dragged to hell by terrifying gnarled fingers'» (Daily Star — Weird News) ≈ «'I nearly died in truck crash and came face-to-face with God – he gave me ominous warning'» (Mirror — Weird News) — Same person LuAnn VanBuskirk and same near-death experience involving a terrifying encounter after being clipped by a t…
- «'Time traveller's' photos of World War 3 bring very bad news for humanity» (Daily Star — Weird News) ≈ «'Time traveller' from 2050 shows horror World War 3 aftermath - it's horrifying» (Daily Star — Weird News) — Same claimed time traveller sharing purported WW3 future images/videos and predictions.
- «Woman, 96, walks down the aisle to marry teenage man in jaw-dropping age-gap wedding» (Mirror — Weird News) ≈ «Woman, 96, marries 18-year-old teenager in record-breaking ceremony» (Express — Weird) — It is the same wedding: a 96-year-old woman marrying an 18-year-old man, described as a record age-gap ceremony.
- «Bus driver’s farts were so bad colleague ‘needed to take a shower’» (Metro UK — Weird) ≈ «GP explains why your farts smell or hurt as bus driver 'sacked' over nuclear fart» (Daily Star — Weird News) — Та же история о водителе автобуса и его зловонных газах; в пункте 15 упомянут тот же случай с увольнением.
- «Expert shares when you must seek medical help after bus driver 'farted badly'» (Daily Star — Weird News) ≈ «GP explains why your farts smell or hurt as bus driver 'sacked' over nuclear fart» (Daily Star — Weird News) — Same bus driver flatulence case; this is an expert medical-advice follow-up to the same story.

## 6. Ленты для рубрики «Абсурд власти»

| Издание | Статус | в день | свежая | полный текст статьи |
|---|---|---|---|---|
| ProPublica | ✅ https://www.propublica.org/feeds/propublica/main | 2.7 | 8 ч | да, 4000+ знаков |
| The Guardian — US politics | ❌ HTTP 403 | | | |
| The Guardian — Jeffrey Epstein | ❌ HTTP 403 | | | |
| NPR — Politics | ✅ https://feeds.npr.org/1014/rss.xml | 4.5 | 10 ч | да, 2923+ знаков |
| BBC — US & Canada | ✅ https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml | 4.2 | 0 ч | да, 4000+ знаков |
| The New York Times — Politics | ✅ https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml | 15.5 | 1 ч | нет (пейволл или защита) |
| The Washington Post — Politics | ✅ https://feeds.washingtonpost.com/rss/politics | 12.2 | 5 ч | нет (пейволл или защита) |
| Politico | ✅ https://rss.politico.com/politics-news.xml | 2.9 | 17 ч | нет (пейволл или защита) |
| The New Yorker — News | ✅ https://www.newyorker.com/feed/news | 2.4 | 16 ч | да, 1434+ знаков |
| The Atlantic — Politics | ✅ https://www.theatlantic.com/feed/channel/politics/ | 0.6 | 17 ч | нет (пейволл или защита) |
| Rolling Stone — Politics | ✅ https://www.rollingstone.com/politics/feed/ | 1.6 | 12 ч | да, 4000+ знаков |
