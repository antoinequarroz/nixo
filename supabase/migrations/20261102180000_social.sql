-- Nixo social layer: duo (binôme), witnesses (témoins), reports, cheers.
--
-- The game itself (health, streak, evolution) stays on the phone. The server
-- only stores what other people need to see, and the actions they take on you.
-- Every write goes through a SECURITY DEFINER function below; clients get
-- read access through row level security and can update only their own stats.
-- Accounts are Supabase anonymous users (role "authenticated"), upgradable later.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  invite_code text not null unique,
  display_name text not null default '' check (char_length(display_name) <= 40),
  companion_name text not null default '' check (char_length(companion_name) <= 24),
  companion_species text not null default 'ember' check (char_length(companion_species) <= 20),
  companion_stage smallint not null default 0 check (companion_stage between 0 and 5),
  companion_health smallint not null default 80 check (companion_health between 0 and 100),
  companion_status text not null default 'alive' check (companion_status in ('alive', 'dead', 'buried')),
  streak integer not null default 0 check (streak between 0 and 100000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- duo

create table public.duos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- One row per member. The primary key makes "one duo per person" a hard rule.
create table public.duo_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  duo_id uuid not null references public.duos (id) on delete cascade
);
create index duo_members_duo_id on public.duo_members (duo_id);

-- ---------------------------------------------------------------- witnesses

-- witness_id watches owner_id. A witness asks with the owner's code;
-- the owner accepts. Only accepted witnesses can report.
create table public.witnesses (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  witness_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (owner_id, witness_id),
  check (owner_id <> witness_id)
);
create index witnesses_witness_id on public.witnesses (witness_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  witness_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  -- The game rule: at most one report per witness per day.
  unique (owner_id, witness_id, day)
);
create index reports_unconsumed on public.reports (owner_id) where consumed_at is null;

-- ---------------------------------------------------------------- cheers

create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (from_id, to_id, day)
);
create index cheers_unseen on public.cheers (to_id) where seen_at is null;

-- ---------------------------------------------------------------- helpers

