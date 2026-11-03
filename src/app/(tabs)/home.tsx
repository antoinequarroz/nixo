import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Companion } from '../../components/Companion';
import { EventBanner, useHasEvent } from '../../components/EventBanner';
import { IconButton } from '../../components/IconButton';
import { Body, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Rule, Screen, Serif, Sheet, TextLink } from '../../components/ui';
import { dayKey, dayStart } from '../../domain/dates';
import { canOfferPaidRevive, revivePaid, reviveDeadline, validateDay } from '../../domain/engine';
import { PRICES, RULES } from '../../domain/rules';
import type { Companion as CompanionT } from '../../domain/types';
import { formatDuration, formatMoney, formatNumber, roman, t } from '../../i18n';
import { PRODUCTS, purchase } from '../../services/purchases';
import { useGame } from '../../state/GameProvider';
import { companionMessage, livedDays, useDerived } from '../../state/derived';
import { WIDE_BREAKPOINT, colors, fonts } from '../../theme';

function formatToday(now: number): string {
  const d = new Date(now);
  return `${t.weekdays[d.getDay()]} ${d.getDate()} ${t.monthsLong[d.getMonth()]}`;
}

export default function Home() {
  const d = useDerived();
  const c = d.companion;

  if (!c) return null;
  if (c.status === 'dead') return <DeadView companion={c} />;
  if (c.status === 'buried') return <GraveView companion={c} />;
  return <AliveView />;
}

