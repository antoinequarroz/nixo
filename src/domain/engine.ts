// The game engine: pure functions (state, now) -> new state.
// The UI never changes health or streaks itself; it calls these.

import { addDays, dayKey, diffDays, validationDeadline, type DayKey } from './dates';
import { RULES, stageIndex } from './rules';
import { SPECIES } from './species';
import type { Companion, DayResult, GameEvent, GameState, Goal, Profile } from './types';

const HOUR = 3_600_000;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function createInitialState(): GameState {
  return {
    version: 1,
    profile: null,
    companions: [],
    activeId: null,
    journal: {},
    settledThrough: null,
    freezes: 0,
    goal: null,
    witnesses: [],
    partner: null,
    inviteCode: makeInviteCode(),
    ownedSpecies: ['ember'],
    morningMessages: true,
    displayName: '',
    appliedReports: [],
    events: [],
    clockOffsetMs: 0,
  };
}

/** Fills fields added after a state was saved by an older version of the app. */
export function migrateState(saved: Partial<GameState>): GameState {
  return { ...createInitialState(), ...saved, version: 1 };
}

export function newCompanion(name: string, speciesId: string, today: DayKey): Companion {
  return {
    id: makeId(),
    name: name.trim(),
    speciesId,
    bornDay: today,
    health: 80,
    cleanDays: 0,
    status: 'alive',
    reviveProgress: 0,
  };
}

export interface StartInput {
  profile: Omit<Profile, 'startDay'>;
  companionName: string;
  speciesId: string;
  goal: Goal | null;
}

export function startJourney(state: GameState, input: StartInput, now: number): GameState {
  const today = dayKey(now);
  const companion = newCompanion(input.companionName, input.speciesId, today);
  return {
    ...state,
    profile: { ...input.profile, startDay: today },
    companions: [companion],
    activeId: companion.id,
    goal: input.goal,
    settledThrough: addDays(today, -1),
  };
}

// ---------- health ----------

function changeHealth(c: Companion, delta: number, now: number, events: GameEvent[]): Companion {
  if (c.status !== 'alive') return c;
  const health = Math.max(0, Math.min(RULES.maxHealth, c.health + delta));
  if (health <= 0) {
    events.push({ kind: 'died', companionId: c.id, at: now });
    return { ...c, health: 0, status: 'dead', diedAt: now, reviveProgress: 0 };
  }
  if (c.health >= RULES.lowHealth && health < RULES.lowHealth) {
    events.push({ kind: 'lowHealth', companionId: c.id, at: now });
  }
  return { ...c, health };
}

function revive(c: Companion, now: number, events: GameEvent[]): Companion {
  events.push({ kind: 'revived', companionId: c.id, at: now });
  return { ...c, status: 'alive', health: RULES.reviveHealth, diedAt: undefined, reviveProgress: 0 };
}

/**
 * End of the revival window: 72 h after death, stretched if needed until the
 * validation deadline of the 3rd day after death, so the free path (3 clean
 * days in a row) is always reachable.
 */
export function reviveDeadline(c: Companion): number | null {
  if (c.status !== 'dead' || c.diedAt == null) return null;
  const freePath = validationDeadline(addDays(dayKey(c.diedAt), RULES.reviveCleanDays), RULES.graceHour);
  return Math.max(c.diedAt + RULES.reviveWindowHours * HOUR, freePath);
}

export function canOfferPaidRevive(c: Companion, now: number): boolean {
  const deadline = reviveDeadline(c);
  if (deadline == null || now >= deadline) return false;
  return now - (c.diedAt ?? now) >= RULES.paidReviveCooldownHours * HOUR;
}

/** Applies a day's result to every companion. */
function applyDay(state: GameState, result: DayResult, now: number, events: GameEvent[]): Companion[] {
  return state.companions.map((c) => {
    if (c.status === 'buried') return c;
    if (c.status === 'dead') {
      if (result === 'clean') {
        const progress = c.reviveProgress + 1;
        return progress >= RULES.reviveCleanDays ? revive(c, now, events) : { ...c, reviveProgress: progress };
      }
      if (result === 'frozen') return c;
      return { ...c, reviveProgress: 0 };
    }
    switch (result) {
      case 'clean': {
        const before = stageIndex(c.cleanDays);
        const next = changeHealth({ ...c, cleanDays: c.cleanDays + 1 }, RULES.cleanDayHealth, now, events);
        if (stageIndex(next.cleanDays) > before) events.push({ kind: 'evolved', companionId: c.id, at: now });
        return next;
      }
      case 'relapse':
        return changeHealth(c, RULES.relapseHealth, now, events);
      case 'missed':
        return changeHealth(c, RULES.missedDayHealth, now, events);
      case 'frozen':
        return c;
    }
  });
}

