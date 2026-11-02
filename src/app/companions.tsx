import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Companion } from '../components/Companion';
import { IconButton } from '../components/IconButton';
import { Body, Field, HeaderRow, Headline, Label, PrimaryButton, Rule, Screen, Serif, Sheet } from '../components/ui';
import { adopt, setActive, unlockSpecies } from '../domain/engine';
import { PRICES, stageIndex } from '../domain/rules';
import { SPECIES } from '../domain/species';
import { formatMoney, t } from '../i18n';
import { purchase } from '../services/purchases';
import { useGame } from '../state/GameProvider';
import { livedDays } from '../state/derived';
import { colors } from '../theme';

export default function Companions() {
  const { state, now, update } = useGame();
  const params = useLocalSearchParams<{ adopt?: string }>();
  const [adopting, setAdopting] = useState(params.adopt === '1');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('ember');
  const currency = state.profile?.currency ?? 'CHF';

  const living = state.companions.filter((c) => c.status !== 'buried');
  const buried = state.companions.filter((c) => c.status === 'buried');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const pickSpecies = async (id: string) => {
    if (state.ownedSpecies.includes(id)) return setSpecies(id);
    const ok = await purchase(t.species[id], PRICES.species, currency);
    if (ok) {
      update((s) => unlockSpecies(s, id));
      setSpecies(id);
    }
  };

  const confirmAdopt = () => {
    update((s, n) => adopt(s, n, name, species));
    setName('');
    setAdopting(false);
    router.replace('/home');
  };

  return (
    <Screen variant="quiet">
      <HeaderRow left={t.companions.header} right={<IconButton icon="close" label={t.common.close} onPress={close} />} />
      <View style={{ marginTop: 8, marginBottom: 20 }}>
        <Headline line1={t.companions.title} italic={t.companions.titleItalic} size={48} />
      </View>

      <View style={{ gap: 4 }}>
        {living.map((c) => {
          const active = c.id === state.activeId;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                update((s) => setActive(s, c.id));
                router.replace('/home');
              }}
              style={[styles.row, active && styles.rowActive]}
            >
              <Companion speciesId={c.speciesId} stage={stageIndex(c.cleanDays)} health={c.health} status={c.status} size={72} breathing={false} />
              <View style={{ flex: 1, gap: 2 }}>
                <Serif size={22} italic>
                  {c.name}
                </Serif>
                <Label small>
                  {`${t.species[c.speciesId]} · ${t.stages[stageIndex(c.cleanDays)]} · ${c.status === 'alive' ? `${c.health} %` : t.companions.status[c.status]}`}
                </Label>
              </View>
              <Label small style={{ color: active ? colors.accent : colors.muted }}>
                {active ? t.companions.active : t.companions.choose}
              </Label>
            </Pressable>
          );
        })}
      </View>

      <Body muted style={{ marginTop: 14 }}>
        {t.companions.rule}
      </Body>
      <PrimaryButton style={{ marginTop: 18 }} label={t.companions.adopt} onPress={() => setAdopting(true)} />

      {buried.length > 0 ? (
        <>
          <Rule style={{ marginTop: 28 }} />
          <Label small style={{ marginTop: 16, marginBottom: 8 }}>
            {t.companions.memorial}
          </Label>
          {buried.map((c) => (
            <View key={c.id} style={styles.grave}>
              <Serif size={20} italic style={{ color: colors.deadInk }}>
                {c.name}
              </Serif>
              <Label small style={{ color: colors.deadMuted }}>
                {t.grave.lived(livedDays(c, now))}
              </Label>
            </View>
          ))}
        </>
      ) : null}

      <Sheet visible={adopting} onClose={() => setAdopting(false)}>
        <Serif size={28}>{t.companions.adopt}</Serif>
        <Label small>{t.companions.species}</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {SPECIES.map((sp) => {
            const owned = state.ownedSpecies.includes(sp.id);
            const selected = species === sp.id;
            return (
              <Pressable
                key={sp.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={owned ? t.species[sp.id] : `${t.species[sp.id]}, ${t.companions.locked(formatMoney(PRICES.species, currency))}`}
                onPress={() => pickSpecies(sp.id)}
                style={[styles.species, selected && { borderColor: sp.accent }]}
              >
                <Companion speciesId={sp.id} stage={2} health={100} status="alive" size={56} breathing={false} />
                <Label small style={{ color: owned ? colors.ink : colors.muted }}>
                  {t.species[sp.id]}
                </Label>
                {!owned ? <Label small style={{ fontSize: 9 }}>{formatMoney(PRICES.species, currency)}</Label> : null}
              </Pressable>
            );
          })}
        </View>
        <Field label={t.companions.name} placeholder={t.companions.namePlaceholder} value={name} onChangeText={setName} maxLength={24} />
        <PrimaryButton label={t.companions.adoptConfirm} disabled={!name.trim() || !state.ownedSpecies.includes(species)} onPress={confirmAdopt} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 16, minHeight: 88 },
  rowActive: { backgroundColor: 'rgba(237,230,218,0.06)' },
  grave: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  species: {
    width: 76,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
});
