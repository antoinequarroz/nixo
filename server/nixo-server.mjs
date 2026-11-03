// Local test server for the duo and witnesses, backed by a SQLite file.
// Same rules as supabase/migrations, so the app behaves the same before the
// real Supabase project exists. Not meant for production.
//
//   npm run server            → http://<your computer>:8787, data in server/nixo.db
//
// Needs Node 22.13 or newer (built-in node:sqlite).

import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SCHEMA = `
pragma foreign_keys = on;
create table if not exists sessions (
  token text primary key,
  user_id text not null,
  created_at text not null default current_timestamp
);
create table if not exists profiles (
  id text primary key,
  invite_code text not null unique,
  display_name text not null default '',
  companion_name text not null default '',
  companion_species text not null default 'ember',
  companion_stage integer not null default 0,
  companion_health integer not null default 80,
  companion_status text not null default 'alive',
  streak integer not null default 0,
  updated_at text not null default current_timestamp
);
create table if not exists duo_members (
  user_id text primary key references profiles (id) on delete cascade,
  duo_id text not null
);
create table if not exists witnesses (
  owner_id text not null references profiles (id) on delete cascade,
  witness_id text not null references profiles (id) on delete cascade,
  status text not null default 'pending',
  primary key (owner_id, witness_id)
);
create table if not exists reports (
  id text primary key,
  owner_id text not null references profiles (id) on delete cascade,
  witness_id text not null references profiles (id) on delete cascade,
  day text not null,
  consumed integer not null default 0,
  unique (owner_id, witness_id, day)
);
create table if not exists cheers (
  id text primary key,
  from_id text not null references profiles (id) on delete cascade,
  to_id text not null references profiles (id) on delete cascade,
  day text not null,
  seen integer not null default 0,
  unique (from_id, to_id, day)
);
create table if not exists push_tokens (
  token text primary key,
  user_id text not null references profiles (id) on delete cascade,
  locale text not null default 'fr'
);
`;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_WITNESSES = 20;
const STATUSES = ['alive', 'dead', 'buried'];

class Refusal extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const text = (v, max) => String(v ?? '').slice(0, max);

/** A day sent by a phone must be close to today (time zones span about ±14 h). */
function checkDay(day, now) {
  const today = new Date(now);
  const keys = [-1, 0, 1].map((d) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + d)).toISOString().slice(0, 10));
  if (typeof day !== 'string' || !keys.includes(day)) throw new Refusal('invalid_day');
}

/**
 * @param {{ file?: string, now?: () => number, sendPush?: (messages: object[]) => void }} options
 */
