-- Test-only compatibility shim for an EMPTY, disposable plain PostgreSQL database.
-- Never run this file in Supabase or in a production database.
-- This provides only the auth schema/roles used by the RLS migration tests.
-- It does not simulate Supabase Auth sign-in, tokens, or HTTP behavior.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
