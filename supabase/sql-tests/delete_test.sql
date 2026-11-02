-- Account deletion removes the person and every trace of them.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a9'),  -- Gaspard
  ('00000000-0000-0000-0000-0000000000b9');  -- Hana

create function pg_temp.act_as(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || u, false);
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated;
set role authenticated;

select pg_temp.act_as('b9'); select public.ensure_profile();
select pg_temp.act_as('a9'); select public.ensure_profile();
reset role;
select invite_code as hana_code from public.profiles where id = '00000000-0000-0000-0000-0000000000b9' \gset
set role authenticated;
select public.join_duo(:'hana_code');
select public.request_witness(:'hana_code');
select public.register_push_token('ExponentPushToken[gaspard]', 'fr');
select pg_temp.act_as('b9');
select public.respond_witness('00000000-0000-0000-0000-0000000000a9', true);
select public.send_cheer(current_date);

select pg_temp.act_as('a9');
select public.delete_account();

reset role;
select pg_temp.check(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000a9'), 'auth user deleted');
select pg_temp.check(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a9'), 'profile deleted');
select pg_temp.check(not exists (select 1 from public.witnesses where '00000000-0000-0000-0000-0000000000a9' in (owner_id, witness_id)), 'witness links deleted');
select pg_temp.check(not exists (select 1 from public.cheers where '00000000-0000-0000-0000-0000000000a9' in (from_id, to_id)), 'cheers deleted');
select pg_temp.check(not exists (select 1 from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000a9'), 'push tokens deleted');
select pg_temp.check(not exists (select 1 from public.duo_members where user_id = '00000000-0000-0000-0000-0000000000b9'), 'partner left without a duo');
select pg_temp.check(exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b9'), 'partner kept');

set role anon;
do $$ begin
  perform public.delete_account();
  raise exception 'anon could delete';
exception when insufficient_privilege then raise notice 'ok - anon cannot call delete_account';
end $$;