export function createNixoServer({ file = ':memory:', now = Date.now, sendPush = sendExpoPush } = {}) {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const q = (sql) => db.prepare(sql);

  const tx = (fn) => {
    db.exec('begin');
    try {
      const out = fn();
      db.exec('commit');
      return out;
    } catch (e) {
      db.exec('rollback');
      throw e;
    }
  };

  const profile = (id) => q('select * from profiles where id = ?').get(id);
  const byCode = (code) => q('select id from profiles where invite_code = ?').get(String(code ?? '').trim().toUpperCase())?.id;
  const partnerOf = (me) =>
    q('select m2.user_id id from duo_members m1 join duo_members m2 on m2.duo_id = m1.duo_id and m2.user_id <> m1.user_id where m1.user_id = ?').get(me)?.id ?? null;

  function pushTo(target, bodyFr, bodyEn, kind) {
    const messages = q('select token, locale from push_tokens where user_id = ?')
      .all(target)
      .map((t) => ({ to: t.token, title: 'Nixo', body: t.locale === 'en' ? bodyEn : bodyFr, sound: 'default', data: { kind } }));
    if (messages.length > 0) sendPush(messages);
  }

  function requireProfile(me) {
    if (!profile(me)) throw new Refusal('no_profile');
    return me;
  }

  const rpcs = {
    ensure_profile(me) {
      const existing = profile(me);
      if (existing) return existing;
      for (;;) {
        const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
        if (byCode(code)) continue;
        q('insert into profiles (id, invite_code) values (?, ?)').run(me, code);
        return profile(me);
      }
    },

    update_stats(me, s) {
      requireProfile(me);
      q(`update profiles set display_name = ?, companion_name = ?, companion_species = ?, companion_stage = ?,
           companion_health = ?, companion_status = ?, streak = ?, updated_at = current_timestamp where id = ?`).run(
        text(s.display_name, 40),
        text(s.companion_name, 24),
        text(s.companion_species, 20) || 'ember',
        clampInt(s.companion_stage, 0, 5),
        clampInt(s.companion_health, 0, 100),
        STATUSES.includes(s.companion_status) ? s.companion_status : 'alive',
        clampInt(s.streak, 0, 100000),
        me,
      );
    },

    /** Everything the Duo screen shows, in one call. */
    social_snapshot(me, { today }) {
      requireProfile(me);
      const person = (id) => {
        const p = profile(id);
        return p && {
          id: p.id,
          name: p.display_name || '—',
          companionName: p.companion_name,
          companionSpecies: p.companion_species,
          stage: p.companion_stage,
          health: p.companion_health,
          status: p.companion_status,
          streak: p.streak,
        };
      };
      const partner = partnerOf(me);
      return {
        partner: partner ? person(partner) : null,
        witnesses: q('select witness_id id, status from witnesses where owner_id = ? order by rowid')
          .all(me)
          .map((w) => ({ ...person(w.id), accepted: w.status === 'accepted' })),
        watching: q('select owner_id id, status from witnesses where witness_id = ? order by rowid')
          .all(me)
          .map((w) => ({
            ...person(w.id),
            accepted: w.status === 'accepted',
            reportedToday: !!q('select 1 from reports where owner_id = ? and witness_id = ? and day = ?').get(w.id, me, today),
          })),
        cheeredToday: !!q('select 1 from cheers where from_id = ? and day = ?').get(me, today),
      };
    },

    join_duo(me, { code }) {
      requireProfile(me);
      const other = byCode(code);
      if (!other) throw new Refusal('unknown_code');
      if (other === me) throw new Refusal('own_code');
      return tx(() => {
        if (q('select 1 from duo_members where user_id in (?, ?)').get(me, other)) throw new Refusal('already_in_duo');
        const duo = randomUUID();
        q('insert into duo_members (user_id, duo_id) values (?, ?), (?, ?)').run(me, duo, other, duo);
        return other;
      });
    },

    leave_duo(me) {
      requireProfile(me);
      q('delete from duo_members where duo_id = (select duo_id from duo_members where user_id = ?)').run(me);
    },

    request_witness(me, { code }) {
      requireProfile(me);
      const owner = byCode(code);
      if (!owner) throw new Refusal('unknown_code');
      if (owner === me) throw new Refusal('own_code');
      if (q('select count(*) n from witnesses where owner_id = ?').get(owner).n >= MAX_WITNESSES) throw new Refusal('too_many_witnesses');
      q('insert or ignore into witnesses (owner_id, witness_id) values (?, ?)').run(owner, me);
      return owner;
    },

    respond_witness(me, { witness, accept }) {
      requireProfile(me);
      if (accept) q("update witnesses set status = 'accepted' where owner_id = ? and witness_id = ?").run(me, witness);
      else q('delete from witnesses where owner_id = ? and witness_id = ?').run(me, witness);
    },

    remove_witness_link(me, { other }) {
      requireProfile(me);
      q('delete from witnesses where (owner_id = ? and witness_id = ?) or (owner_id = ? and witness_id = ?)').run(me, other, other, me);
    },

    report_smoking(me, { owner, day }) {
      requireProfile(me);
      checkDay(day, now());
      if (!q("select 1 from witnesses where owner_id = ? and witness_id = ? and status = 'accepted'").get(owner, me)) {
        throw new Refusal('not_a_witness');
      }
      const { changes } = q('insert or ignore into reports (id, owner_id, witness_id, day) values (?, ?, ?, ?)').run(randomUUID(), owner, me, day);
      if (changes === 1) {
        const witness = profile(me).display_name || 'Un témoin';
        const companion = profile(owner).companion_name || 'Ton compagnon';
        pushTo(owner, `${witness} t’a vu fumer. ${companion} perd 15 %.`, `${witness} saw you smoke. ${companion} loses 15%.`, 'report');
      }
      return changes === 1;
    },

    consume_reports(me) {
      requireProfile(me);
      return tx(() => {
        const rows = q(`select r.id, r.witness_id, p.display_name witness_name, r.day from reports r
                        join profiles p on p.id = r.witness_id where r.owner_id = ? and r.consumed = 0 order by r.day`).all(me);
        q('update reports set consumed = 1 where owner_id = ? and consumed = 0').run(me);
        return rows;
      });
    },

    send_cheer(me, { day }) {
      requireProfile(me);
      checkDay(day, now());
      const partner = partnerOf(me);
      if (!partner) throw new Refusal('no_duo');
      const { changes } = q('insert or ignore into cheers (id, from_id, to_id, day) values (?, ?, ?, ?)').run(randomUUID(), me, partner, day);
      if (changes === 1) {
        const sender = profile(me).display_name || 'Ton binôme';
        pushTo(partner, `${sender} t’envoie du courage.`, `${sender} is sending you strength.`, 'cheer');
      }
      return changes === 1;
    },

    consume_cheers(me) {
      requireProfile(me);
      return tx(() => {
        const rows = q(`select c.id, c.from_id, p.display_name from_name, c.day from cheers c
                        join profiles p on p.id = c.from_id where c.to_id = ? and c.seen = 0 order by c.day`).all(me);
        q('update cheers set seen = 1 where to_id = ? and seen = 0').run(me);
        return rows;
      });
    },

    register_push_token(me, { token, locale }) {
      requireProfile(me);
      if (typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) throw new Refusal('invalid_token');
      q('insert into push_tokens (token, user_id, locale) values (?, ?, ?) on conflict (token) do update set user_id = excluded.user_id, locale = excluded.locale').run(
        token,
        me,
        locale === 'en' ? 'en' : 'fr',
      );
    },

    delete_account(me) {
      tx(() => {
        q('delete from duo_members where duo_id = (select duo_id from duo_members where user_id = ?)').run(me);
        q('delete from profiles where id = ?').run(me);
        q('delete from sessions where user_id = ?').run(me);
      });
    },
  };

  function signInAnonymously() {
    const token = randomBytes(32).toString('hex');
    const userId = randomUUID();
    q('insert into sessions (token, user_id) values (?, ?)').run(token, userId);
    return { token, user_id: userId };
  }

  /** Runs one call as the owner of `token`. Throws a Refusal on errors. */
  function call(token, name, args = {}) {
    const me = token && q('select user_id from sessions where token = ?').get(token)?.user_id;
    if (!me) throw new Refusal('not_authenticated', 401);
    const fn = Object.hasOwn(rpcs, name) ? rpcs[name] : null;
    if (!fn) throw new Refusal('unknown_function', 404);
    return fn(me, args ?? {}) ?? null;
  }

  async function handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    if (req.method === 'GET' && req.url === '/') return send(200, { ok: true, name: 'nixo-local-server' });
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 64_000) throw new Refusal('too_large', 413);
      }
      const body = raw ? JSON.parse(raw) : {};
      if (req.url === '/auth/anonymous') return send(200, signInAnonymously());
      const match = /^\/rpc\/([a-z_]+)$/.exec(req.url ?? '');
      if (!match) return send(404, { error: 'not_found' });
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      return send(200, { data: call(token, match[1], body) });
    } catch (e) {
      if (e instanceof Refusal) return send(e.status, { error: e.code });
      if (e instanceof SyntaxError) return send(400, { error: 'bad_json' });
      console.error(e);
      return send(500, { error: 'server_error' });
    }
  }

  return { db, call, signInAnonymously, handle, close: () => db.close() };
}

function sendExpoPush(messages) {
  fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  }).catch((e) => console.warn('push failed:', e.message));
}

// ---------------------------------------------------------------- main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const file = process.env.NIXO_DB ?? fileURLToPath(new URL('./nixo.db', import.meta.url));
  const app = createNixoServer({ file });
  createServer(app.handle).listen(port, '0.0.0.0', () => {
    const ips = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    console.log(`Nixo test server, data in ${file}`);
    console.log(`  this computer: http://localhost:${port}`);
    for (const ip of ips) console.log(`  phones on the same Wi-Fi: http://${ip}:${port}`);
  });
}
