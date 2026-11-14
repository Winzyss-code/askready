-- AskReady full schema. Run once in Supabase SQL Editor on a NEW project.
-- Existing checkpoint-1 projects should run migrations/002_practice.sql only.
-- Anonymous Auth users have the `authenticated` Postgres role.
-- Browser writes are denied. Server-only RPCs enforce session quotas and state.
-- Ordinary reads always use the user's JWT, never service_role.
begin;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id text not null check (char_length(scenario_id) between 1 and 80),
  persona_id text not null check (char_length(persona_id) between 1 and 80),
  setup jsonb not null check (jsonb_typeof(setup) = 'object'),
  created_at timestamptz not null default now()
);
create index sessions_user_created_idx on public.sessions (user_id, created_at desc);

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null check (char_length(text) between 1 and 6000),
  audio_duration_ms integer check (audio_duration_ms between 1 and 180000),
  -- Attempt/sequence make retries distinguishable and ordering deterministic.
  attempt integer not null default 0 check (attempt in (0, 1)),
  sequence integer not null check (sequence >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, attempt, sequence)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  attempt integer not null check (attempt in (0, 1)),
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  improvements jsonb not null check (jsonb_typeof(improvements) = 'array'),
  delivery_stats jsonb not null check (jsonb_typeof(delivery_stats) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, attempt)
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  -- Ownership is needed for the same own-rows-only rule as the other tables.
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email = lower(trim(email))),
  created_at timestamptz not null default now(),
  unique (user_id)
);
create index waitlist_email_idx on public.waitlist (email);

alter table public.sessions enable row level security;
alter table public.turns enable row level security;
alter table public.feedback enable row level security;
alter table public.waitlist enable row level security;

create policy sessions_read_own on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy turns_read_own on public.turns for select to authenticated
  using (exists (
    select 1 from public.sessions
    where sessions.id = turns.session_id and sessions.user_id = (select auth.uid())
  ));
create policy feedback_read_own on public.feedback for select to authenticated
  using (exists (
    select 1 from public.sessions
    where sessions.id = feedback.session_id and sessions.user_id = (select auth.uid())
  ));
create policy waitlist_read_own on public.waitlist for select to authenticated
  using (user_id = (select auth.uid()));

-- Explicit grants avoid Supabase project defaults exposing writes accidentally.
revoke all on public.sessions, public.turns, public.feedback, public.waitlist from anon, authenticated;
grant select on public.sessions, public.turns, public.feedback, public.waitlist to authenticated;
grant all on public.sessions, public.turns, public.feedback, public.waitlist to service_role;


alter table public.sessions add column status text not null default 'practice'
  check (status in ('practice', 'feedback', 'complete'));
alter table public.sessions add column request_id uuid;
create unique index sessions_user_request_idx on public.sessions(user_id, request_id) where request_id is not null;
alter table public.turns add column request_id uuid;
create unique index turns_session_request_idx on public.turns(session_id, request_id) where request_id is not null;
alter table public.feedback add column focus jsonb check (focus is null or jsonb_typeof(focus) = 'object');