// ---------- the day ----------

/** The day the main button validates right now, or null when there is nothing to validate. */
export function pendingDay(state: GameState, now: number): DayKey | null {
  if (!state.profile) return null;
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  if (
    diffDays(state.profile.startDay, yesterday) >= 0 &&
    !state.journal[yesterday] &&
    now < validationDeadline(yesterday, RULES.graceHour)
  ) {
    return yesterday;
  }
  return state.journal[today] ? null : today;
}

/**
 * Settles the past: every day whose deadline has passed without validation
 * becomes "missed" (or "frozen" if a freeze is left), and companions dead for
 * more than 72 h are buried. Call it on launch, on resume and before any action.
 */
export function settle(state: GameState, now: number): GameState {
  if (!state.profile) return state;
  const events: GameEvent[] = [];
  let s = state;
  let day = s.settledThrough ? addDays(s.settledThrough, 1) : s.profile!.startDay;

  while (validationDeadline(day, RULES.graceHour) <= now) {
    if (!s.journal[day]) {
      const result: DayResult = s.freezes > 0 ? 'frozen' : 'missed';
      if (result === 'frozen') events.push({ kind: 'frozen', at: now });
      s = {
        ...s,
        freezes: result === 'frozen' ? s.freezes - 1 : s.freezes,
        journal: { ...s.journal, [day]: result },
        companions: applyDay(s, result, now, events),
      };
    }
    s = { ...s, settledThrough: day };
    day = addDays(day, 1);
  }

  const companions = s.companions.map((c) => {
    const deadline = reviveDeadline(c);
    if (deadline != null && now >= deadline) {
      events.push({ kind: 'buried', companionId: c.id, at: now });
      return { ...c, status: 'buried' as const, buriedDay: dayKey(now) };
    }
    return c;
  });

  if (events.length === 0 && s === state) return state;
  return { ...s, companions, events: [...s.events, ...events] };
}

export function validateDay(state: GameState, now: number, result: 'clean' | 'relapse'): GameState {
  const s = settle(state, now);
  const day = pendingDay(s, now);
  if (!day) return s;
  const events: GameEvent[] = [];
  const savedBefore = savings(s, now).saved;
  const next: GameState = {
    ...s,
    journal: { ...s.journal, [day]: result },
    companions: applyDay(s, result, now, events),
  };
  if (next.goal && savedBefore < next.goal.price && savings(next, now).saved >= next.goal.price) {
    events.push({ kind: 'goalReached', at: now });
  }
  return { ...next, events: [...next.events, ...events] };
}

export function witnessReport(state: GameState, now: number, witnessId: string): GameState {
  const s = settle(state, now);
  const today = dayKey(now);
  const witness = s.witnesses.find((w) => w.id === witnessId);
  if (!witness || witness.lastReportDay === today) return s;
  const events: GameEvent[] = [];
  return {
    ...s,
    witnesses: s.witnesses.map((w) => (w.id === witnessId ? { ...w, lastReportDay: today } : w)),
    companions: s.companions.map((c) => changeHealth(c, RULES.witnessReportHealth, now, events)),
    events: [...s.events, ...events],
  };
}

// ---------- companions ----------

export function revivePaid(state: GameState, now: number, companionId: string): GameState {
  const events: GameEvent[] = [];
  const companions = state.companions.map((c) => {
    if (c.id !== companionId) return c;
    const deadline = reviveDeadline(c);
    return deadline != null && now < deadline ? revive(c, now, events) : c;
  });
  return { ...state, companions, events: [...state.events, ...events] };
}

export function adopt(state: GameState, now: number, name: string, speciesId: string): GameState {
  if (!name.trim() || !state.ownedSpecies.includes(speciesId)) return state;
  const c = newCompanion(name, speciesId, dayKey(now));
  return { ...state, companions: [...state.companions, c], activeId: c.id };
}

export function activeCompanion(state: GameState): Companion | null {
  return state.companions.find((c) => c.id === state.activeId) ?? state.companions[0] ?? null;
}

export function unlockSpecies(state: GameState, speciesId: string): GameState {
  if (state.ownedSpecies.includes(speciesId) || !SPECIES.some((s) => s.id === speciesId)) return state;
  return { ...state, ownedSpecies: [...state.ownedSpecies, speciesId] };
}

// ---------- streak & savings ----------

/** Smoke-free days in a row. A frozen day keeps the series without adding to it. */
export function streak(state: GameState, now: number): number {
  if (!state.profile) return 0;
  let day = dayKey(now);
  if (!state.journal[day]) day = addDays(day, -1);
  if (!state.journal[day] && pendingDay(state, now) === day) day = addDays(day, -1);
  let count = 0;
  while (diffDays(state.profile.startDay, day) >= 0) {
    const r = state.journal[day];
    if (r === 'clean') count++;
    else if (r !== 'frozen') break;
    day = addDays(day, -1);
  }
  return count;
}

