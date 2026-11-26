# Пробный прогон шага 2 — второй круг

Запуск: 2026-11-26T04:56:18.224Z (сервер GitHub Actions). В базу ничего не записано, в канал ничего не отправлено.

## A. Англоязычные ленты взамен мёртвых (проверено с серверов GitHub)

Этап 1 — тот же промпт и та же модель, что в scripts/filter.js; до 10 самых свежих записей с ленты. Ошибок модели: 0.

| Лента | Статус | Адрес | в ленте | в день | свежая | старше 10 дн. | взято | прошли | safety_flag | ср. оценка |
|---|---|---|---|---|---|---|---|---|---|---|
| NDTV — Offbeat | ✅ | https://feeds.feedburner.com/ndtvnews-offbeat-news | 20 | 8.1 | 3 ч | 0% | 10 | 0 | 0 | 1.8 |
| Hindustan Times — Trending | ✅ | https://www.hindustantimes.com/feeds/rss/trending/rssfeed.xml | 38 | 19.3 | 1 ч | 0% | 10 | 0 | 1 | 1.4 |
| News18 — Buzz | ❌ | https://www.news18.com/rss/buzz.xml → HTTP 403; https://www.news18.com/commonfeeds/v1/eng/rss/buzz.xml → HTTP 403 | | | | | | | | |
| South China Morning Post — People & Culture | ✅ | https://www.scmp.com/rss/318202/feed | 50 | 2.4 | 3 ч | 54% | 10 | 0 | 3 | 1.3 |
| AP — Weird news (местные ТВ-станции) | ✅ | https://www.ksat.com/arc/outboundfeeds/rss/category/news/weird-news/?outputType=xml | 20 | 0.9 | 35 ч | 35% | 10 | 0 | 2 | 1.5 |
| The Jerusalem Post — OMG | ✅ | https://www.jpost.com/Rss/RssFeedsOMG | 30 | 0.0 | 306 ч | 100% | 0 | 0 | 0 | — |
| Mirror — Weird News (лента раздела) | ✅ | https://www.mirror.co.uk/news/weird-news/?service=rss | 25 | 9.3 | 14 ч | 0% | 10 | 0 | 1 | 1.2 |
| Daily Star — Weird News (лента раздела) | ✅ | https://www.dailystar.co.uk/news/weird-news/?service=rss | 25 | 6.5 | 12 ч | 0% | 10 | 1 | 3 | 2.3 |
| Global News — Odd news | ✅ | https://globalnews.ca/tag/odd-news/feed/ | 10 | 0.0 | 42128 ч | 100% | 0 | 0 | 0 | — |
| SoraNews24 | ✅ | https://soranews24.com/feed/ | 20 | 4.8 | 2 ч | 0% | 10 | 1 | 0 | 2.0 |
| The US Sun — Weird news | ❌ | https://www.the-sun.com/news/weird-news/feed/ → Unexpected close tag Line: 0 Column: 431 Char: >; https://www.the-sun.com/topic/weird-news/feed/ → Unexpected close tag Line: 0 Column: 431 Char: > | | | | | | | | |
| The Mirror US — Weird news | ❌ | https://www.themirror.com/news/weird-news/?service=rss → лента пустая или без ссылок; https://www.themirror.com/news/weird-news?service=rss → лента пустая или без ссылок | | | | | | | | |
| Mothership (Сингапур) | ❌ | https://mothership.sg/feed/ → Invalid character in entity name Line: 39 Column: 77 Char: | | | | | | | | |
| Sky News — Offbeat | ❌ | https://feeds.skynews.com/feeds/rss/offbeat.xml → HTTP 404 | | | | | | | | |
| Time — Weird news | ❌ | https://time.com/tag/weird-news/feed/ → HTTP 406 | | | | | | | | |

Всего: 70 записей, прошли порог 5: **2**, safety_flag: 10.

**Mirror и Daily Star: из каких разделов сайта записи в ленте** (раздел — сколько)

- Mirror — Weird News (текущая лента): `/money/shopping-deals` 3, `/lifestyle` 3, `/lifestyle/food-drink` 2, `/news/weird-news` 2, `/tv/tv-news` 2, `/travel` 2
- Daily Star — Weird News (текущая лента): `/news/latest-news` 13, `/real-life` 3, `/news/weird-news` 3, `/sport/football` 2, `/news/world-news` 1, `/news` 1
- Mirror — Weird News (лента раздела): `/money/shopping-deals` 3, `/lifestyle` 3, `/lifestyle/food-drink` 2, `/news/weird-news` 2, `/tv/tv-news` 2, `/travel` 2
- Daily Star — Weird News (лента раздела): `/news/latest-news` 13, `/real-life` 3, `/news/weird-news` 3, `/sport/football` 2, `/news/world-news` 1, `/news` 1

