import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Companion } from '../components/Companion';
import { Body, Field, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Screen, Stepper, TextLink } from '../components/ui';
import { startJourney } from '../domain/engine';
import { RULES } from '../domain/rules';
import { detectCurrency, formatMoney, t } from '../i18n';
import { askForNotifications } from '../services/notifications';
import { useGame } from '../state/GameProvider';

const STEPS = 5;

export default function Onboarding() {
  const { update } = useGame();
  const [step, setStep] = useState(0);
  const [currency] = useState(detectCurrency);
  const [cigsPerDay, setCigs] = useState(15);
  const [packPrice, setPrice] = useState(currency === 'CHF' ? 9 : 11);
  const [cigsPerPack, setPack] = useState(20);
  const [reminderHour, setHour] = useState<number>(RULES.defaultReminderHour);
  const [name, setName] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [goalPrice, setGoalPrice] = useState('');

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = (withGoal: boolean) => {
    const price = parseFloat(goalPrice.replace(',', '.'));
    update((s, n) =>
      startJourney(
        s,
        {
          profile: { cigsPerDay, packPrice, cigsPerPack, currency, reminderHour },
          companionName: name,
          speciesId: 'ember',
          goal: withGoal && goalLabel.trim() && price > 0 ? { label: goalLabel.trim(), price } : null,
        },
        n,
      ),
    );
    askForNotifications().catch(() => undefined);
    router.replace('/home');
  };

  const header = (
    <HeaderRow
      left={t.onboarding.kicker}
      right={step > 0 ? <TextLink label={t.common.back} onPress={back} style={{ paddingVertical: 0 }} /> : `${step + 1} / ${STEPS}`}
    />
  );

  return (
    <Screen variant={step === 0 ? 'home' : step === 3 ? 'lineage' : 'quiet'}>
      {header}
      {step === 0 ? (
        <View style={{ flex: 1, gap: 16, marginTop: 18 }}>
          <Headline line1={t.onboarding.welcomeTitle} italic={t.onboarding.welcomeItalic} size={58} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
            <Companion speciesId="ember" stage={0} health={100} status="alive" size={240} />
          </View>
          <Body style={{ fontSize: 17, lineHeight: 25 }}>{t.onboarding.welcomeBody}</Body>
          <PrimaryButton label={t.onboarding.start} onPress={next} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ flex: 1, gap: 10, marginTop: 18 }}>
          <Headline line1={t.onboarding.habitsTitle} italic={t.onboarding.habitsItalic} size={52} />
          <Body muted style={{ marginBottom: 16 }}>
            {t.onboarding.habitsBody}
          </Body>
          <Stepper label={t.settings.cigsPerDay} value={cigsPerDay} min={1} max={80} onChange={setCigs} />
          <Stepper label={t.settings.packPrice} value={packPrice} step={0.5} min={1} max={50} format={(v) => formatMoney(v, currency)} onChange={setPrice} />
          <Stepper label={t.settings.cigsPerPack} value={cigsPerPack} min={10} max={50} onChange={setPack} />
          <Label small style={{ marginTop: 12 }}>
            {t.onboarding.perMonth(formatMoney((cigsPerDay * packPrice * 30) / cigsPerPack, currency))}
          </Label>
          <View style={{ flex: 1 }} />
          <PrimaryButton label={t.common.next} onPress={next} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ flex: 1, gap: 10, marginTop: 18 }}>
          <Headline line1={t.onboarding.reminderTitle} italic={t.onboarding.reminderItalic} size={52} />
          <Body muted style={{ marginBottom: 16 }}>
            {t.onboarding.reminderBody}
          </Body>
          <Stepper label={t.settings.reminder} value={reminderHour} min={17} max={23} format={(v) => t.onboarding.reminderAt(v)} onChange={setHour} />
          <View style={{ flex: 1 }} />
          <PrimaryButton label={t.common.next} onPress={next} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ flex: 1, gap: 10, marginTop: 18 }}>
          <Headline line1={t.onboarding.nameTitle} italic={t.onboarding.nameItalic} size={52} />
          <Body muted>{t.onboarding.nameBody}</Body>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Companion speciesId="ember" stage={0} health={100} status="alive" size={180} />
          </View>
          <Field label={t.companions.name} placeholder={t.companions.namePlaceholder} value={name} onChangeText={setName} maxLength={24} autoFocus />
          <View style={{ flex: 1, minHeight: 16 }} />
          <PrimaryButton label={t.common.next} onPress={next} disabled={!name.trim()} />
        </View>
      ) : null}

      {step === 4 ? (
        <View style={{ flex: 1, gap: 12, marginTop: 18 }}>
          <Headline line1={t.onboarding.goalTitle} italic={t.onboarding.goalItalic} size={52} />
          <Body muted style={{ marginBottom: 8 }}>
            {t.onboarding.goalBody}
          </Body>
          <Field label={t.savings.goalLabel} placeholder={t.savings.goalLabelPlaceholder} value={goalLabel} onChangeText={setGoalLabel} />
          <Field label={`${t.savings.goalPrice} (${currency})`} keyboardType="decimal-pad" placeholder="450" value={goalPrice} onChangeText={setGoalPrice} />
          <View style={{ flex: 1, minHeight: 16 }} />
          <PrimaryButton label={t.onboarding.finish} onPress={() => finish(true)} />
          <GhostButton label={t.common.skip} onPress={() => finish(false)} />
        </View>
      ) : null}
    </Screen>
  );
}
