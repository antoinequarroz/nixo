// Remote push: this phone registers its Expo push token with the server, which
// then notifies it when a witness reports or the duo partner cheers.
// Needs an EAS project id (run `npx eas-cli@latest init` once), so it stays off
// in Expo Go, on the web, and before the project is linked to EAS.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { lang } from '../i18n';
import { notificationsAllowed } from './notifications';
import { isOnline } from './backend';
import { registerPushToken } from './social';

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerForPush(): Promise<boolean> {
  if (!isOnline || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return false;
  const id = projectId();
  if (!id || !(await notificationsAllowed())) return false;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await registerPushToken(token, lang);
  return true;
}
