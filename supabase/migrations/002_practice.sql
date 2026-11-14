-- Upgrade an existing checkpoint-1 installation. Fresh projects use schema.sql.
begin;
-- Match fresh-install permissions: all writes go through verified server routes.
-- Old INSERT policies alone must not let clients bypass quotas or forge scores.
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
