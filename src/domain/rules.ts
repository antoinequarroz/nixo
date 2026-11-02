// Game rules from the V1 scoping doc. Change numbers here, not in the screens.

export const RULES = {
  maxHealth: 100,
  /** A validated smoke-free day. */
  cleanDayHealth: +10,
  /** An admitted relapse: honesty must cost less than lying. */
  relapseHealth: -30,
  /** A day nobody validated counts as a light relapse. */
  missedDayHealth: -20,
  /** A witness (accepted friend) reports seeing you smoke. Max once per witness per day. */
  witnessReportHealth: -15,
  /** A day can be validated until this hour the next day. */
  graceHour: 12,
  /** Below this, the companion looks tired and a warning is sent. */
  lowHealth: 30,
  /** After death, the companion can be brought back for at least this long. */
  reviveWindowHours: 72,
  /** Free revival: this many validated days in a row while dead. */
  reviveCleanDays: 3,
  /** Health after any revival. The companion keeps its stage. */
  reviveHealth: 50,
  /** No paid offer for this long after a death (no upsell right after a relapse). */
  paidReviveCooldownHours: 12,
  /** Default evening reminder, and the second one this many hours later. */
  defaultReminderHour: 21,
  secondReminderDelayHours: 2,
  /** Common estimate: each cigarette not smoked gives back about 11 minutes of life. */
  minutesPerCigarette: 11,
  freezesPerPack: 3,
} as const;

/** Stages are tied to real withdrawal milestones (cumulative clean days of the companion). */
export const STAGES = [
  { day: 0, key: 'seed' },
  { day: 3, key: 'wake' },
  { day: 14, key: 'young' },
  { day: 30, key: 'adult' },
  { day: 90, key: 'ultimate' },
  { day: 365, key: 'legend' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

export function stageIndex(cleanDays: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (cleanDays >= s.day) idx = i;
  });
  return idx;
}

/** Prices shown for simulated purchases, until RevenueCat is wired in. */
export const PRICES = {
  revive: 2,
  freezePack: 1.5,
  species: 4,
} as const;
