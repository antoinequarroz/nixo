-- Minimal stand-in for the Supabase auth schema, so the migrations can be
-- tested on a plain local Postgres (see scripts/test-db.sh).
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Stand-in for pg_net: records outgoing requests instead of sending them.
create schema net;
create table net.sent (id bigserial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$
  insert into net.sent (url, body, headers) values (url, body, headers) returning id
$$;
