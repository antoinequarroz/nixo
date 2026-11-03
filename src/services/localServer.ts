// Client for the local SQLite test server (server/nixo-server.mjs).

import AsyncStorage from '@react-native-async-storage/async-storage';

import { localServer } from './backend';

const TOKEN_KEY = 'nixo.localServer.token';

export class LocalError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<{ status: number; json: { data?: T; error?: string } }> {
  if (!localServer) throw new LocalError('network');
  let res: Response;
  try {
    res = await fetch(localServer + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new LocalError('network');
  }
  return { status: res.status, json: await res.json().catch(() => ({ error: 'network' })) };
}

async function token(): Promise<string> {
  const saved = await AsyncStorage.getItem(TOKEN_KEY);
  if (saved) return saved;
  const { json } = await post<never>('/auth/anonymous', {});
  const fresh = (json as { token?: string }).token;
  if (!fresh) throw new LocalError('network');
  await AsyncStorage.setItem(TOKEN_KEY, fresh);
  return fresh;
}

export async function localRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let res = await post<T>(`/rpc/${fn}`, args, await token());
  if (res.status === 401) {
    // The test database was reset: start again with a new account.
    await AsyncStorage.removeItem(TOKEN_KEY);
    res = await post<T>(`/rpc/${fn}`, args, await token());
  }
  if (res.json.error) throw new LocalError(res.json.error);
  return res.json.data as T;
}

export const forgetLocalSession = () => AsyncStorage.removeItem(TOKEN_KEY);
