// Server side of the duo and witnesses. Every write is an RPC defined in
// supabase/migrations; reads go through row level security.

import { supabase } from './supabase';

export interface Me {
  id: string;
  inviteCode: string;
}

export interface Person {
  id: string;
  name: string;
  companionName: string;
  companionSpecies: string;
  stage: number;
  health: number;
  status: 'alive' | 'dead' | 'buried';
  streak: number;
}

export interface SocialSnapshot {
  partner: Person | null;
  /** People who watch me (pending requests included). */
  witnesses: (Person & { accepted: boolean })[];
  /** People I watch (accepted only can be reported). */
  watching: (Person & { accepted: boolean; reportedToday: boolean })[];
  cheeredToday: boolean;
}

export interface PublicStats {
  displayName: string;
  companionName: string;
  companionSpecies: string;
  stage: number;
  health: number;
  status: 'alive' | 'dead' | 'buried';
  streak: number;
}

/** Error codes raised by the database functions, translated in the UI. */
export type SocialError =
  | 'unknown_code'
  | 'own_code'
  | 'already_in_duo'
  | 'not_a_witness'
  | 'too_many_witnesses'
  | 'no_duo'
  | 'invalid_day'
  | 'network';

export class SocialFailure extends Error {
  constructor(public code: SocialError) {
    super(code);
  }
}

function client() {
  if (!supabase) throw new SocialFailure('network');
  return supabase;
}

function fail(error: { message?: string } | null): never {
  const known: SocialError[] = ['unknown_code', 'own_code', 'already_in_duo', 'not_a_witness', 'too_many_witnesses', 'no_duo', 'invalid_day'];
  const code = known.find((k) => error?.message?.includes(k));
  throw new SocialFailure(code ?? 'network');
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) fail(error);
  return data as T;
}

/** Anonymous account on first launch, then the same one forever on this phone. */
export async function signIn(): Promise<Me> {
  const sb = client();
  const { data: session } = await sb.auth.getSession();
  if (!session.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) fail(error);
  }
  const profile = await rpc<{ id: string; invite_code: string }>('ensure_profile');
  return { id: profile.id, inviteCode: profile.invite_code };
}

/** Deletes the account and all its server data, then forgets the session. */
export async function deleteAccount(): Promise<void> {
  const sb = client();
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  await rpc<void>('delete_account');
  await sb.auth.signOut({ scope: 'local' });
}

export async function pushStats(me: string, s: PublicStats): Promise<void> {
  const { error } = await client()
    .from('profiles')
    .update({
      display_name: s.displayName,
      companion_name: s.companionName,
      companion_species: s.companionSpecies,
      companion_stage: s.stage,
      companion_health: Math.round(s.health),
      companion_status: s.status,
      streak: s.streak,
      updated_at: new Date().toISOString(),
    })
    .eq('id', me);
  if (error) fail(error);
}

type ProfileRow = {
  id: string;
  display_name: string;
  companion_name: string;
  companion_species: string;
  companion_stage: number;
  companion_health: number;
  companion_status: Person['status'];
  streak: number;
};

const toPerson = (p: ProfileRow): Person => ({
  id: p.id,
  name: p.display_name || '—',
  companionName: p.companion_name,
  companionSpecies: p.companion_species,
  stage: p.companion_stage,
  health: p.companion_health,
  status: p.companion_status,
  streak: p.streak,
});

export async function fetchSocial(me: string, today: string): Promise<SocialSnapshot> {
  const sb = client();
  const [members, links, cheers, reports] = await Promise.all([
    sb.from('duo_members').select('user_id'),
    sb.from('witnesses').select('owner_id, witness_id, status'),
    sb.from('cheers').select('id').eq('from_id', me).eq('day', today),
    sb.from('reports').select('owner_id').eq('witness_id', me).eq('day', today),
  ]);
  for (const r of [members, links, cheers, reports]) if (r.error) fail(r.error);

  const partnerId = (members.data ?? []).map((m) => m.user_id as string).find((id) => id !== me) ?? null;
  const linkRows = (links.data ?? []) as { owner_id: string; witness_id: string; status: string }[];
  const ids = new Set<string>(partnerId ? [partnerId] : []);
  linkRows.forEach((l) => ids.add(l.owner_id === me ? l.witness_id : l.owner_id));

  let people = new Map<string, Person>();
  if (ids.size > 0) {
    const { data, error } = await sb.from('profiles').select('*').in('id', [...ids]);
    if (error) fail(error);
    people = new Map((data as ProfileRow[]).map((p) => [p.id, toPerson(p)]));
  }
  const reported = new Set((reports.data ?? []).map((r) => r.owner_id as string));

  return {
    partner: partnerId ? people.get(partnerId) ?? null : null,
    witnesses: linkRows
      .filter((l) => l.owner_id === me && people.has(l.witness_id))
      .map((l) => ({ ...people.get(l.witness_id)!, accepted: l.status === 'accepted' })),
    watching: linkRows
      .filter((l) => l.witness_id === me && people.has(l.owner_id))
      .map((l) => ({ ...people.get(l.owner_id)!, accepted: l.status === 'accepted', reportedToday: reported.has(l.owner_id) })),
    cheeredToday: (cheers.data ?? []).length > 0,
  };
}

export const consumeReports = () =>
  rpc<{ id: string; witness_id: string; witness_name: string; day: string }[]>('consume_reports');
export const consumeCheers = () => rpc<{ id: string; from_id: string; from_name: string; day: string }[]>('consume_cheers');
export const joinDuo = (code: string) => rpc<string>('join_duo', { code });
export const leaveDuo = () => rpc<void>('leave_duo');
export const requestWitness = (code: string) => rpc<string>('request_witness', { code });
export const respondWitness = (witness: string, accept: boolean) => rpc<void>('respond_witness', { witness, accept });
export const removeWitnessLink = (other: string) => rpc<void>('remove_witness_link', { other });
export const reportSmoking = (owner: string, day: string) => rpc<boolean>('report_smoking', { owner, day });
export const sendCheer = (day: string) => rpc<boolean>('send_cheer', { day });
