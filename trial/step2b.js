// Пробный прогон шага 2, второй круг. НИЧЕГО не пишет в базу и НИЧЕГО не публикует.
//
//   A. Новые англоязычные ленты взамен мёртвых: живы ли с серверов GitHub,
//      этап 1 на свежих записях (тот же промпт, та же модель), рерайт 5 лучших.
//      Mirror и Daily Star: из каких разделов сайта приходят записи в текущей
//      ленте и в ленте самого раздела.
//   B. Светская хроника СНГ: этап 1 как сейчас и с предлагаемыми якорями +
//      строкой про политику (только в памяти прогона, editor.md не меняется):
//      сколько проходит порог, сколько политики проскакивает; рерайт 3 лучших
//      с правилом про мат рядом с именами. «Газета.Ru» — после починки кодировки.
//   C. Сверка дублей, вторая версия: у новой записи — начало полного текста
//      статьи, у опубликованных — наш рерайт. Что ловится, что нет, ложные тревоги.
//
// Отчёт: trial/report/step2b-report.md (+ сырые данные step2b-data.json).

import { mkdirSync, writeFileSync } from 'node:fs';
import { db } from '../lib/db.js';
import { findSameStory, toStory, DEDUP_DAYS } from '../lib/dedup.js';
import {
  NOW, DAY, pct, cut, cell, fmt1, pool, makeSection, selectAll, checkSite, fresh, sitePath,
  stage1, stage2, politicsMessages, chatJson, fetchArticleText, REWRITE_THRESHOLD,
} from './common.js';
import { WEIRD_EN_2, CURRENT_REACH, SHOWBIZ_RU_2, CELEB_ANCHORS, POLITICS_LINE, withProposal } from './candidates2.js';
import { PEOPLE_RULE, KNOWN_DUPLICATES } from './candidates.js';

const OUT_DIR = new URL('./report/', import.meta.url);
const EN_PER_SITE = 10;
const RU_PER_SITE = 30;
const TOP_REWRITE = 5;
const RU_REWRITE = 3;
const LLM_CONCURRENCY = 8;
const FEED_CONCURRENCY = 8;

// Пары, которые первый прогон нашёл сам и которые я проверил вручную по тексту.
const EXTRA_DUPLICATES = [
  { key: 'Клиническая смерть Луэнн Ванбаскирк', re: /near-death experience and was almost dragged|nearly died in truck crash/i },
  { key: 'Свадьба 96-летней и 18-летнего', re: /Woman, 96/i },
  { key: 'Водитель автобуса и газы', re: /bus driver.*fart|fart.*bus driver/i },
];
// Разные случаи с похожими заголовками: совпадение здесь — ложная тревога.
const KNOWN_DIFFERENT = [
  { key: 'Два разных «путешественника во времени» (@unknown.path31 и @timevoyagin)', re: /Time traveller'?s?'? (from 2050|photos of World War 3)/i },
];

const report = { startedAt: new Date(NOW).toISOString(), errors: [] };
const log = (...a) => console.log(...a);
const section = makeSection(report, log);
const md = [];
const h = (s) => md.push(`\n## ${s}\n`);
const p = (s = '') => md.push(s);

const feedRow = (c, extra = '') =>
  c.ok
    ? `| ${cell(c.site)} | ✅ | ${c.url} | ${c.stats.count} | ${fmt1(c.stats.perDay)} | ` +
      `${c.stats.newestAgeH != null ? `${Math.round(c.stats.newestAgeH)} ч` : 'без дат'} | ` +
      `${c.stats.staleShare != null ? pct(Math.round(c.stats.staleShare * 100), 100) : '—'} |${extra}`
    : `| ${cell(c.site)} | ❌ | ${cell(c.tried.map((t) => `${t.url} → ${t.error}`).join('; '))} | | | | |${extra}`;

