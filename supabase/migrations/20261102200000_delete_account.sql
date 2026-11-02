-- Account deletion, required by the App Store for apps that create accounts.
-- Deleting the auth user cascades to the profile and everything linked to it
-- (duo membership, witness links, reports, cheers, push tokens).

create function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- A duo cannot outlive one of its two members.
  delete from duos where id = (select duo_id from duo_members where user_id = me);
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
