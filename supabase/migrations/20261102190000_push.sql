-- Push notifications: when a witness reports you or your duo cheers you,
-- your phones get a notification right away through the Expo push service.
-- Sending happens in the database (pg_net), so no extra server is needed.

create extension if not exists pg_net;

create table public.push_tokens (
  token text primary key check (token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_id on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- A phone registers (or moves) its token to the signed-in account.
create function public.register_push_token(token text, locale text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_profile();
begin
  insert into push_tokens (token, user_id, locale, updated_at)
  values (token, me, case when locale = 'en' then 'en' else 'fr' end, now())
  on conflict on constraint push_tokens_pkey do update set user_id = excluded.user_id, locale = excluded.locale, updated_at = now();
end;
$$;

create function public.unregister_push_token(token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from push_tokens where push_tokens.token = unregister_push_token.token and user_id = auth.uid();
end;
$$;

-- Sends one message to every phone of a user, in each phone's language.
create function public.push_to_user(target uuid, title text, body_fr text, body_en text, kind text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', title,
           'body', case when t.locale = 'en' then body_en else body_fr end,
           'sound', 'default',
           'data', jsonb_build_object('kind', kind)))
    into messages
  from push_tokens t
  where t.user_id = target;

  if messages is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end;
$$;

create function public.notify_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  witness text;
  companion text;
begin
  select coalesce(nullif(display_name, ''), 'Un témoin') into witness from profiles where id = new.witness_id;
  select coalesce(nullif(companion_name, ''), 'Ton compagnon') into companion from profiles where id = new.owner_id;
  perform public.push_to_user(
    new.owner_id,
    'Nixo',
    witness || ' t’a vu fumer. ' || companion || ' perd 15 %.',
    witness || ' saw you smoke. ' || companion || ' loses 15%.',
    'report'
  );
  return new;
end;
$$;

create function public.notify_cheer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sender text;
begin
  select coalesce(nullif(display_name, ''), 'Ton binôme') into sender from profiles where id = new.from_id;
  perform public.push_to_user(
    new.to_id,
    'Nixo',
    sender || ' t’envoie du courage.',
    sender || ' is sending you strength.',
    'cheer'
  );
  return new;
end;
$$;

create trigger reports_notify after insert on public.reports
  for each row execute function public.notify_report();
create trigger cheers_notify after insert on public.cheers
  for each row execute function public.notify_cheer();

revoke execute on function public.push_to_user(uuid, text, text, text, text), public.notify_report(), public.notify_cheer()
  from public, anon, authenticated;
revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;
