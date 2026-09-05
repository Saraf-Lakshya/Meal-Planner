-- Meal Planner schema — run once in the Supabase SQL editor.
-- Use the SAME Supabase project as your Personal-Trainer app (one login for both).
-- Safe to re-run.

-- 1. The meal pool ("lottery list"), split by slot.
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot        text not null check (slot in ('breakfast','lunch','dinner')),
  name        text not null,
  repeatable  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, slot, name)
);

-- 2. One row per planned day. status = 'draft' (in progress, partial locks) or
--    'confirmed' (final). Confirmed rows are the history used for pattern hints.
create table if not exists public.meal_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  weekday     int  not null check (weekday between 0 and 6),
  status      text not null default 'draft' check (status in ('draft','confirmed')),
  breakfast   text,
  lunch       text,
  dinner      text,
  locks       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists meals_user_slot_idx      on public.meals (user_id, slot);
create index if not exists meal_days_user_status_idx on public.meal_days (user_id, status);
create index if not exists meal_days_user_wd_idx     on public.meal_days (user_id, weekday, status);

-- 3. Row Level Security: each user sees and edits only their own rows.
alter table public.meals     enable row level security;
alter table public.meal_days enable row level security;

drop policy if exists "meals_own" on public.meals;
create policy "meals_own" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_days_own" on public.meal_days;
create policy "meal_days_own" on public.meal_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
