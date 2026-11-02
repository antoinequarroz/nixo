// Evening reminders, scheduled locally for the next 7 days: one at the chosen
// hour and a second one 2 h later. Today's are skipped once the day is validated.
// Rescheduled on every launch and validation, so the plan is always fresh.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dayKey, dayStart } from '../domain/dates';
import { RULES } from '../domain/rules';
import { activeCompanion, streak } from '../domain/engine';
import type { GameState } from '../domain/types';
import { messages, t } from '../i18n';
import { pickMessage } from '../i18n/messages';

const HOUR = 3_600_000;

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!supported) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function askForNotifications(): Promise<boolean> {
  if (!supported) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Plans the next 7 days of local notifications (at most 3 a day):
 * an optional morning message in the companion's voice, the evening reminder,
 * and a second reminder 2 h later. Days already validated get nothing.
 */
export async function scheduleReminders(state: GameState, now: number): Promise<void> {
  const companion = activeCompanion(state);
  if (!supported || !state.profile || !companion) return;
  if (!(await notificationsAllowed())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Rappels',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const name = companion.name;
  const dead = companion.status !== 'alive';
  const low = !dead && companion.health < RULES.lowHealth;
  const currentStreak = streak(state, now);
  const pool = companion.health < RULES.lowHealth ? messages.low : companion.health < 60 ? messages.tired : messages.good;
  // The app clock can be moved forward in the prototype lab; real reminders use real time.
  const realShift = Date.now() - now;
  const today = dayKey(now);

  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    if (state.journal[day]) continue;
    const evening = dayStart(day) + state.profile.reminderHour * HOUR;
    const plan: [number, string][] = [
      [evening, dead ? t.notifications.dead(name) : low ? t.notifications.low(name) : t.notifications.reminder(name)],
      [evening + RULES.secondReminderDelayHours * HOUR, t.notifications.second(name)],
    ];
    if (state.morningMessages && !dead) {
      plan.unshift([dayStart(day) + RULES.morningHour * HOUR, pickMessage(pool, day + companion.id, { name, days: currentStreak + i })]);
    }
    for (const [at, body] of plan) {
      const when = at + realShift;
      if (when <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: name || t.notifications.reminderTitle, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
      });
    }
  }
}