**10 лучших (без safety_flag)**

| Оценка | Прошла | Лента | Заголовок |
|---|---|---|---|
| 6 | да | Daily Star — Weird News (лента раздела) | Stowaway raccoon makes miraculous 6,000 mile journey and then 'invades Nigeria' |
| 6 | да | SoraNews24 | Taunting police by shouting “Shaolin Temple!” a growing trend among Japanese youth |
| 4 | нет | NDTV — Offbeat | "Did You Check In The Toilet?" Man Gets Seat No. 54 Ticket, Finds Coach Has Only 52 Berths |
| 3 | нет | NDTV — Offbeat | Just 2 Feet Tall, Worth Rs 1 Crore: Meet Pinky, The Tiny Buffalo Turning Heads At Pushkar Fair |
| 2 | нет | NDTV — Offbeat | Ex-Wall Street Trader Reveals How She Earns Rs 4.6 Lakh Monthly Renting Clothes Online |
| 2 | нет | NDTV — Offbeat | Did Jensen Huang Send Inappropriate Text To Colette Kress? Viral Screenshots Debunked |
| 2 | нет | NDTV — Offbeat | Australian Woman Gives Hyderabad Metro 10/10 After First Ride In India |
| 2 | нет | Hindustan Times — Trending | AI-generated Christmas market images spark backlash in UK: ‘It was just empty space’ |
| 2 | нет | Hindustan Times — Trending | Eagles hunt baboons weighing up to 26 kg in the Sahara, raising questions about whether they preyed on ancien… |
| 2 | нет | Hindustan Times — Trending | Artist David Garibaldi completes Statue of Liberty portrait in 43.5 seconds in record attempt |

**Рерайт лучших (3)**

1. Daily Star — Weird News (лента раздела) · оценка 6 — https://www.dailystar.co.uk/news/latest-news/stowaway-raccoon-makes-miraculous-6000-37914961
> Stowaway raccoon makes miraculous 6,000 mile journey and then 'invades Nigeria'

**Енот-нелегал проплыл 6000 миль в контейнере и «вторгся» в Нигерию**

Енот из Канады забрался в 40-футовый контейнер с грузом и за шесть недель доплыл до Лагоса. Всё это время он питался содержимым контейнера и, сука, сожрал почти все припасы. Грузчики вытащили его наружу — зверь вышел крупным, откормленным и здоровым. В соцсетях енота уже окрестили Рони.

_полный текст статьи: да; переписано повторно: нет_

2. SoraNews24 · оценка 6 — https://soranews24.com/2026/11/25/taunting-police-by-shouting-shaolin-temple-a-growing-trend-among-japanese-youth/
> Taunting police by shouting “Shaolin Temple!” a growing trend among Japanese youth

**«Шаолинь-рейсинг»: японские школьники с криком врываются в полицейские будки и убегают**

В Японии набирает ход «Шаолинь-рейсинг»: школьники распахивают дверь полицейской будки кобан, орут «Шаолинь!» и с хохотом убегают. Кто-то запрыгивает на стойку дежурного, кто-то звонит на 110 и кричит название храма в трубку — всё снимается на видео и уходит в соцсети. В Осака, Хёго, Хиросиме и Тояме несовершеннолетних уже задерживали, а столичная полиция на всякий случай напомнила: это незаконное проникновение, до трёх лет или штраф. Сами пойманные объяснить, какого хуя они это делают, не могут.

_полный текст статьи: да; переписано повторно: да_

3. NDTV — Offbeat · оценка 4 (порог не прошла — для примера) — https://www.ndtv.com/offbeat/did-you-check-in-the-toilet-man-gets-seat-no-54-ticket-finds-coach-has-only-52-berths-12373530#publisher=newsstand
> "Did You Check In The Toilet?" Man Gets Seat No. 54 Ticket, Finds Coach Has Only 52 Berths

**«А в туалете смотрели?» Пассажиру продали билет на место 54 в вагоне, где мест всего 52**

Пассажир Ишан Баджпаи утверждает, что ему досталось место A1/54 в поезде № 15132. В вагоне, по его словам, всего 52 места. То есть места под номером 54 не существует — и где спать, хуй его разберёт.

_полный текст статьи: нет, по RSS; переписано повторно: нет_

## B. Светская хроника СНГ: как сейчас и с предлагаемыми якорями

До 30 самых свежих записей с ленты, всего 229. Этап 1 дважды: как сейчас и с предложением — якоря ниже вставлены в конец материалов редактора, строка про политику — к правилу safety_flag. Только в памяти прогона: prompts/editor.md не менялся.

