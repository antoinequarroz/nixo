// Days are stored as local calendar keys "YYYY-MM-DD" so a "day without smoking"
// matches what the person sees on their phone, whatever the time zone.

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a day, in ms. */
export function dayStart(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n).getTime());
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: DayKey, b: DayKey): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** Moment a day can no longer be validated: noon the next day. */
export function validationDeadline(key: DayKey, graceHour: number): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d + 1, graceHour).getTime();
}
