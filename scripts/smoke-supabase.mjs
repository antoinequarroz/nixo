// End-to-end check of the social layer through the real Supabase API
// (anonymous sign-in, RPCs, row level security). Run against a local stack:
//   npx supabase start && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... node scripts/smoke-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY');

const today = new Date().toISOString().slice(0, 10);

async function user(name) {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInAnonymously();
  assert.ifError(error);
  const { data: profile, error: e2 } = await sb.rpc('ensure_profile');
  assert.ifError(e2);
  const { error: e3 } = await sb.from('profiles').update({ display_name: name, streak: name.length }).eq('id', profile.id);
  assert.ifError(e3);
  return { sb, id: profile.id, code: profile.invite_code, name };
}

const ok = (label) => console.log('  ok -', label);
const alice = await user('Alice');
const bob = await user('Bob');
const chloe = await user('Chloé');

let r = await alice.sb.from('profiles').select('id');
assert.equal(r.data.length, 1); ok('strangers are invisible');

r = await bob.sb.rpc('join_duo', { code: alice.code });
assert.ifError(r.error); ok('bob joins alice with her code');
r = await bob.sb.from('profiles').select('display_name, streak').eq('id', alice.id).single();
assert.equal(r.data.display_name, 'Alice'); assert.equal(r.data.streak, 5); ok('bob sees alice and her streak');

r = await chloe.sb.rpc('join_duo', { code: alice.code });
assert.match(r.error?.message ?? '', /already_in_duo/); ok('third person cannot join');

r = await bob.sb.rpc('send_cheer', { day: today });
assert.equal(r.data, true); ok('bob cheers alice');
r = await alice.sb.rpc('consume_cheers');
assert.equal(r.data[0].from_name, 'Bob'); ok('alice receives the cheer');

r = await alice.sb.rpc('register_push_token', { token: 'ExponentPushToken[smoke-alice]', locale: 'fr' });
assert.ifError(r.error); ok('alice registers her phone for pushes');
r = await alice.sb.from('push_tokens').select('*');
assert.ok(r.error || r.data.length === 0); ok('push tokens are not readable by clients');

r = await chloe.sb.rpc('request_witness', { code: alice.code });
assert.ifError(r.error);
r = await chloe.sb.rpc('report_smoking', { owner: alice.id, day: today });
assert.match(r.error?.message ?? '', /not_a_witness/); ok('pending witness cannot report');
r = await alice.sb.rpc('respond_witness', { witness: chloe.id, accept: true });
assert.ifError(r.error); ok('alice accepts chloé');
r = await chloe.sb.rpc('report_smoking', { owner: alice.id, day: today });
assert.equal(r.data, true); ok('chloé reports');
r = await chloe.sb.rpc('report_smoking', { owner: alice.id, day: today });
assert.equal(r.data, false); ok('only once a day');
r = await alice.sb.rpc('consume_reports');
assert.equal(r.data.length, 1); assert.equal(r.data[0].witness_name, 'Chloé'); ok('alice gets the report once');
r = await alice.sb.rpc('consume_reports');
assert.equal(r.data.length, 0);

r = await alice.sb.from('profiles').update({ invite_code: 'HACKED' }).eq('id', alice.id);
assert.ok(r.error); ok('invite code cannot be changed');
r = await bob.sb.from('profiles').update({ streak: 999 }).eq('id', alice.id).select();
assert.equal(r.data.length, 0); ok('nobody edits someone else');

const anon = createClient(url, key, { auth: { persistSession: false } });
r = await anon.rpc('ensure_profile');
assert.ok(r.error); ok('signed-out callers are refused');

console.log('Supabase smoke test passed.');