<details><summary>Якоря и строка про политику, которые проверялись</summary>

### Светская хроника и звёзды (предложение)

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
    абсурда в этом ни было

Строка про политику (этап 1, код): Политика — это в том числе война России с Украиной и армия, мобилизация, санкции, эмиграция и «уехавшие», иноагенты и «нежелательные», отмены концертов, запреты и суды по политическим причинам, высказывания о власти — даже в светской хронике.

</details>

| Лента | Адрес | в день | записей | политика | прошли сейчас | прошли с якорями | safety_flag сейчас / с якорями |
|---|---|---|---|---|---|---|---|
| StarHit | https://www.starhit.ru/rss/ | 30.8 | 30 | 1 (3%) | 0 | 0 | 8 / 7 |
| 7 Дней | https://7days.ru/rss/ | 18.8 | 30 | 0 (0%) | 0 | 0 | 2 / 2 |
| Сплетник | https://www.spletnik.ru/rss | 26.2 | 30 | 3 (10%) | 0 | 1 | 7 / 8 |
| Woman.ru | https://www.woman.ru/rss/ | 22.0 | 30 | 0 (0%) | 0 | 0 | 4 / 5 |
| PeopleTalk | https://peopletalk.ru/feed/ | 17.6 | 30 | 0 (0%) | 0 | 0 | 4 / 5 |
| Афиша Daily | https://daily.afisha.ru/rss/ | 3.2 | 5 | 0 (0%) | 0 | 0 | 0 / 0 |
| МК — Культура | https://www.mk.ru/rss/culture/index.xml | 7.7 | 30 | 1 (3%) | 0 | 0 | 6 / 7 |
| Газета.Ru — Культура | https://www.gazeta.ru/export/rss/culture.xml | 1.3 | 14 | 2 (14%) | 0 | 0 | 5 / 6 |
| Лента.ру — Культура | https://lenta.ru/rss/news/culture | 16.4 | 30 | 3 (10%) | 0 | 0 | 7 / 14 |

«Газета.Ru» после починки кодировки: нечитаемых заголовков 0 из 15. Примеры: «"Я единственный в стране, кто работает в жанре экшен": интервью с акт…»; «"Позорище, но что делать": Собчак удалила интервью с Синяком и Григор…»; «Звезду "Великолепного века" задержали по делу о наркотиках и проститу…».

Прошли порог: сейчас **0**, с якорями **1** из 229.

**Прошли с якорями** (оценка · лента · заголовок)

- 7 · Сплетник · Бьянка Цензори создала гигантскую куклу-двойника, перед которой нужно преклонять колени

**Политика:** записей 10. Проскочили мимо safety_flag: сейчас **2**, с предложением **0**; из них прошли бы порог: сейчас 0, с предложением 0.

**Рерайт 3 лучших с правилом про мат рядом с именами**

1. Сплетник · оценка с якорями 7 — https://spletnik.ru/byanka-tsenzori-sozdala-gigantskuyu-kuklu-dvoynika-pered-kotoroy-nuzhno-preklonyat-koleni-346462
> Бьянка Цензори создала гигантскую куклу-двойника, перед которой нужно преклонять колени

**Бьянка Цензори построила трёхметровую куклу-двойника, перед которой надо стоять на коленях**

В Нью-Йорке Бьянка Цензори анонсировала выставку Bio Pop 02, где главным экспонатом станет трёхметровый робот-автопортрет, говорящий её голосом. На разработку ушло пять лет, а чтобы задать кукле вопрос и получить ответ, посетителю придётся встать на колени. По её словам, она заговорит впервые. Вся эта затея с коленопреклонением перед роботом — полный пиздец.

_полный текст статьи: да; переписано повторно: нет_

2. Сплетник · оценка с якорями 3 (порог не прошла — для примера) — https://spletnik.ru/artemiy-lebedev-ischet-byvshikh-zaklyuchyonnykh-dlya-razrabotki-dizayna-sizo-346467
> Артемий Лебедев ищет бывших заключённых для разработки дизайна СИЗО

**Лебедев ищет тех, кто сидел, чтобы сделать дизайн СИЗО человечнее**

51-летний дизайнер объявил в своём телеграм-канале набор консультантов для разработки дизайна СИЗО — приглашает и тех, кто там сидел, и сотрудников службы исполнения наказаний. Задача — чтобы попавшие в изолятор люди просто временно содержались под стражей, а не страдали от условий, которые зачастую хуже, чем в тюрьме. Отдельная цель — чтобы фотографии российских СИЗО показывали как пример человеческого отношения к людям, а на зарубежные нельзя было смотреть без ужаса. Замах, конечно, пиздец.

