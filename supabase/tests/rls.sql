-- Run only against an isolated/test database after schema.sql.
-- Fixtures and assertions are rolled back. No production data is touched.
begin;
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.sessions (id, user_id, scenario_id, persona_id, setup) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'raise', 'tough', '{}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'raise', 'tough', '{}');
insert into public.turns (session_id, role, text, sequence) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'First user private answer', 0),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user', 'Second user private answer', 0);
insert into public.feedback (session_id, attempt, scores, improvements, delivery_stats) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, '{}', '[]', '{}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 0, '{}', '[]', '{}');
insert into public.waitlist (user_id, email) values
  ('11111111-1111-4111-8111-111111111111', 'first@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'second@example.com');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  assert (select count(*) = 1 from public.sessions), 'Session ownership failed';
  assert (select count(*) = 1 from public.turns), 'Turn ownership failed';
  assert (select count(*) = 1 from public.feedback), 'Feedback ownership failed';
  assert (select count(*) = 1 from public.waitlist), 'Waitlist ownership failed';
  assert not exists (select 1 from public.sessions where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Another user session leaked';
  assert not exists (select 1 from public.turns where session_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Another user turn leaked';
  assert not exists (select 1 from public.feedback where session_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Another user feedback leaked';
  assert not exists (select 1 from public.waitlist where email = 'second@example.com'), 'Another user email leaked';
  begin
    insert into public.sessions (scenario_id, persona_id, setup) values ('raise', 'tough', '{}');
    raise exception 'Unauthorized direct insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sessions set user_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'Ownership reassignment succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
begin
  assert (select count(*) = 1 from public.sessions), 'Second user session access failed';
  assert (select text = 'Second user private answer' from public.turns), 'Second user saw wrong turn';
end $$;

set local role anon;
do $$
begin
  begin
    perform id from public.sessions;
    raise exception 'Unauthenticated read succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
