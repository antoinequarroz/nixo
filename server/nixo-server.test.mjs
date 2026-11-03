// Rules of the local test server. Mirrors supabase/sql-tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createNixoServer } from './nixo-server.mjs';

const NOW = Date.UTC(2026, 10, 3, 12);
const TODAY = '2026-11-03';

function setup() {
  const pushes = [];
  const app = createNixoServer({ now: () => NOW, sendPush: (m) => pushes.push(...m) });
  const user = (name) => {
    const { token } = app.signInAnonymously();
    const me = app.call(token, 'ensure_profile');
    app.call(token, 'update_stats', { display_name: name, companion_name: `${name}'s pet`, streak: name.length });
    const call = (fn, args) => app.call(token, fn, args);
    return { token, id: me.id, code: me.invite_code, call };
  };
  return { app, user, pushes };
}

const refused = (fn, code) => assert.throws(fn, (e) => e.code === code);

test('profiles: one per account, stable invite code', () => {
  const { user } = setup();
  const a = user('Alice');
  assert.match(a.code, /^[A-Z2-9]{6}$/);
  assert.equal(a.call('ensure_profile').invite_code, a.code);
});

test('calls need a valid session', () => {
  const { app } = setup();
  refused(() => app.call('nope', 'ensure_profile'), 'not_authenticated');
  refused(() => app.call(undefined, 'ensure_profile'), 'not_authenticated');
});

test('stats are clamped and only touch your own profile', () => {
  const { user } = setup();
  const a = user('Alice');
  a.call('update_stats', { display_name: 'x'.repeat(100), companion_health: 400, companion_status: 'hacked', streak: -3 });
  const p = a.call('ensure_profile');
  assert.equal(p.display_name.length, 40);
  assert.equal(p.companion_health, 100);
  assert.equal(p.companion_status, 'alive');
  assert.equal(p.streak, 0);
});

test('duo: join with a code, one duo each, leave ends it', () => {
  const { user } = setup();
  const [a, b, c] = [user('Alice'), user('Bob'), user('Chloé')];
  assert.equal(a.call('social_snapshot', { today: TODAY }).partner, null);
  refused(() => b.call('join_duo', { code: 'ZZZZZZ' }), 'unknown_code');
  refused(() => b.call('join_duo', { code: b.code }), 'own_code');
  assert.equal(b.call('join_duo', { code: a.code.toLowerCase() + ' ' }), a.id);
  assert.equal(a.call('social_snapshot', { today: TODAY }).partner.name, 'Bob');
  assert.equal(b.call('social_snapshot', { today: TODAY }).partner.streak, 5);
  refused(() => c.call('join_duo', { code: a.code }), 'already_in_duo');
  a.call('leave_duo');
  assert.equal(b.call('social_snapshot', { today: TODAY }).partner, null);
});

test('cheers: once a day to the partner, received once, with a push', () => {
  const { user, pushes } = setup();
  const [a, b] = [user('Alice'), user('Bob')];
  refused(() => a.call('send_cheer', { day: TODAY }), 'no_duo');
  b.call('join_duo', { code: a.code });
  a.call('register_push_token', { token: 'ExponentPushToken[a]', locale: 'en' });
  refused(() => b.call('send_cheer', { day: '2020-01-01' }), 'invalid_day');
  assert.equal(b.call('send_cheer', { day: TODAY }), true);
  assert.equal(b.call('send_cheer', { day: TODAY }), false);
  assert.equal(b.call('social_snapshot', { today: TODAY }).cheeredToday, true);
  assert.deepEqual(a.call('consume_cheers').map((c) => c.from_name), ['Bob']);
  assert.equal(a.call('consume_cheers').length, 0);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].to, 'ExponentPushToken[a]');
  assert.equal(pushes[0].body, 'Bob is sending you strength.');
  assert.equal(pushes[0].data.kind, 'cheer');
});