-- Server-only transaction boundaries. No function accepts user identity from a browser;
-- the API verifies the user's JWT first and supplies p_user_id with its service key.
create function public.create_practice(
  p_user_id uuid, p_scenario_id text, p_persona_id text, p_setup jsonb,
  p_request_id uuid, p_opening text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions;
  v_midnight timestamptz := (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
begin
  if p_user_id is null or p_request_id is null then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_session from public.sessions where user_id = p_user_id and request_id = p_request_id;
  if found then return to_jsonb(v_session); end if;
  if (select count(*) from public.sessions where user_id = p_user_id and created_at >= v_midnight) >= 1 then
    raise exception 'DAILY_LIMIT';
  end if;
  insert into public.sessions(user_id, scenario_id, persona_id, setup, request_id)
    values(p_user_id, p_scenario_id, p_persona_id, p_setup, p_request_id) returning * into v_session;
  insert into public.turns(session_id, role, text, attempt, sequence)
    values(v_session.id, 'assistant', p_opening, 0, 0);
  return to_jsonb(v_session);
end $$;

create function public.append_exchange(
  p_user_id uuid, p_session_id uuid, p_request_id uuid, p_text text,
  p_audio_duration_ms integer, p_attempt integer, p_expected_sequence integer,
  p_reply text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions;
  v_sequence integer;
  v_focus jsonb;
begin
  if p_request_id is null or p_attempt is null or p_attempt not in (0, 1) then raise exception 'INVALID_INPUT'; end if;
  select * into v_session from public.sessions where id = p_session_id and user_id = p_user_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if exists(select 1 from public.turns where session_id = p_session_id and request_id = p_request_id) then return; end if;
  select coalesce(max(sequence) + 1, 0) into v_sequence from public.turns where session_id = p_session_id and attempt = p_attempt;
  if p_expected_sequence is distinct from v_sequence then raise exception 'SESSION_CHANGED'; end if;
  if p_attempt = 0 then
    if v_session.status <> 'practice' then raise exception 'SESSION_CLOSED'; end if;
    if (select count(*) from public.turns where session_id = p_session_id and attempt = 0 and role = 'user') >= 6 then raise exception 'TURN_LIMIT'; end if;
    if p_reply is null then raise exception 'INVALID_INPUT'; end if;
    insert into public.turns(session_id, role, text, audio_duration_ms, attempt, sequence, request_id)
      values(p_session_id, 'user', p_text, p_audio_duration_ms, 0, v_sequence, p_request_id);
    insert into public.turns(session_id, role, text, attempt, sequence)
      values(p_session_id, 'assistant', p_reply, 0, v_sequence + 1);
  else
    if v_session.status <> 'feedback' then raise exception 'SESSION_CLOSED'; end if;
    if exists(select 1 from public.turns where session_id = p_session_id and attempt = 1) then raise exception 'RETRY_EXISTS'; end if;
    select focus into v_focus from public.feedback where session_id = p_session_id and attempt = 0;
    if v_focus is null or nullif(v_focus->>'objection', '') is null then raise exception 'MORE_PRACTICE_NEEDED'; end if;
    insert into public.turns(session_id, role, text, attempt, sequence)
      values(p_session_id, 'assistant', v_focus->>'objection', 1, 0);
    insert into public.turns(session_id, role, text, audio_duration_ms, attempt, sequence, request_id)
      values(p_session_id, 'user', p_text, p_audio_duration_ms, 1, 1, p_request_id);
  end if;
end $$;

create function public.save_feedback(
  p_user_id uuid, p_session_id uuid, p_attempt integer,
  p_scores jsonb, p_improvements jsonb, p_delivery_stats jsonb,
  p_focus jsonb, p_expected_count integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions;
  v_count integer;
  v_users integer;
begin
  if p_attempt is null or p_attempt not in (0, 1) then raise exception 'INVALID_INPUT'; end if;
  select * into v_session from public.sessions where id = p_session_id and user_id = p_user_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if exists(select 1 from public.feedback where session_id = p_session_id and attempt = p_attempt) then return; end if;
  select count(*), count(*) filter(where role = 'user') into v_count, v_users
    from public.turns where session_id = p_session_id and attempt = p_attempt;
  if p_expected_count is distinct from v_count then raise exception 'SESSION_CHANGED'; end if;
  if p_attempt = 0 then
    if v_session.status <> 'practice' then raise exception 'SESSION_CLOSED'; end if;
    if v_users < 2 then raise exception 'MORE_PRACTICE_NEEDED'; end if;
    if p_focus is null or nullif(p_focus->>'objection', '') is null then raise exception 'INVALID_INPUT'; end if;
  else
    if v_session.status <> 'feedback' then raise exception 'SESSION_CLOSED'; end if;
    if v_users <> 1 or not exists(select 1 from public.feedback where session_id = p_session_id and attempt = 0) then raise exception 'MORE_PRACTICE_NEEDED'; end if;
  end if;
  insert into public.feedback(session_id, attempt, scores, improvements, delivery_stats, focus)
    values(p_session_id, p_attempt, p_scores, p_improvements, p_delivery_stats, p_focus);
  update public.sessions set status = case when p_attempt = 0 then 'feedback' else 'complete' end where id = p_session_id;
end $$;

revoke all on function public.create_practice(uuid,text,text,jsonb,uuid,text) from public, anon, authenticated;
revoke all on function public.append_exchange(uuid,uuid,uuid,text,integer,integer,integer,text) from public, anon, authenticated;
revoke all on function public.save_feedback(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,integer) from public, anon, authenticated;
grant execute on function public.create_practice(uuid,text,text,jsonb,uuid,text) to service_role;
grant execute on function public.append_exchange(uuid,uuid,uuid,text,integer,integer,integer,text) to service_role;
grant execute on function public.save_feedback(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,integer) to service_role;
commit;