export interface Savings {
  cleanDays: number;
  perDay: number;
  saved: number;
  cigarettesAvoided: number;
  minutesRegained: number;
  goalProgress: number | null;
  goalEta: DayKey | null;
  /** Cumulative savings per day since the start. */
  series: { day: DayKey; total: number }[];
}

export function savings(state: GameState, now: number): Savings {
  const p = state.profile;
  const empty: Savings = {
    cleanDays: 0, perDay: 0, saved: 0, cigarettesAvoided: 0, minutesRegained: 0,
    goalProgress: null, goalEta: null, series: [],
  };
  if (!p) return empty;
  const perDay = (p.cigsPerDay * p.packPrice) / Math.max(1, p.cigsPerPack);
  const today = dayKey(now);
  const series: Savings['series'] = [];
  let clean = 0;
  for (let d = p.startDay; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    if (state.journal[d] === 'clean') clean++;
    series.push({ day: d, total: clean * perDay });
  }
  const saved = clean * perDay;
  const cigarettesAvoided = clean * p.cigsPerDay;
  let goalProgress: number | null = null;
  let goalEta: DayKey | null = null;
  if (state.goal && state.goal.price > 0) {
    goalProgress = Math.min(1, saved / state.goal.price);
    const remaining = state.goal.price - saved;
    goalEta = remaining <= 0 ? today : perDay > 0 ? addDays(today, Math.ceil(remaining / perDay)) : null;
  }
  return {
    cleanDays: clean,
    perDay,
    saved,
    cigarettesAvoided,
    minutesRegained: cigarettesAvoided * RULES.minutesPerCigarette,
    goalProgress,
    goalEta,
    series,
  };
}

// ---------- settings, goal, duo ----------

export function setGoal(state: GameState, goal: Goal | null): GameState {
  return { ...state, goal };
}

export function updateProfile(state: GameState, patch: Partial<Omit<Profile, 'startDay'>>): GameState {
  return state.profile ? { ...state, profile: { ...state.profile, ...patch } } : state;
}

export function setActive(state: GameState, companionId: string): GameState {
  return state.companions.some((c) => c.id === companionId) ? { ...state, activeId: companionId } : state;
}

export function addFreezes(state: GameState, n: number): GameState {
  return { ...state, freezes: state.freezes + n };
}

export function addWitness(state: GameState, name: string): GameState {
  if (!name.trim()) return state;
  return { ...state, witnesses: [...state.witnesses, { id: makeId(), name: name.trim() }] };
}

export function removeWitness(state: GameState, id: string): GameState {
  return { ...state, witnesses: state.witnesses.filter((w) => w.id !== id) };
}

/** Prototype: the partner is simulated with a plausible streak. */
export function linkPartner(state: GameState, name: string): GameState {
  if (!name.trim()) return state;
  return { ...state, partner: { name: name.trim(), streak: 2 + Math.floor(Math.random() * 20) } };
}

export function unlinkPartner(state: GameState): GameState {
  return { ...state, partner: null };
}

export function cheerPartner(state: GameState, now: number): GameState {
  return state.partner ? { ...state, partner: { ...state.partner, lastCheerDay: dayKey(now) } } : state;
}

/** Prototype lab: move the app clock forward, then settle what that skipped. */
export function advanceClock(state: GameState, ms: number, realNow: number): GameState {
  const next = { ...state, clockOffsetMs: state.clockOffsetMs + ms };
  return settle(next, realNow + next.clockOffsetMs);
}

// ---------- online duo & witnesses ----------

/** Applies witness reports received from the server (each one only once). */
export function applyReports(state: GameState, now: number, reports: { id: string; witnessName: string }[]): GameState {
  const fresh = reports.filter((r) => !state.appliedReports.includes(r.id));
  if (fresh.length === 0) return state;
  const events: GameEvent[] = [];
  let companions = state.companions;
  for (const r of fresh) {
    companions = companions.map((c) => changeHealth(c, RULES.witnessReportHealth, now, events));
    events.push({ kind: 'reported', who: r.witnessName, at: now });
  }
  return {
    ...state,
    companions,
    appliedReports: [...state.appliedReports, ...fresh.map((r) => r.id)].slice(-200),
    events: [...state.events, ...events],
  };
}

export function receiveCheers(state: GameState, now: number, names: string[]): GameState {
  if (names.length === 0) return state;
  return { ...state, events: [...state.events, ...names.map((who) => ({ kind: 'cheered' as const, who, at: now }))] };
}

export function setDisplayName(state: GameState, name: string): GameState {
  return { ...state, displayName: name.trim().slice(0, 40) };
}