function AliveView() {
  const { state, now, update } = useGame();
  const d = useDerived();
  const c = d.companion!;
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [sheet, setSheet] = useState(false);
  const [lastResult, setLastResult] = useState<'clean' | 'relapse' | undefined>();

  // Forget the after-validation message when the day changes.
  useEffect(() => setLastResult(undefined), [d.today]);

  const validatedToday = !d.pending;
  const hasEvent = useHasEvent();
  const isYesterday = d.pending != null && d.pending !== d.today;

  const choose = (result: 'clean' | 'relapse') => {
    setSheet(false);
    setLastResult(result);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(result === 'clean' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
    update((s, n) => validateDay(s, n, result));
  };

  const header = (
    <HeaderRow
      left={<Label>{t.home.issue(d.dayNumber)}</Label>}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: -10 }}>
          <Label>{formatToday(now)}</Label>
          <IconButton icon="settings" label={t.home.settings} onPress={() => router.push('/settings')} />
        </View>
      }
    />
  );

  const headline = (
    <View style={{ marginTop: 10 }}>
      <Headline line1={t.home.days(d.streak)} italic={t.home.withoutSmoking} size={wide ? 64 : width < 370 ? 54 : 64} />
    </View>
  );

  const companionBlock = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${t.home.form(roman(d.stage), t.stages[d.stage], c.health)}. ${t.home.companions}`}
      onPress={() => router.push('/companions')}
      style={{ alignItems: 'center', gap: 4 }}
    >
      <Companion speciesId={c.speciesId} stage={d.stage} health={c.health} status={c.status} size={wide ? 300 : Math.min(220, width * 0.58)} />
      <Serif size={26} italic>
        {c.name}
      </Serif>
      <Label>{t.home.form(roman(d.stage), t.stages[d.stage], c.health)}</Label>
      <HealthBar health={c.health} />
    </Pressable>
  );

  const info = (
    <View style={{ gap: 16 }}>
      <View style={styles.stats}>
        <Stat label={t.home.saved} value={formatMoney(d.savings.saved, d.currency)} first />
        <Stat label={t.home.notSmoked} value={formatNumber(d.savings.cigarettesAvoided)} />
        <Stat label={t.home.lifeRegained} value={formatDuration(d.savings.minutesRegained)} />
      </View>
      {c.health < RULES.lowHealth ? <Body style={{ color: colors.danger }}>{t.home.lowHealth(c.name)}</Body> : null}
      {/* On phones the event banner takes the quote's place, so the main button stays on screen. */}
      {!wide && hasEvent ? <EventBanner /> : <Text style={styles.quote}>« {companionMessage(c, d.today, d.streak, lastResult)} »</Text>}
      <View style={{ gap: 4, marginTop: 4 }}>
        {validatedToday ? (
          <>
            <PrimaryButton label={`${t.home.validated} ✓`} onPress={() => undefined} disabled />
            <Label small style={{ textAlign: 'center', marginTop: 6 }}>
              {t.home.validatedHint(state.profile?.reminderHour ?? RULES.defaultReminderHour)}
            </Label>
          </>
        ) : (
          <PrimaryButton label={isYesterday ? t.home.validateYesterday : t.home.validate} onPress={() => setSheet(true)} />
        )}
        <TextLink label={t.home.craving} onPress={() => router.push('/craving')} />
      </View>
    </View>
  );

  return (
    <Screen variant="home" wide={wide}>
      {header}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 48, flex: 1, marginTop: 8 }}>
          <View style={{ flex: 1, gap: 12 }}>
            {headline}
            <View style={{ flex: 1, justifyContent: 'center' }}>{companionBlock}</View>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <EventBanner />
            {info}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: 14 }}>
          {headline}
          <View style={{ flex: 1, justifyContent: 'center', minHeight: 220 }}>{companionBlock}</View>
          {info}
        </View>
      )}

      <Sheet visible={sheet} onClose={() => setSheet(false)}>
        <Serif size={30}>{isYesterday ? t.home.sheetTitleYesterday : t.home.sheetTitle}</Serif>
        <PrimaryButton label={t.home.sheetClean} onPress={() => choose('clean')} />
        <GhostButton label={t.home.sheetRelapse} onPress={() => choose('relapse')} />
        <Body muted style={{ textAlign: 'center' }}>
          {t.home.sheetHonesty}
        </Body>
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.stat, !first && styles.statBorder]}>
      <Label small numberOfLines={1}>
        {label}
      </Label>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function HealthBar({ health }: { health: number }) {
  return (
    <View
      style={{ width: 120, height: 2, backgroundColor: 'rgba(237,230,218,0.18)', marginTop: 6 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: health }}
    >
      <View style={{ width: `${health}%`, height: 2, backgroundColor: health < RULES.lowHealth ? colors.danger : colors.accent }} />
    </View>
  );
}

// ---------- death ----------

function DeadView({ companion: c }: { companion: CompanionT }) {
  const { state, now, update } = useGame();
  const d = useDerived();
  const deadline = reviveDeadline(c) ?? now;
  const left = Math.max(0, deadline - now);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const paid = canOfferPaidRevive(c, now);
  const currency = d.currency;

  const buy = async () => {
    const ok = await purchase(PRODUCTS.revive, c.name, PRICES.revive, currency);
    if (ok) update((s, n) => revivePaid(s, n, c.id));
  };

  return (
    <Screen variant="dead">
      <HeaderRow
        left={<Label style={{ color: colors.deadMuted }}>{c.name}</Label>}
        right={<Label style={{ color: colors.deadMuted }}>{`${formatDayShort(c.bornDay)} — ${formatDayShort(dayKey(c.diedAt ?? now))}`}</Label>}
      />
      <View style={{ marginTop: 18, gap: 12 }}>
        <Headline line1={t.death.title(c.name)} italic={t.death.titleItalic} size={60} color={colors.deadInk} />
        <Body style={{ color: '#A9A39A', maxWidth: 320 }}>
          {t.death.lived(livedDays(c, now))} {companionMessage(c, d.today, 0)}
        </Body>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
        <Companion speciesId={c.speciesId} stage={Math.min(d.stage, 5)} health={0} status="dead" size={240} />
      </View>

      <View style={{ gap: 14 }}>
        <Rule style={{ backgroundColor: 'rgba(216,211,204,0.2)' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label small style={{ color: colors.deadMuted }}>
            {t.death.canReturn}
          </Label>
          <Serif size={28} style={{ color: colors.deadInk }}>{`${hours} h ${String(minutes).padStart(2, '0')}`}</Serif>
        </View>
        <Body style={{ color: colors.deadInk, fontSize: 14 }}>{t.death.freePath(c.reviveProgress, RULES.reviveCleanDays)}</Body>
        <PrimaryButton
          dead
          label={d.pending ? t.death.validateToday : `${t.home.validated} ✓`}
          disabled={!d.pending}
          onPress={() => update((s, n) => validateDay(s, n, 'clean'))}
        />
        {paid ? (
          <GhostButton label={t.death.paid(formatMoney(PRICES.revive, currency))} onPress={buy} />
        ) : (
          <Body muted style={{ textAlign: 'center', color: colors.deadMuted }}>
            {t.death.paidLater}
          </Body>
        )}
        <TextLink label={t.home.craving} color={colors.deadMuted} onPress={() => router.push('/craving')} />
      </View>
    </Screen>
  );
}

function GraveView({ companion: c }: { companion: CompanionT }) {
  const { now } = useGame();
  return (
    <Screen variant="dead">
      <HeaderRow left={<Label style={{ color: colors.deadMuted }}>{t.grave.title}</Label>} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <View style={styles.stone}>
          <Label small style={{ color: colors.deadMuted }}>
            {t.grave.title}
          </Label>
          <Serif size={40} italic style={{ color: colors.deadInk }}>
            {c.name}
          </Serif>
          <Body style={{ color: '#A9A39A' }}>{t.grave.lived(livedDays(c, now))}</Body>
          <Label small style={{ color: colors.deadMuted }}>{`${formatDayShort(c.bornDay)} — ${formatDayShort(c.buriedDay ?? dayKey(now))}`}</Label>
        </View>
      </View>
      <PrimaryButton dead label={t.grave.adopt} onPress={() => router.push({ pathname: '/companions', params: { adopt: '1' } })} />
    </Screen>
  );
}

function formatDayShort(key: string): string {
  const d = new Date(dayStart(key));
  return `${d.getDate()} ${t.months[d.getMonth()]}`;
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.hairline,
  },
  stat: { flex: 1, paddingVertical: 14, gap: 4, minWidth: 0 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: colors.hairline, paddingLeft: 12 },
  statValue: { fontFamily: fonts.serifRegular, fontSize: 24, color: colors.ink },
  quote: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 25, color: colors.inkSoft },
  stone: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 36,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(216,211,204,0.25)',
    minWidth: 240,
  },
});
