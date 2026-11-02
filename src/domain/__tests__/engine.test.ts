import { addDays, dayKey } from '../dates';
import {
  activeCompanion,
  adopt,
  canOfferPaidRevive,
  createInitialState,
  pendingDay,
  revivePaid,
  savings,
  settle,
  startJourney,
  streak,
  validateDay,
  witnessReport,
} from '../engine';
import { RULES } from '../rules';
import type { GameState } from '../types';

const HOUR = 3_600_000;
// Monday 2 Nov 2026, 20:00 local time.
const T0 = new Date(2026, 10, 2, 20).getTime();
const at = (days: number, hour = 20) => new Date(2026, 10, 2 + days, hour).getTime();

function start(): GameState {
  return startJourney(
    createInitialState(),
    {
      profile: { cigsPerDay: 20, packPrice: 9, cigsPerPack: 20, currency: 'CHF', reminderHour: 21 },
      companionName: 'Pépin',
      speciesId: 'ember',
      goal: { label: 'Week-end', price: 45 },
    },
    T0,
  );
}

function cleanDays(s: GameState, from: number, count: number): GameState {
  for (let i = 0; i < count; i++) s = validateDay(s, at(from + i), 'clean');
  return s;
}

describe('daily validation', () => {
  it('a clean day adds health, a clean day and streak', () => {
    let s = validateDay(start(), T0, 'clean');
    const c = activeCompanion(s)!;
    expect(c.health).toBe(90);
    expect(c.cleanDays).toBe(1);
    expect(streak(s, T0)).toBe(1);
    expect(pendingDay(s, T0)).toBeNull();
  });

  it('cannot validate the same day twice', () => {
    let s = validateDay(start(), T0, 'clean');
    s = validateDay(s, T0 + HOUR, 'clean');
    expect(activeCompanion(s)!.cleanDays).toBe(1);
  });

  it('yesterday can still be validated until noon', () => {
    const s = start();
    const nextMorning = at(1, 9);
    expect(pendingDay(s, nextMorning)).toBe(dayKey(T0));
    const v = validateDay(s, nextMorning, 'clean');
    expect(v.journal[dayKey(T0)]).toBe('clean');
    expect(pendingDay(v, nextMorning)).toBe(dayKey(at(1)));
  });

  it('a relapse costs 30 % and resets the streak but not the stage progress', () => {
    let s = cleanDays(start(), 0, 4);
    s = validateDay(s, at(4), 'relapse');
    const c = activeCompanion(s)!;
    expect(c.cleanDays).toBe(4);
    expect(c.health).toBe(70);
    expect(streak(s, at(4))).toBe(0);
  });

  it('a forgotten day counts as missed after noon the next day', () => {
    const s = settle(start(), at(1, 13));
    expect(s.journal[dayKey(T0)]).toBe('missed');
    expect(activeCompanion(s)!.health).toBe(80 + RULES.missedDayHealth);
  });

  it('a freeze protects a forgotten day and keeps the streak', () => {
    let s = cleanDays(start(), 0, 2);
    s = { ...s, freezes: 1 };
    s = settle(s, at(3, 13));
    expect(s.journal[dayKey(at(2))]).toBe('frozen');
    expect(s.freezes).toBe(0);
    s = validateDay(s, at(3), 'clean');
    expect(streak(s, at(3))).toBe(3);
  });
});

describe('evolution', () => {
  it('evolves at day 3 and day 14', () => {
    let s = cleanDays(start(), 0, 3);
    expect(s.events.filter((e) => e.kind === 'evolved')).toHaveLength(1);
    s = cleanDays(s, 3, 11);
    expect(s.events.filter((e) => e.kind === 'evolved')).toHaveLength(2);
  });
});

describe('death and revival', () => {
  function killed(): GameState {
    let s = start();
    for (let i = 0; i < 3; i++) s = validateDay(s, at(i), 'relapse');
    return s;
  }

  it('dies at 0 % health', () => {
    const c = activeCompanion(killed())!;
    expect(c.status).toBe('dead');
    expect(c.health).toBe(0);
  });

  it('3 clean days in a row bring it back at 50 %, stage kept', () => {
    let s = cleanDays(killed(), 3, 3);
    const c = activeCompanion(s)!;
    expect(c.status).toBe('alive');
    expect(c.health).toBe(RULES.reviveHealth);
  });

  it('paid revival is hidden right after death, then available until 72 h', () => {
    const s = killed();
    const c = activeCompanion(s)!;
    expect(canOfferPaidRevive(c, c.diedAt! + HOUR)).toBe(false);
    expect(canOfferPaidRevive(c, c.diedAt! + 13 * HOUR)).toBe(true);
    const r = revivePaid(s, c.diedAt! + 13 * HOUR, c.id);
    expect(activeCompanion(r)!.status).toBe('alive');
  });

  it('is buried once the window is over', () => {
    const s = killed();
    const c = activeCompanion(s)!;
    const later = settle(s, c.diedAt! + 90 * HOUR);
    expect(activeCompanion(later)!.status).toBe('buried');
  });

  it('a new companion can be adopted, with a name chosen by the person', () => {
    const s = adopt(killed(), at(3), 'Brindille', 'ember');
    expect(activeCompanion(s)!.name).toBe('Brindille');
    expect(adopt(s, at(3), '   ', 'ember')).toBe(s);
    expect(adopt(s, at(3), 'X', 'moss')).toBe(s);
  });
});

describe('witnesses', () => {
  it('a witness report costs 15 %, once per witness per day', () => {
    let s: GameState = { ...start(), witnesses: [{ id: 'w', name: 'Léa' }] };
    s = witnessReport(s, T0, 'w');
    s = witnessReport(s, T0 + HOUR, 'w');
    expect(activeCompanion(s)!.health).toBe(80 + RULES.witnessReportHealth);
    s = witnessReport(s, at(1), 'w');
    // Day 0 was never validated, so it also counts as missed.
    expect(activeCompanion(s)!.health).toBe(80 + 2 * RULES.witnessReportHealth + RULES.missedDayHealth);
  });
});

describe('savings', () => {
  it('counts money per validated day and dates the goal', () => {
    let s = cleanDays(start(), 0, 3);
    const v = savings(s, at(2));
    expect(v.perDay).toBe(9);
    expect(v.saved).toBe(27);
    expect(v.cigarettesAvoided).toBe(60);
    expect(v.goalProgress).toBeCloseTo(0.6);
    expect(v.goalEta).toBe(addDays(dayKey(at(2)), 2));
  });

  it('flags the goal when reached', () => {
    const s = cleanDays(start(), 0, 5);
    expect(s.events.some((e) => e.kind === 'goalReached')).toBe(true);
  });
});
