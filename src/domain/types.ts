import type { DayKey } from './dates';

export type DayResult = 'clean' | 'relapse' | 'missed' | 'frozen';

export interface Profile {
  cigsPerDay: number;
  packPrice: number;
  cigsPerPack: number;
  currency: string;
  reminderHour: number;
  /** First day counted. */
  startDay: DayKey;
}

export type CompanionStatus = 'alive' | 'dead' | 'buried';

export interface Companion {
  id: string;
  /** Always chosen by the person. There is no default name. */
  name: string;
  speciesId: string;
  bornDay: DayKey;
  health: number;
  /** Cumulative validated days in this companion's life. Drives its stage. */
  cleanDays: number;
  status: CompanionStatus;
  diedAt?: number;
  /** Validated days in a row since death (free revival at 3). */
  reviveProgress: number;
  buriedDay?: DayKey;
}

export interface Goal {
  label: string;
  price: number;
}

export interface Witness {
  id: string;
  name: string;
  lastReportDay?: DayKey;
}

/** The duo partner. Simulated locally until the Supabase backend exists. */
export interface Partner {
  name: string;
  streak: number;
  lastCheerDay?: DayKey;
}

export interface GameEvent {
  kind: 'evolved' | 'died' | 'revived' | 'buried' | 'lowHealth' | 'goalReached' | 'frozen';
  companionId?: string;
  at: number;
}

export interface GameState {
  version: 1;
  profile: Profile | null;
  companions: Companion[];
  activeId: string | null;
  journal: Record<DayKey, DayResult>;
  /** Every day up to and including this one has been settled (missed days applied). */
  settledThrough: DayKey | null;
  freezes: number;
  goal: Goal | null;
  witnesses: Witness[];
  partner: Partner | null;
  inviteCode: string;
  ownedSpecies: string[];
  /** Latest events, for the UI to show once (evolution, death...). */
  events: GameEvent[];
  /** Prototype only: moves the app clock forward to play through days quickly. */
  clockOffsetMs: number;
}
