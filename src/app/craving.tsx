import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';

import { Companion } from '../components/Companion';
import { IconButton } from '../components/IconButton';
import { Body, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Screen } from '../components/ui';
import { messages, t } from '../i18n';
import { pickMessage } from '../i18n/messages';
import { useDerived } from '../state/derived';
import { colors, fonts } from '../theme';

const TOTAL = 120;
const INHALE = 4;
const EXHALE = 6;

export default function Craving() {
  const d = useDerived();
  const c = d.companion;
  const [left, setLeft] = useState(TOTAL);
  const scale = useRef(new Animated.Value(0.9)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: INHALE * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(scale, { toValue: 0.9, duration: EXHALE * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [scale, native]);

  const done = left === 0;
  const elapsed = TOTAL - left;
  const phase = elapsed % (INHALE + EXHALE) < INHALE ? t.craving.inhale : t.craving.exhale;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  return (
    <Screen variant="lineage" scroll={false}>
      <HeaderRow left={<Label>{c?.name ?? ''}</Label>} right={<IconButton icon="close" label={t.common.close} onPress={close} />} />
      <View style={{ marginTop: 8 }}>
        <Headline line1={t.craving.title} size={64} />
        {c ? (
          <Body muted style={{ marginTop: 8 }}>
            {pickMessage(messages.craving, d.today + 'craving', { name: c.name, days: d.streak })}
          </Body>
        ) : null}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {c ? (
          <Companion speciesId={c.speciesId} stage={d.stage} health={c.health} status={c.status} size={240} scale={done ? undefined : scale} breathing={done} />
        ) : null}
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontFamily: fonts.serifItalic, fontSize: 34, color: colors.ink, textAlign: 'center' }}
        >
          {done ? t.craving.done(c?.name ?? '') : phase}
        </Text>
        {!done ? <Label>{t.craving.remaining(`${mm}:${ss}`)}</Label> : null}
      </View>

      {done ? <PrimaryButton label={t.craving.leave} onPress={close} /> : <GhostButton label={t.craving.stop} onPress={close} />}
    </Screen>
  );
}