test('witnesses: request, accept, report once a day, delivered once', () => {
  const { user, pushes } = setup();
  const [a, w, s] = [user('Alice'), user('Will'), user('Stranger')];
  a.call('register_push_token', { token: 'ExponentPushToken[a]', locale: 'fr' });
  assert.equal(w.call('request_witness', { code: a.code }), a.id);
  const pending = a.call('social_snapshot', { today: TODAY }).witnesses;
  assert.deepEqual(pending.map((x) => [x.name, x.accepted]), [['Will', false]]);
  refused(() => w.call('report_smoking', { owner: a.id, day: TODAY }), 'not_a_witness');
  refused(() => s.call('report_smoking', { owner: a.id, day: TODAY }), 'not_a_witness');
  a.call('respond_witness', { witness: w.id, accept: true });
  assert.equal(w.call('report_smoking', { owner: a.id, day: TODAY }), true);
  assert.equal(w.call('report_smoking', { owner: a.id, day: TODAY }), false);
  assert.equal(w.call('social_snapshot', { today: TODAY }).watching[0].reportedToday, true);
  const reports = a.call('consume_reports');
  assert.deepEqual(reports.map((r) => [r.witness_name, r.day]), [['Will', TODAY]]);
  assert.equal(a.call('consume_reports').length, 0);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].body, 'Will t’a vu fumer. Alice\'s pet perd 15 %.');
  // Either side can end the link.
  w.call('remove_witness_link', { other: a.id });
  assert.equal(a.call('social_snapshot', { today: TODAY }).witnesses.length, 0);
});

test('witnesses: declining removes the request, at most 20', () => {
  const { user } = setup();
  const a = user('Alice');
  const w = user('Will');
  w.call('request_witness', { code: a.code });
  a.call('respond_witness', { witness: w.id, accept: false });
  assert.equal(a.call('social_snapshot', { today: TODAY }).witnesses.length, 0);
  for (let i = 0; i < 20; i++) user(`W${i}`).call('request_witness', { code: a.code });
  refused(() => w.call('request_witness', { code: a.code }), 'too_many_witnesses');
});

test('push tokens must be Expo tokens', () => {
  const { user } = setup();
  refused(() => user('Alice').call('register_push_token', { token: 'nope' }), 'invalid_token');
});

test('deleting an account removes every trace and ends the duo', () => {
  const { app, user } = setup();
  const [a, b] = [user('Alice'), user('Bob')];
  b.call('join_duo', { code: a.code });
  b.call('request_witness', { code: a.code });
  a.call('respond_witness', { witness: b.id, accept: true });
  b.call('report_smoking', { owner: a.id, day: TODAY });
  b.call('send_cheer', { day: TODAY });
  a.call('register_push_token', { token: 'ExponentPushToken[a]' });
  a.call('delete_account');
  for (const table of ['profiles', 'duo_members', 'witnesses', 'reports', 'cheers', 'push_tokens', 'sessions']) {
    const rows = app.db.prepare(`select * from ${table}`).all();
    assert.ok(!JSON.stringify(rows).includes(a.id), `${table} still mentions the deleted account`);
  }
  assert.equal(b.call('social_snapshot', { today: TODAY }).partner, null);
  refused(() => a.call('ensure_profile'), 'not_authenticated');
});

test('HTTP: sign in, call, errors as codes', async () => {
  const { createServer } = await import('node:http');
  const app = createNixoServer({ now: () => NOW, sendPush: () => {} });
  const server = createServer(app.handle).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    }).then(async (r) => ({ status: r.status, json: await r.json() }));
  try {
    const { json: session } = await post('/auth/anonymous');
    const profile = await post('/rpc/ensure_profile', {}, session.token);
    assert.equal(profile.status, 200);
    assert.equal(profile.json.data.id, session.user_id);
    const bad = await post('/rpc/join_duo', { code: 'ZZZZZZ' }, session.token);
    assert.deepEqual([bad.status, bad.json.error], [400, 'unknown_code']);
    assert.equal((await post('/rpc/ensure_profile', {})).status, 401);
    assert.equal((await post('/rpc/constructor', {}, session.token)).status, 404);
  } finally {
    server.close();
  }
});
