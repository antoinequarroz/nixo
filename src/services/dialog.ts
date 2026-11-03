import { Alert, Platform } from 'react-native';

import { t } from '../i18n';

/** Yes/no dialog that also works on web (where Alert is a no-op). */
export function confirm(title: string, body: string, okLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${body}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, onPress: () => resolve(true) },
    ]);
  });
}
