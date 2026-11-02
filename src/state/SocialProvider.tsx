import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { dayKey } from '../domain/dates';
import { activeCompanion, applyReports, receiveCheers, streak } from '../domain/engine';
import { stageIndex } from '../domain/rules';
import * as social from '../services/social';
import { isOnline } from '../services/supabase';
import { useGame } from './GameProvider';

type Status = 'off' | 'connecting' | 'ready' | 'error';

interface SocialContext {
  status: Status;
  me: social.Me | null;
  snapshot: social.SocialSnapshot | null;
  error: social.SocialError | null;
  busy: boolean;
  refresh: () => Promise<void>;
  /** Runs a server action, then refreshes. Returns false and sets `error` on failure. */
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  clearError: () => void;
}

const Ctx = createContext<SocialContext | null>(null);
const POLL_MS = 60_000;

// Server days use the real date, never the prototype lab clock.
const realToday = () => dayKey(Date.now());

export function SocialProvider({ children }: { children: ReactNode }) {
  const { state, now, update, ready } = useGame();
  const [status, setStatus] = useState<Status>(isOnline ? 'connecting' : 'off');
  const [me, setMe] = useState<social.Me | null>(null);
  const [snapshot, setSnapshot] = useState<social.SocialSnapshot | null>(null);
  const [error, setError] = useState<social.SocialError | null>(null);
  const [busy, setBusy] = useState(false);
  const hasProfile = state.profile != null;

  // Sign in once the person has finished onboarding.
  useEffect(() => {
    if (!isOnline || !ready || !hasProfile || me) return;
    social
      .signIn()
      .then((m) => {
        setMe(m);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [ready, hasProfile, me]);

  const refresh = useCallback(async () => {
    if (!me) return;
    try {
      const [snap, reports, cheers] = await Promise.all([
        social.fetchSocial(me.id, realToday()),
        social.consumeReports(),
        social.consumeCheers(),
      ]);
      setSnapshot(snap);
      if (reports.length > 0) {
        update((s, n) => applyReports(s, n, reports.map((r) => ({ id: r.id, witnessName: r.witness_name }))));
      }
      if (cheers.length > 0) update((s, n) => receiveCheers(s, n, cheers.map((c) => c.from_name)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [me, update]);

  // Poll while the app is open, and on every return to the foreground.
  useEffect(() => {
    if (!me) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [me, refresh]);

  // Publish what the duo partner and witnesses may see, when it changes.
  const c = activeCompanion(state);
  const stats: social.PublicStats | null = c
    ? {
        displayName: state.displayName,
        companionName: c.name,
        companionSpecies: c.speciesId,
        stage: stageIndex(c.cleanDays),
        health: c.health,
        status: c.status,
        streak: streak(state, now),
      }
    : null;
  const statsKey = JSON.stringify(stats);
  const lastPushed = useRef('');
  useEffect(() => {
    if (!me || !stats || statsKey === lastPushed.current) return;
    const timer = setTimeout(() => {
      social
        .pushStats(me.id, stats)
        .then(() => {
          lastPushed.current = statsKey;
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
    // stats is derived from statsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, statsKey]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof social.SocialFailure ? e.code : 'network');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ status, me, snapshot, error, busy, refresh, run, clearError }),
    [status, me, snapshot, error, busy, refresh, run, clearError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocial(): SocialContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSocial must be used inside SocialProvider');
  return ctx;
}

export { realToday };
