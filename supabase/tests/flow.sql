-- Disposable database only. All fixture writes roll back.
begin;
insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333'), ('44444444-4444-4444-8444-444444444444');
set local role service_role;
do $$
declare
  u uuid := '33333333-3333-4333-8333-333333333333';
  other_user uuid := '44444444-4444-4444-8444-444444444444';
  request_id uuid := gen_random_uuid();
  reply_id uuid := gen_random_uuid();
  sid uuid;
  result jsonb;
begin
  assert current_user = 'service_role', 'Flow must exercise service_role grants';
  assert not (select rolsuper from pg_roles where rolname = current_user), 'Flow must not run as superuser';
  result := public.create_practice(u, 'raise', 'budget', '{}', request_id, 'What is your case?');
  sid := (result->>'id')::uuid;
  assert (public.create_practice(u, 'raise', 'budget', '{}', request_id, 'Duplicate')->>'id')::uuid = sid, 'Start idempotency failed';
  assert (select count(*) = 1 from public.turns where session_id = sid), 'Duplicate opener';
  begin
    perform public.create_practice(u, 'raise', 'budget', '{}', gen_random_uuid(), 'Again?');
    raise exception 'Expected quota failure';
  exception when raise_exception then
    if sqlerrm <> 'DAILY_LIMIT' then raise; end if;
  end;
  begin
    perform public.append_exchange(other_user, sid, gen_random_uuid(), 'Steal session', null, 0, 1, 'No');
    raise exception 'Expected ownership failure';
  exception when raise_exception then
    if sqlerrm <> 'SESSION_NOT_FOUND' then raise; end if;
  end;
  perform public.append_exchange(u, sid, reply_id, 'I want a raise', null, 0, 1, 'What results support it?');
  perform public.append_exchange(u, sid, reply_id, 'Duplicate', null, 0, 1, 'Duplicate');
  assert (select count(*) = 3 from public.turns where session_id = sid), 'Reply idempotency failed';
  begin
    perform public.append_exchange(u, sid, gen_random_uuid(), 'Stale', null, 0, 1, 'Stale');
    raise exception 'Expected stale turn failure';
  exception when raise_exception then
    if sqlerrm <> 'SESSION_CHANGED' then raise; end if;
  end;
  begin
    perform public.save_feedback(u, sid, 0, '{}', '[]', '{}', '{"objection":"What results support it?"}', 3);
    raise exception 'Expected minimum turn failure';
  exception when raise_exception then
    if sqlerrm <> 'MORE_PRACTICE_NEEDED' then raise; end if;
  end;
  perform public.append_exchange(u, sid, gen_random_uuid(), 'I improved delivery by 20%', 15000, 0, 3, 'What timing works?');
  begin
    perform public.save_feedback(u, sid, 0, '{}', '[]', '{}', '{"objection":"What results support it?"}', 3);
    raise exception 'Expected stale feedback failure';
  exception when raise_exception then
    if sqlerrm <> 'SESSION_CHANGED' then raise; end if;
  end;
  perform public.save_feedback(u, sid, 0, '{}', '[]', '{}', '{"objection":"What results support it?"}', 5);
  perform public.save_feedback(u, sid, 0, '{}', '[]', '{}', '{"objection":"Duplicate"}', 5);
  assert (select status = 'feedback' from public.sessions where id = sid), 'Feedback state missing';
  assert (select count(*) = 1 from public.feedback where session_id = sid), 'Feedback idempotency failed';
  begin
    perform public.append_exchange(u, sid, gen_random_uuid(), 'Late answer', null, 0, 5, 'Late');
    raise exception 'Expected closed practice failure';
  exception when raise_exception then
    if sqlerrm <> 'SESSION_CLOSED' then raise; end if;
  end;
  reply_id := gen_random_uuid();
  perform public.append_exchange(u, sid, reply_id, 'My delivery improved by 20%', 10000, 1, 0, null);
  perform public.append_exchange(u, sid, reply_id, 'Duplicate retry', null, 1, 0, null);
  assert (select count(*) = 2 from public.turns where session_id = sid and attempt = 1), 'Retry idempotency failed';
  assert (select text = 'What results support it?' from public.turns where session_id = sid and attempt = 1 and role = 'assistant'), 'Retry objection changed';
  perform public.save_feedback(u, sid, 1, '{}', '[]', '{}', null, 2);
  assert (select status = 'complete' from public.sessions where id = sid), 'Completion state missing';
  assert (select count(*) = 2 from public.feedback where session_id = sid), 'Comparison missing';
end $$;
set local role authenticated;
do $$
begin
  begin
    perform public.create_practice('33333333-3333-4333-8333-333333333333', 'raise', 'budget', '{}', gen_random_uuid(), 'Unauthorized');
    raise exception 'Browser could execute server-only RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.append_exchange('33333333-3333-4333-8333-333333333333', gen_random_uuid(), gen_random_uuid(), 'Unauthorized', null, 0, 0, 'No');
    raise exception 'Browser could execute append RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_feedback('33333333-3333-4333-8333-333333333333', gen_random_uuid(), 0, '{}', '[]', '{}', null, 0);
    raise exception 'Browser could execute feedback RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
