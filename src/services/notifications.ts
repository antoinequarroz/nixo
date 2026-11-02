// Evening reminders, scheduled locally for the next 7 days: one at the chosen
// hour and a second one 2 h later. Today's are skipped once the day is validated.
// Rescheduled on every launch and validation, so the plan is always fresh.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dayKey, dayStart } from '../domain/dates';
import { RULES } from '../domain/rules';
import type { GameState } from '../domain/types';
import { t } from '../i18n';

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

export async function scheduleReminders(state: GameState, now: number, companionName: string): Promise<void> {
  if (!supported || !state.profile) return;
  if (!(await notificationsAllowed())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Rappels',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const today = dayKey(now);
  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    if (state.journal[day]) continue;
    const first = dayStart(day) + state.profile.reminderHour * 3_600_000;
    const second = first + RULES.secondReminderDelayHours * 3_600_000;
    // The app clock can be moved forward in the prototype lab; real reminders use real time.
    const realShift = Date.now() - now;
    for (const [at, body] of [
      [first, t.notifications.reminder(companionName)],
      [second, t.notifications.second(companionName)],
    ] as const) {
      const when = at + realShift;
      if (when <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: t.notifications.reminderTitle, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
      });
    }
  }
}
