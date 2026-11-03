import { getLocales } from 'expo-localization';

import { en } from './en';
import { fr, type Dict } from './fr';
import { MESSAGES } from './messages';

export type Lang = 'fr' | 'en';

function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'fr' ? 'fr' : code ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export const lang: Lang = detectLang();
export const t: Dict = lang === 'fr' ? fr : en;
export const messages = MESSAGES[lang];

export function detectCurrency(): string {
  try {
    const l = getLocales()[0];
    if (l?.regionCode === 'CH' || l?.regionCode === 'LI') return 'CHF';
    return l?.currencyCode ?? 'EUR';
  } catch {
    return 'CHF';
  }
}

export function formatMoney(amount: number, currency: string): string {
  return `${formatAmount(amount)} ${currency}`;
}

export function formatAmount(amount: number): string {
  return formatNumber(amount >= 100 ? Math.round(amount) : Math.round(amount * 10) / 10);
}

export function formatNumber(n: number): string {
  const [int, dec] = String(Math.abs(n)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? ' ' : ',');
  const sign = n < 0 ? '−' : '';
  return sign + grouped + (dec ? (lang === 'fr' ? ',' : '.') + dec : '');
}

export function formatDay(key: string, long = false): string {
  const [, m, d] = key.split('-').map(Number);
  return lang === 'fr'
    ? `${d} ${long ? t.monthsLong[m - 1] : t.months[m - 1]}`
    : `${long ? t.monthsLong[m - 1] : t.months[m - 1]} ${d}`;
}

export function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return lang === 'fr' ? `${days} j ${hours} h` : `${days}d ${hours}h`;
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  return lang === 'fr' ? `${hours} h ${String(mins).padStart(2, '0')}` : `${hours}h ${mins}m`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
export const roman = (i: number) => ROMAN[i] ?? String(i + 1);
