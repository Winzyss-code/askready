-- AskReady 003: saved moods, a shared rate limit, and stage timings for the /speed page.
-- Run once in the Supabase SQL Editor on a project that already has 002 (new projects: schema.sql includes it).
-- Optional: the app works without it, with moods unsaved, per-instance rate limits and no /speed numbers.
begin;

-- The counterpart's mood for each reply, so a reloaded conversation keeps its expressions.
alter table public.turns add column if not exists emotion text
  check (emotion is null or emotion in ('neutral', 'skeptical', 'warm', 'impatient', 'impressed'));

-- One row per hashed key (the app hashes user ids and IP addresses before sending them). Server only.
create table if not exists public.rate_limits (
  key text primary key check (char_length(key) between 1 and 128),
  count integer not null,
  resets_at timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

-- Counts one hit and says whether it is within the limit. Atomic per key, shared by every app instance.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_key is null or p_max is null or p_max < 1 or p_window_seconds is null or p_window_seconds < 1 then raise exception 'INVALID_INPUT'; end if;
  insert into public.rate_limits as limits (key, count, resets_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count = case when limits.resets_at <= now() then 1 else limits.count + 1 end,
    resets_at = case when limits.resets_at <= now() then now() + make_interval(secs => p_window_seconds) else limits.resets_at end
  returning count into v_count;
  -- Now and then, clear out windows that ended a day ago.
  if random() < 0.01 then delete from public.rate_limits where resets_at < now() - interval '1 day'; end if;
  return v_count <= p_max;
end $$;

-- How long each stage took. Stage and duration only: nothing about who or what.
create table if not exists public.stage_timings (
  id bigint generated always as identity primary key,
  stage text not null check (stage ~ '^[a-z_]{1,40}$'),
  duration_ms integer not null check (duration_ms between 0 and 600000),
  created_at timestamptz not null default now()
);
create index if not exists stage_timings_stage_created_idx on public.stage_timings (stage, created_at desc);
alter table public.stage_timings enable row level security;
revoke all on public.stage_timings from anon, authenticated;
grant all on public.stage_timings to service_role;

create or replace function public.stage_timing_summary(p_days integer default 7)
returns table (stage text, samples bigint, p50_ms integer, p90_ms integer, max_ms integer)
language sql stable security definer set search_path = '' as $$
  select t.stage, count(*),
    round(percentile_cont(0.5) within group (order by t.duration_ms))::integer,
    round(percentile_cont(0.9) within group (order by t.duration_ms))::integer,
    max(t.duration_ms)
  from public.stage_timings t
  where t.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
  group by t.stage
  order by t.stage
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.stage_timing_summary(integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.stage_timing_summary(integer) to service_role;
commit;