async function main() {
  // A. Англоязычные ленты.
  await section('A. Англоязычные ленты', async () => {
    const [checked, reach] = await Promise.all([
      pool(WEIRD_EN_2, FEED_CONCURRENCY, checkSite),
      pool(CURRENT_REACH, FEED_CONCURRENCY, checkSite),
    ]);
    const working = checked.filter((c) => c.ok && fresh(c.items).length);
    const sample = working.flatMap((c) => fresh(c.items).slice(0, EN_PER_SITE));
    log(`Живых лент со свежими записями: ${working.length}, выборка ${sample.length}`);
    const s1 = await pool(sample, LLM_CONCURRENCY, (i) => stage1(i), 2);
    sample.forEach((it, k) => (it.s1 = s1[k]));
    const done = sample.filter((i) => i.s1 && !i.s1.error);

    const best = done.filter((i) => i.s1.passed).sort((a, b) => b.s1.score - a.s1.score).slice(0, TOP_REWRITE);
    if (best.length < 3) {
      const extra = done.filter((i) => !i.s1.passed && !i.s1.safety_flag).sort((a, b) => b.s1.score - a.s1.score);
      best.push(...extra.slice(0, 3 - best.length));
    }
    const rw = await pool(best, 3, (i) => stage2(i), 2);

    report.en = {
      feeds: checked.map(({ items, ...r }) => ({ ...r, titles: items.slice(0, 10).map((i) => [i.title, i.date]) })),
      sample: sample.map(({ excerpt, ...r }) => r),
      rewrites: best.map((i, k) => ({ site: i.site, title: i.title, link: i.link, s1: i.s1, rewrite: rw[k] })),
      reach: [...reach, ...checked.filter((c) => /лента раздела/.test(c.site))].map((c) => ({
        site: c.site,
        ok: c.ok,
        url: c.url,
        paths: c.ok ? Object.entries(c.items.reduce((m, i) => ((m[sitePath(i.link)] = (m[sitePath(i.link)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]) : [],
      })),
    };

    h('A. Англоязычные ленты взамен мёртвых (проверено с серверов GitHub)');
    p(`Этап 1 — тот же промпт и та же модель, что в scripts/filter.js; до ${EN_PER_SITE} самых свежих записей с ленты. Ошибок модели: ${sample.length - done.length}.`);
    p('');
    p('| Лента | Статус | Адрес | в ленте | в день | свежая | старше 10 дн. | взято | прошли | safety_flag | ср. оценка |');
    p('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const c of checked) {
      const l = done.filter((i) => i.site === c.site);
      const extra = c.ok
        ? ` ${l.length} | ${l.filter((i) => i.s1.passed).length} | ${l.filter((i) => i.s1.safety_flag).length} | ${l.length ? (l.reduce((s, i) => s + i.s1.score, 0) / l.length).toFixed(1) : '—'} |`
        : ' | | | |';
      p(feedRow(c, extra));
    }
    p(`\nВсего: ${done.length} записей, прошли порог ${REWRITE_THRESHOLD}: **${done.filter((i) => i.s1.passed).length}**, safety_flag: ${done.filter((i) => i.s1.safety_flag).length}.`);

    p('\n**Mirror и Daily Star: из каких разделов сайта записи в ленте** (раздел — сколько)\n');
    for (const r of report.en.reach) {
      p(`- ${r.site}: ${r.ok ? r.paths.slice(0, 6).map(([k, n]) => `\`${k}\` ${n}`).join(', ') : 'лента не открылась'}`);
    }

    const top = done.filter((i) => !i.s1.safety_flag).sort((a, b) => b.s1.score - a.s1.score).slice(0, 10);
    p('\n**10 лучших (без safety_flag)**\n');
    p('| Оценка | Прошла | Лента | Заголовок |');
    p('|---|---|---|---|');
    for (const i of top) p(`| ${i.s1.score} | ${i.s1.passed ? 'да' : 'нет'} | ${cell(i.site)} | ${cell(cut(i.title, 110))} |`);

    p(`\n**Рерайт лучших (${best.length})**`);
    best.forEach((i, k) => {
      const r = rw[k];
      p(`\n${k + 1}. ${cell(i.site)} · оценка ${i.s1.score}${i.s1.passed ? '' : ' (порог не прошла — для примера)'} — ${i.link}`);
      p(`> ${cell(cut(i.title, 200))}\n`);
      if (r?.error) p(`Ошибка: ${r.error}`);
      else {
        p(`**${cell(r.title)}**\n`);
        p(`${r.summary}\n`);
        p(`_полный текст статьи: ${r.fullText ? 'да' : 'нет, по RSS'}; переписано повторно: ${r.retried ? 'да' : 'нет'}${r.stillViolates ? `; осталось нарушение: ${r.stillViolates}` : ''}_`);
      }
    });
  });

  // B. Светская хроника СНГ.
  await section('B. Светская хроника СНГ', async () => {
    const checked = await pool(SHOWBIZ_RU_2, FEED_CONCURRENCY, checkSite);
    const items = checked.filter((c) => c.ok).flatMap((c) => fresh(c.items).slice(0, RU_PER_SITE));
    log(`Записей хроники: ${items.length}`);
    const [base, prop, pol] = await Promise.all([
      pool(items, LLM_CONCURRENCY / 2, (i) => stage1(i), 2),
      pool(items, LLM_CONCURRENCY / 2, (i) => stage1(i, withProposal), 2),
      pool(items, 2, (i) => chatJson(politicsMessages(i)), 2),
    ]);
    items.forEach((it, k) => {
      it.base = base[k];
      it.prop = prop[k];
      it.pol = pol[k]?.error ? null : pol[k];
    });
    const ok = items.filter((i) => i.base && !i.base.error && i.prop && !i.prop.error);
    const political = ok.filter((i) => i.pol?.politics);
    const leaksNow = political.filter((i) => !i.base.safety_flag);
    const leaksProp = political.filter((i) => !i.prop.safety_flag);
    const passedProp = ok.filter((i) => i.prop.passed).sort((a, b) => b.prop.score - a.prop.score);

    const demo = passedProp.slice(0, RU_REWRITE);
    if (demo.length < RU_REWRITE) {
      const rest = ok.filter((i) => !i.prop.passed && !i.prop.safety_flag).sort((a, b) => b.prop.score - a.prop.score);
      demo.push(...rest.slice(0, RU_REWRITE - demo.length));
    }
    const demoRw = await pool(demo, 3, (i) => stage2(i, PEOPLE_RULE), 2);

    report.ru = {
      feeds: checked.map(({ items: its, ...r }) => ({ ...r, titles: its.slice(0, 8).map((i) => i.title) })),
      items: items.map(({ excerpt, ...r }) => r),
      demo: demo.map((i, k) => ({ site: i.site, title: i.title, link: i.link, prop: i.prop, rewrite: demoRw[k] })),
    };

    h('B. Светская хроника СНГ: как сейчас и с предлагаемыми якорями');
    p(`До ${RU_PER_SITE} самых свежих записей с ленты, всего ${ok.length}. Этап 1 дважды: как сейчас и с предложением — якоря ниже вставлены в конец материалов редактора, строка про политику — к правилу safety_flag. Только в памяти прогона: prompts/editor.md не менялся.`);
    p('\n<details><summary>Якоря и строка про политику, которые проверялись</summary>\n');
    p(CELEB_ANCHORS);
    p('');
    p(`Строка про политику (этап 1, код): ${POLITICS_LINE.trim()}`);
    p('\n</details>\n');
    p('| Лента | Адрес | в день | записей | политика | прошли сейчас | прошли с якорями | safety_flag сейчас / с якорями |');
    p('|---|---|---|---|---|---|---|---|');
    for (const c of checked) {
      if (!c.ok) {
        p(`| ${cell(c.site)} | ❌ ${cell(c.tried.map((t) => `${t.url} → ${t.error}`).join('; '))} | | | | | | |`);
        continue;
      }
      const l = ok.filter((i) => i.site === c.site);
      const pl = l.filter((i) => i.pol?.politics).length;
      p(
        `| ${cell(c.site)} | ${c.url} | ${fmt1(c.stats.perDay)} | ${l.length} | ${pl} (${pct(pl, l.length)}) | ` +
          `${l.filter((i) => i.base.passed).length} | ${l.filter((i) => i.prop.passed).length} | ` +
          `${l.filter((i) => i.base.safety_flag).length} / ${l.filter((i) => i.prop.safety_flag).length} |`,
      );
    }
    const gaz = checked.find((c) => /Газета/.test(c.site));
    if (gaz?.ok) {
      p(`\n«Газета.Ru» после починки кодировки: нечитаемых заголовков ${gaz.stats.garbled} из ${gaz.stats.count}. Примеры: ${gaz.items.slice(0, 3).map((i) => `«${cut(i.title, 70)}»`).join('; ')}.`);
    }
    p(`\nПрошли порог: сейчас **${ok.filter((i) => i.base.passed).length}**, с якорями **${passedProp.length}** из ${ok.length}.`);
    if (passedProp.length) {
      p('\n**Прошли с якорями** (оценка · лента · заголовок)\n');
      for (const i of passedProp.slice(0, 25)) p(`- ${i.prop.score} · ${i.site} · ${cut(i.title, 120)}${i.pol?.politics ? ` ⚠️ политика (${i.pol.topic})` : ''}`);
    }
    p(`\n**Политика:** записей ${political.length}. Проскочили мимо safety_flag: сейчас **${leaksNow.length}**, с предложением **${leaksProp.length}**; из них прошли бы порог: сейчас ${leaksNow.filter((i) => i.base.passed).length}, с предложением ${leaksProp.filter((i) => i.prop.passed).length}.`);
    for (const i of leaksProp.slice(0, 12)) p(`- проскочила с предложением: ${i.prop.score} · ${i.pol.topic} · ${i.site}: ${cut(i.title, 110)}`);

    p(`\n**Рерайт ${demo.length} лучших с правилом про мат рядом с именами**`);
    demo.forEach((i, k) => {
      const r = demoRw[k];
      p(`\n${k + 1}. ${cell(i.site)} · оценка с якорями ${i.prop.score}${i.prop.passed ? '' : ' (порог не прошла — для примера)'} — ${i.link}`);
      p(`> ${cell(cut(i.title, 200))}\n`);
      if (r?.error) p(`Ошибка: ${r.error}`);
      else {
        p(`**${cell(r.title)}**\n`);
        p(`${r.summary}\n`);
        p(`_полный текст статьи: ${r.fullText ? 'да' : 'нет, по RSS'}; переписано повторно: ${r.retried ? 'да' : 'нет'}${r.stillViolates ? `; осталось нарушение: ${r.stillViolates}` : ''}_`);
      }
    });
  });

  // C. Сверка дублей, вторая версия.
  await section('C. Сверка дублей v2', async () => {
    const rows = await selectAll(() =>
      db
        .from('news')
        .select('id, fetched_at, posted_to_telegram, original_url, title_original, content_original, title_rewritten, content_summary, source:sources(name)')
        .not('title_rewritten', 'is', null)
        .order('fetched_at', { ascending: true }),
    );
    const win = DEDUP_DAYS * DAY;
    const jobs = rows
      .map((b) => ({
        b,
        list: rows.filter((a) => a.id !== b.id && Date.parse(a.fetched_at) < Date.parse(b.fetched_at) && Date.parse(b.fetched_at) - Date.parse(a.fetched_at) <= win),
      }))
      .filter((j) => j.list.length);
    log(`Переписанных записей: ${rows.length}, проверок: ${jobs.length}`);

    // Как в конвейере: у новой записи — начало полного текста статьи (если открылась).
    const texts = await pool(jobs, 6, ({ b }) => fetchArticleText(b.original_url));
    const res = await pool(
      jobs,
      LLM_CONCURRENCY,
      ({ b, list }, k) => findSameStory({ title: b.title_original || '', text: (typeof texts[k] === 'string' && texts[k]) || b.content_original || '' }, list.map(toStory)),
      2,
    );

    const clusters = [...KNOWN_DUPLICATES, ...EXTRA_DUPLICATES];
    const cluster = (t) => clusters.find((k) => k.re.test(t || ''))?.key || null;
    const differ = (t) => KNOWN_DIFFERENT.find((k) => k.re.test(t || ''))?.key || null;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const caught = [];
    const missed = [];
    const falseKnown = [];
    const other = [];
    let errors = 0;
    jobs.forEach(({ b, list }, k) => {
      const r = res[k];
      if (r?.error) {
        errors++;
        return;
      }
      const match = r ? byId.get(r.story.id) : null;
      const entry = {
        b: { title: b.title_original, source: b.source?.name, at: b.fetched_at },
        a: match ? { title: match.title_original, source: match.source?.name, at: match.fetched_at } : null,
        reason: r?.reason || '',
        fullText: typeof texts[k] === 'string' && Boolean(texts[k]),
      };
      const cb = cluster(b.title_original);
      const expected = cb && list.some((a) => cluster(a.title_original) === cb);
      const db_ = differ(b.title_original);
      if (expected) (match && cluster(match.title_original) === cb ? caught : missed).push({ ...entry, cluster: cb });
      else if (db_ && match && differ(match.title_original) === db_) falseKnown.push({ ...entry, cluster: db_ });
      else if (match) other.push(entry);
    });
    report.dedup = { checks: jobs.length, errors, withFullText: texts.filter((t) => typeof t === 'string' && t).length, caught, missed, falseKnown, other };

    h('C. Сверка дублей, вторая версия');
    p(`У новой записи — начало полного текста статьи (открылся у ${report.dedup.withFullText} из ${jobs.length}, иначе выжимка из RSS), у опубликованных — наш рерайт. Проверок: ${jobs.length}, ошибок модели: ${errors}.`);
    p(`\n**Известные дубли (10 из первого прогона + 4 найденные им и проверенные вручную): поймано ${caught.length}, пропущено ${missed.length}**\n`);
    for (const e of caught) p(`- ✅ ${e.cluster}: «${cut(e.b.title, 90)}» ≈ «${cut(e.a.title, 90)}»`);
    for (const e of missed) p(`- ❌ ${e.cluster}: «${cut(e.b.title, 90)}» → ${e.a ? `спутал с «${cut(e.a.title, 80)}»` : 'не нашёл пары'}`);
    p(`\n**Ложная тревога первого прогона** (разные случаи с похожими заголовками): ${falseKnown.length ? `осталась — ${falseKnown.map((e) => e.cluster).join('; ')}` : 'ушла ✅'}`);
    p(`\n**Другие срабатывания: ${other.length}** (проверить вручную)\n`);
    for (const e of other) p(`- «${cut(e.b.title, 90)}» (${e.b.source}) ≈ «${cut(e.a.title, 90)}» (${e.a.source}) — ${cut(e.reason, 140)}`);
  });
}

main()
  .catch((e) => {
    console.error('Фатальная ошибка:', e);
    report.errors.push({ section: 'main', error: e?.stack || String(e) });
  })
  .finally(() => {
    mkdirSync(OUT_DIR, { recursive: true });
    const head = [
      '# Пробный прогон шага 2 — второй круг',
      '',
      `Запуск: ${report.startedAt} (сервер GitHub Actions). В базу ничего не записано, в канал ничего не отправлено.`,
    ];
    if (report.errors.length) head.push('', `⚠️ Ошибок разделов: ${report.errors.length} — подробности в step2b-data.json.`);
    writeFileSync(new URL('step2b-report.md', OUT_DIR), `${[...head, ...md].join('\n')}\n`);
    writeFileSync(new URL('step2b-data.json', OUT_DIR), JSON.stringify(report, null, 1));
    log('\nОтчёт: trial/report/step2b-report.md');
    // Таймеры fetchArticleText не снимаются — выходим явно, не ждём их.
    setTimeout(() => process.exit(0), 100);
  });
