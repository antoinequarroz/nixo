// Which server the duo and witnesses use:
// 1. Supabase, when EXPO_PUBLIC_SUPABASE_URL and _ANON_KEY are set (production).
// 2. The local SQLite test server (`npm run server`), when EXPO_PUBLIC_LOCAL_SERVER is set.
//    "auto" finds the computer that serves the app in development.
// 3. Otherwise none: the duo stays simulated on the phone.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const LOCAL_PORT = 8787;

function localServerUrl(): string | null {
  const setting = process.env.EXPO_PUBLIC_LOCAL_SERVER?.trim();
  if (!setting) return null;
  if (setting !== 'auto') return setting.replace(/\/$/, '');
  // The Metro address the phone already uses, e.g. "192.168.1.20:8081".
  const host =
    Constants.expoConfig?.hostUri?.split(':')[0] ??
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null);
  return host ? `http://${host}:${LOCAL_PORT}` : null;
}

export const localServer = supabase ? null : localServerUrl();
export type BackendKind = 'supabase' | 'local' | null;
export const backend: BackendKind = supabase ? 'supabase' : localServer ? 'local' : null;
export const isOnline = backend !== null;