_полный текст статьи: да; переписано повторно: нет_

3. StarHit · оценка с якорями 2 (порог не прошла — для примера) — https://www.starhit.ru/novosti/molodaya-zhena-81-letnego-kompozitora-igorya-lavrova-otborala-u-nego-kvartiru-za-50-millionov-rublei-76790420/
> Молодая жена 81-летнего композитора Игоря Лаврова отобрала у него квартиру за 50 миллионов рублей

**Композитор Лавров не помнит, как квартира за 50 миллионов оказалась у молодой жены**

Дочь 81-летнего композитора Игоря Лаврова утверждает, что его молодая жена Гульнара Галимшина лишает отца имущества: московская квартира за 50 миллионов оформлена на нее, а деньги со счетов пропали. Сам Лавров говорит, что не помнит, как подписывал документы, а Гульнара заявляет, что год не может с ним встретиться. Есть версия, что жена давала ему психотропные средства. В общем, вышел полный пиздец.

_полный текст статьи: да; переписано повторно: нет_

## C. Сверка дублей, вторая версия

У новой записи — начало полного текста статьи (открылся у 135 из 168, иначе выжимка из RSS), у опубликованных — наш рерайт. Проверок: 168, ошибок модели: 0.

**Известные дубли (10 из первого прогона + 4 найденные им и проверенные вручную): поймано 14, пропущено 0**

- ✅ Клиническая смерть Луэнн Ванбаскирк: «'I had near-death experience and was almost dragged to hell by terrifying gnarled fingers'» ≈ «'I nearly died in truck crash and came face-to-face with God – he gave me ominous warning'»
- ✅ Hyrox: «Hyrox issues apology for allowing race to continue after athlete soils herself» ≈ «Hyrox winner soils herself at event but carries on anyway before issuing defiant response»
- ✅ Hyrox: «Diarrhea-soaked Hyrox athlete divides internet over whether she should have quit» ≈ «Hyrox winner soils herself at event but carries on anyway before issuing defiant response»
- ✅ Hyrox: «Hyrox athlete competes despite diarrhea — using shared equipment and horrifying onlookers» ≈ «Hyrox issues apology for allowing race to continue after athlete soils herself»
- ✅ Имплант звезды WWE: «WWE legend known as 'First Lady of Wrestling' flogs boob implant after bidding frenzy» ≈ «WWE legend, 62, giving fans the chance to 'hold' her by flogging her breast implant»
- ✅ Лох-несские чудовища из космоса: «'Family of Loch Ness Monsters' witnessed from space in baffling Google Earth images» ≈ «'Family of Loch Ness Monsters' spotted from space in bizarre Google Earth images»
- ✅ Семейка Аддамс и кукла: «Real-life Addams Family let children play with haunted 'Annie' doll that 'weeps acid tear…» ≈ «Real-life Addams Family let children play with haunted doll that 'wept tears of acid'»
- ✅ Ноев ковчег: «Scale of 'Noah's Ark' 515ft resting place explained in new site update» ≈ «Noah's Ark resting place '100% confirmed' after 4,300 years as huge discovery made»
- ✅ НЛО в трансляции SpaceX: «SpaceX Starship live feed viewers claim spot 'alien mothership' in orbit» ≈ «SpaceX live feed 'captures UFO mothership over Earth' as Starship reaches orbit»
- ✅ Ноев ковчег: «Noah's Ark hunt takes stunning turn as forgotten map 'matches' new discovery» ≈ «Scale of 'Noah's Ark' 515ft resting place explained in new site update»
- ✅ Свадьба 96-летней и 18-летнего: «Woman, 96, walks down the aisle to marry teenage man in jaw-dropping age-gap wedding» ≈ «Woman, 96, marries 18-year-old teenager in record-breaking ceremony»
- ✅ Водитель автобуса и газы: «Bus driver’s farts were so bad colleague ‘needed to take a shower’» ≈ «GP explains why your farts smell or hurt as bus driver 'sacked' over nuclear fart»
- ✅ Водитель автобуса и газы: «Expert shares when you must seek medical help after bus driver 'farted badly'» ≈ «GP explains why your farts smell or hurt as bus driver 'sacked' over nuclear fart»
- ✅ Boeing 737 в саду: «Dad buries Boeing 737 jet in back garden to turn it into 'war bunker and party pad'» ≈ «'I've buried a 737 jet in my back garden to be a war bunker and party pad'»

**Ложная тревога первого прогона** (разные случаи с похожими заголовками): ушла ✅

**Другие срабатывания: 0** (проверить вручную)

