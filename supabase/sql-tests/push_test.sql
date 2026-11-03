-- Push notifications: tokens and the messages sent on reports and cheers.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000e1'),  -- Emma
  ('00000000-0000-0000-0000-0000000000f2');  -- Félix

create function pg_temp.act_as(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || u, false);
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;

create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected error % from: %', expected, stmt;
exception when others then
  if sqlerrm not like '%' || expected || '%' then
    raise exception 'expected error %, got % from: %', expected, sqlerrm, stmt;
  end if;
end $$;

grant execute on all functions in schema pg_temp to authenticated;
set role authenticated;

select pg_temp.act_as('e1'); select public.ensure_profile();
update public.profiles set display_name = 'Emma', companion_name = 'Pépin' where id = auth.uid();
select public.register_push_token('ExponentPushToken[emma-phone]', 'fr');
select pg_temp.expect_error($$select public.register_push_token('not-a-token', 'fr')$$, 'push_tokens_token_check');
select pg_temp.expect_error($$select * from public.push_tokens$$, 'permission denied');

select pg_temp.act_as('f2'); select public.ensure_profile();
update public.profiles set display_name = 'Félix' where id = auth.uid();
select public.register_push_token('ExponentPushToken[felix-phone]', 'en');

reset role;
create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;
set role authenticated;

-- Félix becomes Emma's witness and duo, then reports and cheers.
select public.request_witness((select invite_code from codes where id = '00000000-0000-0000-0000-0000000000e1'));
select public.join_duo((select invite_code from codes where id = '00000000-0000-0000-0000-0000000000e1'));
select pg_temp.act_as('e1');
select public.respond_witness('00000000-0000-0000-0000-0000000000f2', true);
select pg_temp.act_as('f2');
select public.report_smoking('00000000-0000-0000-0000-0000000000e1', current_date);
select public.report_smoking('00000000-0000-0000-0000-0000000000e1', current_date);
select public.send_cheer(current_date);

-- Emma also cheers Félix, whose phone is in English.
select pg_temp.act_as('e1');
select public.send_cheer(current_date);

reset role;
select pg_temp.check((select count(*) from net.sent) = 3, 'one push per report and per cheer, none for a repeated report');
select pg_temp.check(
  (select body->0->>'body' from net.sent order by id limit 1) = 'Félix t’a vu fumer. Pépin perd 15 %.',
  'report push names the witness and the companion');
select pg_temp.check(
  (select body->0->>'to' from net.sent order by id limit 1) = 'ExponentPushToken[emma-phone]',
  'report push goes to the owner phone');
select pg_temp.check(
  (select body->0->>'body' from net.sent order by id desc limit 1) = 'Emma is sending you strength.',
  'push uses the phone language');
select pg_temp.check(
  (select url from net.sent limit 1) = 'https://exp.host/--/api/v2/push/send',
  'push goes to the Expo push service');

-- A token moves with the phone to its new account.
set role authenticated;
select pg_temp.act_as('f2');
select public.register_push_token('ExponentPushToken[emma-phone]', 'en');
reset role;
select pg_temp.check((select user_id from public.push_tokens where token = 'ExponentPushToken[emma-phone]') = '00000000-0000-0000-0000-0000000000f2', 'a token belongs to one account');
