import { useState } from 'react';
import { Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { setDisplayName } from '../../domain/engine';
import { t } from '../../i18n';
import { confirm } from '../../services/dialog';
import * as social from '../../services/social';
import { useGame } from '../../state/GameProvider';
import { useDerived } from '../../state/derived';
import { realToday, useSocial } from '../../state/SocialProvider';
import { colors, fonts } from '../../theme';
import { Companion } from '../Companion';
import { Body, Field, GhostButton, HeaderRow, Headline, Label, PrimaryButton, Rule, Screen, Serif, TextLink } from '../ui';

export function DuoOnline() {
  const { state, update } = useGame();
  const d = useDerived();
  const { width } = useWindowDimensions();
  const { status, me, snapshot, error, busy, run, refresh } = useSocial();
  const [name, setName] = useState(state.displayName);
  const [partnerCode, setPartnerCode] = useState('');
  const [ownerCode, setOwnerCode] = useState('');

  const header = (
    <>
      <HeaderRow left={t.duo.header} />
      <View style={{ marginTop: 16, gap: 12 }}>
        <Headline line1={t.duo.title} italic={t.duo.titleItalic} size={width < 370 ? 46 : 52} />
        <Body muted>{t.duo.intro}</Body>
      </View>
    </>
  );

  if (!me || !snapshot) {
    return (
      <Screen variant="quiet">
        {header}
        <View style={{ marginTop: 32, gap: 14 }}>
          <Body muted>{status === 'error' ? t.duo.offline : t.duo.connecting}</Body>
          {status === 'error' ? <GhostButton label={t.duo.retry} onPress={refresh} /> : null}
        </View>
      </Screen>
    );
  }

  const partner = snapshot.partner;
  const share = () => Share.share({ message: t.duo.shareMessage(me.inviteCode) }).catch(() => undefined);

  return (
    <Screen variant="quiet">
      {header}

      {/* Name shown to others */}
      <View style={{ marginTop: 24, gap: 10 }}>
        <Field label={t.duo.yourName} value={name} onChangeText={setName} maxLength={40} onBlur={() => update((s) => setDisplayName(s, name))} />
        <Label small>{t.duo.yourNameHint}</Label>
      </View>

      <View style={{ marginTop: 24, gap: 10 }}>
        <Label small>{t.duo.yourCode}</Label>
        <Text style={styles.code} accessibilityLabel={me.inviteCode.split('').join(' ')}>
          {me.inviteCode}
        </Text>
        <GhostButton label={t.duo.share} onPress={share} />
      </View>

      {error ? <Body style={{ color: colors.danger, marginTop: 16 }}>{t.duo.errors[error]}</Body> : null}

      {/* Duo */}
      <Rule style={{ marginTop: 24 }} />
      {partner ? (
        <View style={[styles.card, { marginTop: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Companion speciesId={partner.companionSpecies} stage={partner.stage} health={partner.health} status={partner.status} size={72} breathing={false} />
            <View style={{ flex: 1, gap: 2 }}>
              <Serif size={26} italic>
                {partner.name}
              </Serif>
              <Label small>
                {partner.status === 'alive' ? t.duo.partnerCompanion(partner.companionName, partner.health) : t.duo.partnerDead(partner.companionName)}
              </Label>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <View style={{ gap: 2 }}>
              <Label small>{t.duo.you}</Label>
              <Text style={styles.vs}>{d.streak}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Label small>{partner.name}</Label>
              <Text style={styles.vs}>{partner.streak}</Text>
            </View>
          </View>
          <Label small>{t.duo.streakLabel}</Label>
          <GhostButton
            label={snapshot.cheeredToday ? t.duo.cheered : t.duo.cheer}
            disabled={snapshot.cheeredToday || busy}
            onPress={() => run(() => social.sendCheer(realToday()))}
          />
          <TextLink
            label={t.duo.leave}
            onPress={async () => {
              if (await confirm(t.duo.leave, t.duo.leaveConfirm, t.duo.leave)) run(social.leaveDuo);
            }}
          />
        </View>
      ) : (
        <View style={{ marginTop: 20, gap: 12 }}>
          <Field label={t.duo.partnerCode} value={partnerCode} onChangeText={(v) => setPartnerCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} />
          <PrimaryButton
            label={t.duo.join}
            disabled={partnerCode.trim().length < 6 || busy}
            onPress={async () => {
              if (await run(() => social.joinDuo(partnerCode))) setPartnerCode('');
            }}
          />
        </View>
      )}

      {/* My witnesses */}
      <Rule style={{ marginTop: 28 }} />
      <View style={{ paddingTop: 16, gap: 10 }}>
        <Label small>{t.duo.myWitnesses}</Label>
        <Body muted>{t.duo.witnessesIntro}</Body>
        {snapshot.witnesses.length === 0 ? <Body muted>{t.duo.noWitnesses}</Body> : null}
        {snapshot.witnesses.map((w) => (
          <View key={w.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Serif size={20}>{w.name}</Serif>
              {!w.accepted ? <Label small style={{ color: colors.accent }}>{t.duo.pending}</Label> : null}
            </View>
            {!w.accepted ? (
              <>
                <TextLink label={t.duo.accept} onPress={() => run(() => social.respondWitness(w.id, true))} style={styles.inlineLink} />
                <TextLink label={t.duo.decline} onPress={() => run(() => social.respondWitness(w.id, false))} style={styles.inlineLink} />
              </>
            ) : (
              <TextLink label={t.duo.remove} onPress={() => run(() => social.removeWitnessLink(w.id))} style={styles.inlineLink} />
            )}
          </View>
        ))}
      </View>

      {/* People I watch */}
      <Rule style={{ marginTop: 28 }} />
      <View style={{ paddingTop: 16, gap: 10 }}>
        <Label small>{t.duo.watching}</Label>
        {snapshot.watching.map((w) => (
          <View key={w.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Serif size={20}>{w.name}</Serif>
              <Label small style={w.reportedToday ? { color: colors.danger } : undefined}>
                {!w.accepted ? t.duo.waitingAccept : w.reportedToday ? t.duo.reported : t.duo.partnerCompanion(w.companionName, w.health)}
              </Label>
            </View>
            {w.accepted && !w.reportedToday ? (
              <TextLink
                label={t.duo.sawSmoking}
                onPress={async () => {
                  if (await confirm(t.duo.sawSmoking, t.duo.sawConfirm(w.name), t.duo.sawSmoking)) run(() => social.reportSmoking(w.id, realToday()));
                }}
                style={styles.inlineLink}
              />
            ) : null}
            <TextLink label="×" onPress={() => run(() => social.removeWitnessLink(w.id))} style={[styles.inlineLink, { paddingHorizontal: 8 }]} />
          </View>
        ))}
        <Field label={t.duo.theirCode} value={ownerCode} onChangeText={(v) => setOwnerCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} />
        <GhostButton
          label={t.duo.becomeWitness}
          disabled={ownerCode.trim().length < 6 || busy}
          onPress={async () => {
            if (await run(() => social.requestWitness(ownerCode))) setOwnerCode('');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.hairline, backgroundColor: 'rgba(20,18,16,0.45)' },
  code: { fontFamily: fonts.monoMedium, fontSize: 34, letterSpacing: 8, color: colors.ink },
  vs: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  inlineLink: { alignSelf: 'auto' },
});
