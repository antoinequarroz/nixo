-- Behaviour tests for the social layer. Each block acts as one user,
-- through the "authenticated" role and row level security, like the app does.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- Alice
  ('00000000-0000-0000-0000-00000000000b'),  -- Bob
  ('00000000-0000-0000-0000-00000000000c'),  -- Chloé
  ('00000000-0000-0000-0000-00000000000d');  -- Dan, a stranger

create function pg_temp.act_as(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || u, false);
end $$;

create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected error % from: %', expected, stmt;
exception when others then
  if sqlerrm <> expected then
    raise exception 'expected error %, got % from: %', expected, sqlerrm, stmt;
  end if;
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated;
set role authenticated;

-- Profiles
select pg_temp.act_as('a'); select public.ensure_profile();
select pg_temp.act_as('b'); select public.ensure_profile();
select pg_temp.act_as('c'); select public.ensure_profile();
select pg_temp.act_as('d'); select public.ensure_profile();
select pg_temp.act_as('a');
select pg_temp.check((select count(*) from public.profiles) = 1, 'a stranger profile is invisible');
select pg_temp.check((public.ensure_profile()).invite_code = (public.ensure_profile()).invite_code, 'ensure_profile is idempotent');
select pg_temp.check(length((public.ensure_profile()).invite_code) = 6, 'invite code has 6 characters');
update public.profiles set streak = 12, companion_name = 'Pépin', display_name = 'Alice' where id = auth.uid();
select pg_temp.check((select streak from public.profiles where id = auth.uid()) = 12, 'owner updates own stats');
select pg_temp.expect_error($$update public.profiles set invite_code = 'AAAAAA'$$, 'permission denied for table profiles');
select pg_temp.expect_error($$insert into public.witnesses (owner_id, witness_id) values (auth.uid(), auth.uid())$$, 'permission denied for table witnesses');

-- Bob updating Alice's row changes nothing (RLS).
select pg_temp.act_as('b');
update public.profiles set streak = 0 where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Bob' where id = auth.uid();
select pg_temp.act_as('c'); update public.profiles set display_name = 'Chloé' where id = auth.uid();
reset role;
select pg_temp.check((select streak from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 12, 'nobody else can change my stats');
set role authenticated;

-- Duo
select pg_temp.act_as('b');
select pg_temp.expect_error($$select public.join_duo('ZZZZZZ')$$, 'unknown_code');
select pg_temp.expect_error($$select public.join_duo((public.ensure_profile()).invite_code)$$, 'own_code');
reset role;
create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;
set role authenticated;
select public.join_duo((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.check(public.my_partner() = '00000000-0000-0000-0000-00000000000a', 'bob is in a duo with alice');
select pg_temp.check((select streak from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 12, 'partner sees the streak');
select pg_temp.act_as('c');
select pg_temp.expect_error($$select public.join_duo((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'))$$, 'already_in_duo');
select pg_temp.check((select count(*) from public.duo_members) = 0, 'outsider sees no duo rows');

-- Cheers
select pg_temp.act_as('b');
select pg_temp.check(public.send_cheer(current_date), 'bob cheers alice');
select pg_temp.check(not public.send_cheer(current_date), 'only one cheer a day');
select pg_temp.expect_error($$select public.send_cheer(current_date - 10)$$, 'invalid_day');
select pg_temp.act_as('c');
select pg_temp.expect_error($$select public.send_cheer(current_date)$$, 'no_duo');
select pg_temp.act_as('a');
select pg_temp.check((select count(*) from public.consume_cheers() where from_name = 'Bob') = 1, 'alice receives the cheer with a name');
select pg_temp.check((select count(*) from public.consume_cheers()) = 0, 'a cheer is delivered once');

-- Witnesses
select pg_temp.act_as('c');
select public.request_witness((select invite_code from codes where id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.expect_error($$select public.report_smoking('00000000-0000-0000-0000-00000000000a', current_date)$$, 'not_a_witness');
select pg_temp.check((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'pending witness sees the owner name');
select pg_temp.act_as('a');
select pg_temp.check((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Chloé', 'owner sees who asked');
select public.respond_witness('00000000-0000-0000-0000-00000000000c', true);
select pg_temp.act_as('c');
select pg_temp.check(public.report_smoking('00000000-0000-0000-0000-00000000000a', current_date), 'accepted witness reports');
select pg_temp.check(not public.report_smoking('00000000-0000-0000-0000-00000000000a', current_date), 'one report per witness per day');
select pg_temp.act_as('d');
select pg_temp.expect_error($$select public.report_smoking('00000000-0000-0000-0000-00000000000a', current_date)$$, 'not_a_witness');
select pg_temp.check((select count(*) from public.reports) = 0, 'stranger sees no reports');
select pg_temp.act_as('a');
select pg_temp.check((select count(*) from public.consume_reports() where witness_name = 'Chloé') = 1, 'owner gets the report');
select pg_temp.check((select count(*) from public.consume_reports()) = 0, 'a report is applied once');

-- Leaving
select public.remove_witness_link('00000000-0000-0000-0000-00000000000c');
select pg_temp.act_as('c');
select pg_temp.expect_error($$select public.report_smoking('00000000-0000-0000-0000-00000000000a', current_date + 1)$$, 'not_a_witness');
select pg_temp.act_as('b');
select public.leave_duo();
select pg_temp.check(public.my_partner() is null, 'leaving ends the duo');
select pg_temp.check((select count(*) from public.profiles) = 1, 'after leaving, alice is invisible again');

-- Anonymous (not signed in) callers can do nothing
reset role; set role anon;
select pg_temp.expect_error($$select public.ensure_profile()$$, 'permission denied for function ensure_profile');
reset role;
