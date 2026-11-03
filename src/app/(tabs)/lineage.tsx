import { View, useWindowDimensions } from 'react-native';

import { Companion } from '../../components/Companion';
import { Body, HeaderRow, Headline, Label, Screen, Serif } from '../../components/ui';
import { STAGES } from '../../domain/rules';
import { t } from '../../i18n';
import { useDerived } from '../../state/derived';
import { colors } from '../../theme';

export default function Lineage() {
  const d = useDerived();
  const { width } = useWindowDimensions();
  const c = d.companion;
  if (!c) return null;
  const done = c.cleanDays;

  return (
    <Screen variant="lineage">
      <HeaderRow left={t.lineage.header(c.name)} right={`${d.stage + 1} / ${STAGES.length}`} />
      <View style={{ marginTop: 16, marginBottom: 28 }}>
        <Headline line1={t.lineage.title} italic={t.lineage.titleItalic} size={width < 370 ? 46 : 52} />
      </View>

      <View>
        {STAGES.map((s, i) => {
          const reached = i <= d.stage;
          const current = i === d.stage;
          const daysLeft = s.day - done;
          const label = current
            ? t.lineage.current(s.day)
            : reached
              ? t.lineage.reached(s.day)
              : i === d.stage + 1
                ? t.lineage.inDays(s.day, daysLeft)
                : i === STAGES.length - 2
                  ? `${t.lineage.day(s.day)} · ${t.lineage.ultimate}`
                  : t.lineage.day(s.day);
          const name = reached ? t.stages[i] : i === STAGES.length - 1 ? '—' : t.lineage.unknown;
          return (
            <View key={s.key} style={{ flexDirection: 'row', gap: 18, minHeight: current ? 118 : 86 }}>
              {/* Timeline column */}
              <View style={{ width: 72, alignItems: 'center' }}>
                <View style={{ position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: reached && !current ? colors.accent : colors.hairline }} />
                <View style={{ marginTop: 6 }}>
                  <Companion
                    speciesId={c.speciesId}
                    stage={i}
                    health={reached ? Math.max(c.health, 60) : 100}
                    status="alive"
                    ghost={!reached}
                    breathing={current}
                    size={current ? 84 : 64}
                  />
                </View>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 3, paddingVertical: 8 }}>
                <Label small style={current ? { color: colors.accent } : undefined}>
                  {label}
                </Label>
                <Serif size={current ? 26 : 20} italic={current} style={!reached ? { color: colors.muted } : undefined}>
                  {name}
                </Serif>
                {reached ? (
                  <Body muted style={{ fontSize: 13 }}>
                    {t.stageNotes[i]}
                  </Body>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
