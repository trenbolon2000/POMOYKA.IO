-- Миграция под Шаг 3. Выполнить в Supabase SQL Editor поверх уже применённой
-- schema.sql. Идемпотентно. (В schema.sql эти же объекты уже есть — для чистой
-- установки отдельная миграция не нужна.)

-- Выжимка из RSS для дешёвого скоринга (этап 1 фильтра).
alter table news add column if not exists content_original text;

-- Счётчик подряд неудачных LLM-этапов -> алерт владельцу в Telegram (§8).
create table if not exists app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
