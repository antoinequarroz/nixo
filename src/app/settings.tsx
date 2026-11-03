import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';

import { IconButton } from '../components/IconButton';
import { Body, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Rule, Screen, Stepper, TextLink } from '../components/ui';
import { addFreezes, advanceClock, updateProfile } from '../domain/engine';
import { PRICES, RULES } from '../domain/rules';
import { formatMoney, t } from '../i18n';
import { confirm } from '../services/dialog';
import { askForNotifications, notificationsAllowed } from '../services/notifications';
import { PRODUCTS, purchase } from '../services/purchases';
import { deleteAccount } from '../services/social';
import { isOnline } from '../services/backend';
import { useGame } from '../state/GameProvider';
import { colors } from '../theme';

const HOUR = 3_600_000;
// The clock lab is for testing only: hidden in store builds unless asked for.
const SHOW_LAB = __DEV__ || process.env.EXPO_PUBLIC_SHOW_LAB === '1';
const LEGAL_URL = process.env.EXPO_PUBLIC_LEGAL_URL;

export default function Settings() {
  const { state, now, update, reset } = useGame();
  const p = state.profile;
  const [notifOn, setNotifOn] = useState(false);
  useEffect(() => {
    notificationsAllowed().then(setNotifOn).catch(() => undefined);
  }, []);
  if (!p) return null;
  const currency = p.currency;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const buyFreezes = async () => {
    if (await purchase(PRODUCTS.freezePack, t.settings.freezes, PRICES.freezePack, currency)) update((s) => addFreezes(s, RULES.freezesPerPack));
  };
  const advance = (ms: number) => update((s) => advanceClock(s, ms, Date.now()));
  const clock = new Date(now);

  return (
    <Screen variant="quiet">
      <HeaderRow left={t.settings.header} right={<IconButton icon="close" label={t.common.close} onPress={close} />} />
      <View style={{ marginTop: 8, marginBottom: 12 }}>
        <Headline line1={t.settings.header} size={48} />
      </View>

      <Label small style={{ marginTop: 12 }}>
        {t.settings.habits}
      </Label>
      <Stepper label={t.settings.cigsPerDay} value={p.cigsPerDay} min={1} max={80} onChange={(v) => update((s) => updateProfile(s, { cigsPerDay: v }))} />
      <Stepper
        label={t.settings.packPrice}
        value={p.packPrice}
        step={0.5}
        min={1}
        max={50}
        format={(v) => formatMoney(v, currency)}
        onChange={(v) => update((s) => updateProfile(s, { packPrice: v }))}
      />
      <Stepper label={t.settings.cigsPerPack} value={p.cigsPerPack} min={10} max={50} onChange={(v) => update((s) => updateProfile(s, { cigsPerPack: v }))} />
      <Stepper
        label={t.settings.reminder}
        value={p.reminderHour}
        min={17}
        max={23}
        format={(v) => t.onboarding.reminderAt(v)}
        onChange={(v) => update((s) => updateProfile(s, { reminderHour: v }))}
      />

      <Rule style={{ marginTop: 16 }} />
      <Label small style={{ marginTop: 16 }}>
        {t.settings.notifications}
      </Label>
      {Platform.OS === 'web' ? (
        <Body muted style={{ marginTop: 8 }}>
          iOS / Android
        </Body>
      ) : notifOn ? (
        <Body style={{ marginTop: 8 }}>{t.settings.notificationsOn}</Body>
      ) : (
        <GhostButton style={{ marginTop: 10 }} label={t.settings.notificationsOff} onPress={() => askForNotifications().then(setNotifOn)} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 52 }}>
        <Body style={{ flex: 1 }}>{t.settings.morning}</Body>
        <Switch
          accessibilityLabel={t.settings.morning}
          value={state.morningMessages}
          onValueChange={(v) => update((s) => ({ ...s, morningMessages: v }))}
          trackColor={{ false: 'rgba(237,230,218,0.2)', true: colors.accent }}
          thumbColor={colors.ink}
        />
      </View>

      <Rule style={{ marginTop: 16 }} />
      <Label small style={{ marginTop: 16 }}>
        {t.settings.freezes}
      </Label>
      <Body muted style={{ marginTop: 8 }}>
        {t.settings.freezesHint(state.freezes)}
      </Body>
      <GhostButton style={{ marginTop: 10 }} label={t.settings.buyFreezes(formatMoney(PRICES.freezePack, currency))} onPress={buyFreezes} />

      {SHOW_LAB ? (
        <>
          <Rule style={{ marginTop: 20 }} />
          <Label small style={{ marginTop: 16 }}>
            {t.settings.lab}
          </Label>
          <Body muted style={{ marginTop: 8 }}>
            {t.settings.labHint}
          </Body>
          <Body style={{ marginTop: 8, fontSize: 14 }}>
            {t.settings.clock(`${t.weekdays[clock.getDay()]} ${clock.getDate()} ${t.monthsLong[clock.getMonth()]} · ${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`)}
          </Body>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <GhostButton style={{ flexGrow: 1 }} label={t.settings.plusHours(6)} onPress={() => advance(6 * HOUR)} />
            <GhostButton style={{ flexGrow: 1 }} label={t.settings.plusDay} onPress={() => advance(24 * HOUR)} />
            <GhostButton style={{ flexGrow: 1 }} label={t.settings.plusWeek} onPress={() => advance(7 * 24 * HOUR)} />
          </View>
          {state.clockOffsetMs > 0 ? (
            <GhostButton style={{ marginTop: 8 }} label={t.settings.resetClock} onPress={() => update((s) => ({ ...s, clockOffsetMs: 0 }))} />
          ) : null}
        </>
      ) : null}

      <Rule style={{ marginTop: 20 }} />
      <Body muted style={{ marginTop: 16, fontSize: 14 }}>
        {t.settings.medical}
      </Body>
      {LEGAL_URL ? <TextLink style={{ marginTop: 8 }} label={t.settings.legal} onPress={() => Linking.openURL(LEGAL_URL)} /> : null}

      <PrimaryButton
        style={{ marginTop: 28 }}
        label={isOnline ? t.settings.deleteAccount : t.settings.reset}
        onPress={async () => {
          const title = isOnline ? t.settings.deleteAccount : t.settings.reset;
          const body = isOnline ? t.settings.deleteAccountConfirm : t.settings.resetConfirm;
          if (!(await confirm(title, body, title))) return;
          if (isOnline) {
            try {
              await deleteAccount();
            } catch {
              if (Platform.OS === 'web') window.alert(t.settings.deleteFailed);
              else Alert.alert(title, t.settings.deleteFailed);
              return;
            }
          }
          reset();
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}
