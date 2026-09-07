-- Помойка — схема Supabase (PostgreSQL). Шаг 1.
-- Применяется на чистой БД через Supabase SQL Editor. Идемпотентна.

create extension if not exists pgcrypto;

-- Источники (проверенные редакции с фактчекингом). См. docs/tz-codex.md §4.
create table if not exists sources (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  rss_url  text not null unique,
  region   text,
  active   boolean not null default true
);

-- Новости: черновик от парсера -> оценка/рерайт от LLM -> публикация.
create table if not exists news (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references sources(id),
  original_url        text not null unique,          -- защита от дублей
  title_original      text,                          -- заголовок на языке источника
  content_original    text,                          -- выжимка из RSS (~300-500 симв.) для дешёвого скоринга
  title_rewritten     text,                          -- переписанный заголовок (ru)
  content_summary     text,                          -- выжимка 1-2 абзаца (ru)
  absurdity_score     real,                          -- NULL = ещё не обработано LLM
  safety_flag         boolean,                       -- true: криминал/политика/трагедии/насилие
  source_published_at timestamptz,                   -- дата публикации у источника
  fetched_at          timestamptz not null default now(),  -- когда наш парсер увидел
  posted_to_telegram  boolean not null default false,
  telegram_message_id text,
  posted_at           timestamptz                    -- момент реальной публикации в канал
);

-- Записи с safety_flag = true сохраняются (для калибровки промпта),
-- но никогда не публикуются и не учитываются при отборе.

-- Парсер: сверка нормализованного заголовка с последними ~200 записями.
create index if not exists news_fetched_at_idx on news (fetched_at desc);

-- Фильтр: выборка необработанных записей.
create index if not exists news_unprocessed_idx on news (fetched_at)
  where absurdity_score is null;

-- Постинг: выборка кандидатов на публикацию.
create index if not exists news_postable_idx on news (absurdity_score desc)
  where posted_to_telegram = false and safety_flag = false;

-- Дайджест: группировка по календарным суткам публикации.
create index if not exists news_posted_at_idx on news (posted_at desc)
  where posted_to_telegram = true;

-- Служебное состояние между запусками крона (счётчик подряд неудачных
-- LLM-этапов для алерта владельцу — см. docs/tz-codex.md §8).
create table if not exists app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
