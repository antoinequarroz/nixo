import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { activeCompanion, createInitialState, migrateState, settle } from '../domain/engine';
import type { GameState } from '../domain/types';
import { scheduleReminders } from '../services/notifications';
import { ownedSpeciesFromStore } from '../services/purchases';

const STORAGE_KEY = 'nixo.state.v1';

interface GameContext {
  ready: boolean;
  state: GameState;
  /** App clock (real time + the prototype lab offset). */
  now: number;
  /** Apply a pure engine function. The past is always settled first. */
  update: (fn: (s: GameState, now: number) => GameState) => void;
  reset: () => void;
}

const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState>(createInitialState);
  const [tick, setTick] = useState(Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;

  const now = tick + state.clockOffsetMs;

  // Load once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = migrateState(JSON.parse(raw) as Partial<GameState>);
          setState(settle(saved, Date.now() + saved.clockOffsetMs));
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  // Species bought before (reinstall, new phone) come back from the store.
  useEffect(() => {
    if (!ready) return;
    ownedSpeciesFromStore().then((ids) => {
      if (ids.length > 0) setState((s) => ({ ...s, ownedSpecies: [...new Set([...s.ownedSpecies, ...ids])] }));
    });
  }, [ready]);

  // Save on every change.
  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state, ready]);

  // Keep the clock moving and settle the past on resume.
  useEffect(() => {
    const refresh = () => {
      const t = Date.now();
      setTick(t);
      setState((s) => settle(s, t + s.clockOffsetMs));
    };
    const id = setInterval(refresh, 30_000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // Keep the evening reminders in line with the journal.
  const journalSize = Object.keys(state.journal).length;
  const companion = activeCompanion(state);
  const lowHealth = (companion?.health ?? 100) < 30;
  useEffect(() => {
    if (!ready || !state.profile || !companion) return;
    scheduleReminders(stateRef.current, Date.now() + stateRef.current.clockOffsetMs).catch(() => undefined);
  }, [ready, journalSize, state.profile, state.morningMessages, companion?.name, companion?.status, lowHealth]);

  const update = useCallback((fn: (s: GameState, now: number) => GameState) => {
    const t = Date.now();
    setTick(t);
    setState((s) => {
      const n = t + s.clockOffsetMs;
      const next = fn(settle(s, n), n);
      // Only recent events matter to the UI.
      return next.events.length > 20 ? { ...next, events: next.events.slice(-20) } : next;
    });
  }, []);

  const reset = useCallback(() => setState(createInitialState()), []);

  const value = useMemo(() => ({ ready, state, now, update, reset }), [ready, state, now, update, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
