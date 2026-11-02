import { useMemo } from 'react';

import { dayKey, diffDays } from '../domain/dates';
import { activeCompanion, pendingDay, savings, streak } from '../domain/engine';
import { stageIndex } from '../domain/rules';
import type { Companion } from '../domain/types';
import { messages } from '../i18n';
import { pickMessage, type MessagePool } from '../i18n/messages';
import { useGame } from './GameProvider';

export function useDerived() {
  const { state, now } = useGame();
  return useMemo(() => {
    const companion = activeCompanion(state);
    const today = dayKey(now);
    const s = streak(state, now);
    return {
      today,
      companion,
      stage: companion ? stageIndex(companion.cleanDays) : 0,
      streak: s,
      pending: pendingDay(state, now),
      savings: savings(state, now),
      dayNumber: state.profile ? diffDays(state.profile.startDay, today) + 1 : 0,
      currency: state.profile?.currency ?? 'CHF',
    };
  }, [state, now]);
}

export function companionMessage(c: Companion, today: string, streakDays: number, lastResult?: 'clean' | 'relapse'): string {
  let pool: MessagePool;
  if (c.status !== 'alive') pool = 'dead';
  else if (lastResult === 'clean') pool = 'afterClean';
  else if (lastResult === 'relapse') pool = 'afterRelapse';
  else if (c.health < 30) pool = 'low';
  else if (c.health < 60) pool = 'tired';
  else pool = 'good';
  return pickMessage(messages[pool], today + c.id + pool, { name: c.name, days: streakDays });
}

/** Days a companion has lived (until death or today). */
export function livedDays(c: Companion, now: number): number {
  const end = c.diedAt != null ? dayKey(c.diedAt) : c.buriedDay ?? dayKey(now);
  return Math.max(1, diffDays(c.bornDay, end) + 1);
}