create function public.partner_of(me uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m2.user_id
  from duo_members m1
  join duo_members m2 on m2.duo_id = m1.duo_id and m2.user_id <> m1.user_id
  where m1.user_id = me
  limit 1;
$$;

-- The caller's own partner (safe to expose: it only ever answers about the caller).
create function public.my_partner() returns uuid
language sql stable security definer set search_path = public as $$
  select public.partner_of(auth.uid());
$$;

-- Who may read whose profile: yourself, your duo partner, and anyone linked
-- to you as witness (both directions, pending included so a request shows a name).
create function public.can_see_profile(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or target = public.my_partner()
    or exists (
      select 1 from witnesses w
      where (w.owner_id = auth.uid() and w.witness_id = target)
         or (w.witness_id = auth.uid() and w.owner_id = target)
    );
$$;

-- A day sent by a phone must be close to today (time zones span about ±14 h).
create function public.check_day(d date) returns void
language plpgsql stable as $$
begin
  if d is null or d < (now() at time zone 'utc')::date - 1 or d > (now() at time zone 'utc')::date + 1 then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
end;
$$;

create function public.require_profile() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = me) then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;
  return me;
end;
$$;

-- ---------------------------------------------------------------- RPCs

-- Creates the caller's profile on first launch (idempotent) and returns it.
create function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  result profiles;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into result from profiles where id = me;
  if found then
    return result;
  end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into profiles (id, invite_code) values (me, code) returning * into result;
      return result;
    exception when unique_violation then
      -- Code already taken (or a concurrent call created the profile): try again.
      select * into result from profiles where id = me;
      if found then
        return result;
      end if;
    end;
  end loop;
end;
$$;

-- Sharing your code is the invitation: whoever enters it becomes your duo.
create function public.join_duo(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
  other uuid;
  new_duo uuid;
begin
  select id into other from profiles where invite_code = upper(trim(code));
  if other is null then
    raise exception 'unknown_code' using errcode = 'P0002';
  end if;
  if other = me then
    raise exception 'own_code' using errcode = '22023';
  end if;
  if exists (select 1 from duo_members where user_id in (me, other)) then
    raise exception 'already_in_duo' using errcode = '23505';
  end if;
  insert into duos default values returning id into new_duo;
  insert into duo_members (user_id, duo_id) values (me, new_duo), (other, new_duo);
  return other;
exception when unique_violation then
  raise exception 'already_in_duo' using errcode = '23505';
end;
$$;

create function public.leave_duo() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  delete from duos where id = (select duo_id from duo_members where user_id = me);
end;
$$;

-- The caller asks to become the witness of the code's owner.
create function public.request_witness(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
  owner uuid;
begin
  select id into owner from profiles where invite_code = upper(trim(code));
  if owner is null then
    raise exception 'unknown_code' using errcode = 'P0002';
  end if;
  if owner = me then
    raise exception 'own_code' using errcode = '22023';
  end if;
  if (select count(*) from witnesses where owner_id = owner) >= 20 then
    raise exception 'too_many_witnesses' using errcode = '54000';
  end if;
  insert into witnesses (owner_id, witness_id) values (owner, me) on conflict do nothing;
  return owner;
end;
$$;

-- The owner accepts or refuses a pending witness.
create function public.respond_witness(witness uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  if accept then
    update witnesses set status = 'accepted' where owner_id = me and witness_id = witness;
  else
    delete from witnesses where owner_id = me and witness_id = witness;
  end if;
end;
$$;

-- Ends a witness link from either side.
create function public.remove_witness_link(other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  delete from witnesses
  where (owner_id = me and witness_id = other) or (owner_id = other and witness_id = me);
end;
$$;

-- An accepted witness reports seeing the owner smoke. Returns false when
-- this witness already reported that day.
create function public.report_smoking(owner uuid, day date) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
  inserted int;
begin
  perform public.check_day(day);
  if not exists (select 1 from witnesses w where w.owner_id = owner and w.witness_id = me and w.status = 'accepted') then
    raise exception 'not_a_witness' using errcode = '42501';
  end if;
  insert into reports (owner_id, witness_id, day) values (owner, me, day) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

-- The owner's phone takes the reports it has not applied yet, once.
create function public.consume_reports()
returns table (id uuid, witness_id uuid, witness_name text, day date)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  return query
  with taken as (
    update reports r set consumed_at = now()
    where r.owner_id = me and r.consumed_at is null
    returning r.id, r.witness_id, r.day
  )
  select t.id, t.witness_id, p.display_name, t.day
  from taken t join profiles p on p.id = t.witness_id
  order by t.day;
end;
$$;

-- One encouragement a day to the duo partner.
create function public.send_cheer(day date) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
  partner uuid := public.partner_of(me);
  inserted int;
begin
  perform public.check_day(day);
  if partner is null then
    raise exception 'no_duo' using errcode = 'P0002';
  end if;
  insert into cheers (from_id, to_id, day) values (me, partner, day) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

create function public.consume_cheers()
returns table (id uuid, from_id uuid, from_name text, day date)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  return query
  with taken as (
    update cheers c set seen_at = now()
    where c.to_id = me and c.seen_at is null
    returning c.id, c.from_id, c.day
  )
  select t.id, t.from_id, p.display_name, t.day
  from taken t join profiles p on p.id = t.from_id
  order by t.day;
end;
$$;

-- ---------------------------------------------------------------- access

alter table public.profiles enable row level security;
alter table public.duos enable row level security;
alter table public.duo_members enable row level security;
alter table public.witnesses enable row level security;
alter table public.reports enable row level security;
alter table public.cheers enable row level security;

revoke all on public.profiles, public.duos, public.duo_members, public.witnesses, public.reports, public.cheers from anon, authenticated;

grant select on public.profiles to authenticated;
-- Clients may only refresh their public stats and name, never their code or id.
grant update (display_name, companion_name, companion_species, companion_stage, companion_health, companion_status, streak, updated_at)
  on public.profiles to authenticated;
grant select on public.duo_members, public.witnesses, public.reports, public.cheers to authenticated;

create policy "profiles: visible to linked people" on public.profiles
  for select to authenticated using (public.can_see_profile(id));
create policy "profiles: owner updates own stats" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "duo_members: own duo" on public.duo_members
  for select to authenticated using (user_id = auth.uid() or user_id = public.my_partner());

create policy "witnesses: either side" on public.witnesses
  for select to authenticated using (owner_id = auth.uid() or witness_id = auth.uid());

create policy "reports: either side" on public.reports
  for select to authenticated using (owner_id = auth.uid() or witness_id = auth.uid());

create policy "cheers: either side" on public.cheers
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- Functions run with the owner's rights: only signed-in users may call the RPCs,
-- and the internal helpers are not exposed at all.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.ensure_profile(),
  public.join_duo(text),
  public.leave_duo(),
  public.request_witness(text),
  public.respond_witness(uuid, boolean),
  public.remove_witness_link(uuid),
  public.report_smoking(uuid, date),
  public.consume_reports(),
  public.send_cheer(date),
  public.consume_cheers()
to authenticated;
-- Used inside RLS policies, so the authenticated role must be able to call them.
grant execute on function public.can_see_profile(uuid), public.my_partner() to authenticated;
