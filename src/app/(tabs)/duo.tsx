import { useState } from 'react';
import { Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Body, Field, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Rule, Screen, Serif, TextLink } from '../../components/ui';
import { addWitness, cheerPartner, linkPartner, removeWitness, unlinkPartner, witnessReport } from '../../domain/engine';
import { t } from '../../i18n';
import { useGame } from '../../state/GameProvider';
import { useDerived } from '../../state/derived';
import { colors, fonts } from '../../theme';

export default function Duo() {
  const { state, update } = useGame();
  const d = useDerived();
  const { width } = useWindowDimensions();
  const [partnerName, setPartnerName] = useState('');
  const [witnessName, setWitnessName] = useState('');

  const share = () => Share.share({ message: t.duo.shareMessage(state.inviteCode) }).catch(() => undefined);

  return (
    <Screen variant="quiet">
      <HeaderRow left={t.duo.header} />
      <View style={{ marginTop: 16, gap: 12 }}>
        <Headline line1={t.duo.title} italic={t.duo.titleItalic} size={width < 370 ? 46 : 52} />
        <Body muted>{t.duo.intro}</Body>
      </View>

      {state.partner ? (
        <View style={[styles.card, { marginTop: 24 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Serif size={28} italic>
              {state.partner.name}
            </Serif>
            <TextLink label={t.duo.unlink} onPress={() => update((s) => unlinkPartner(s))} style={{ alignSelf: 'auto', paddingVertical: 0 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <View style={{ gap: 2 }}>
              <Label small>{t.duo.you}</Label>
              <Text style={styles.vs}>{d.streak}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Label small>{state.partner.name}</Label>
              <Text style={styles.vs}>{state.partner.streak}</Text>
            </View>
          </View>
          <Label small>{t.duo.streakLabel}</Label>
          <GhostButton
            label={state.partner.lastCheerDay === d.today ? t.duo.cheered : t.duo.cheer}
            disabled={state.partner.lastCheerDay === d.today}
            onPress={() => update((s, n) => cheerPartner(s, n))}
          />
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 14 }}>
          <Label small>{t.duo.yourCode}</Label>
          <Text style={styles.code} accessibilityLabel={state.inviteCode.split('').join(' ')}>
            {state.inviteCode}
          </Text>
          <GhostButton label={t.duo.share} onPress={share} />
          <Field label={t.duo.partnerName} value={partnerName} onChangeText={setPartnerName} />
          <PrimaryButton
            label={t.duo.link}
            disabled={!partnerName.trim()}
            onPress={() => {
              update((s) => linkPartner(s, partnerName));
              setPartnerName('');
            }}
          />
        </View>
      )}

      <Rule style={{ marginTop: 28 }} />
      <View style={{ paddingTop: 16, gap: 12 }}>
        <Label small>{t.duo.witnesses}</Label>
        <Body muted>{t.duo.witnessesIntro}</Body>
        {state.witnesses.map((w) => {
          const reported = w.lastReportDay === d.today;
          return (
            <View key={w.id} style={styles.witness}>
              <View style={{ flex: 1, gap: 2 }}>
                <Serif size={20}>{w.name}</Serif>
                {reported ? <Label small style={{ color: colors.danger }}>{t.duo.reportedToday}</Label> : null}
              </View>
              <TextLink
                label={t.duo.simulateReport}
                onPress={() => update((s, n) => witnessReport(s, n, w.id))}
                style={{ alignSelf: 'auto', opacity: reported ? 0.4 : 1 }}
              />
              <TextLink label="×" onPress={() => update((s) => removeWitness(s, w.id))} style={{ alignSelf: 'auto', paddingHorizontal: 8 }} />
            </View>
          );
        })}
        <Field label={t.duo.witnessName} value={witnessName} onChangeText={setWitnessName} />
        <GhostButton
          label={t.duo.addWitness}
          disabled={!witnessName.trim()}
          onPress={() => {
            update((s) => addWitness(s, witnessName));
            setWitnessName('');
          }}
        />
      </View>

      <Body muted style={{ marginTop: 24, fontSize: 12, lineHeight: 18 }}>
        {t.duo.prototypeNote}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.hairline, backgroundColor: 'rgba(20,18,16,0.45)' },
  code: { fontFamily: fonts.monoMedium, fontSize: 34, letterSpacing: 8, color: colors.ink },
  vs: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink },
  witness: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
});
