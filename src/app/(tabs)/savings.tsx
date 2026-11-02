import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Body, Field, GhostButton, HeaderRow, Label, PrimaryButton, Rule, Screen, Serif, Sheet } from '../../components/ui';
import { setGoal } from '../../domain/engine';
import { formatAmount, formatDay, formatMoney, t } from '../../i18n';
import { useGame } from '../../state/GameProvider';
import { useDerived } from '../../state/derived';
import { colors, fonts } from '../../theme';

export default function Savings() {
  const { state, update } = useGame();
  const d = useDerived();
  const { width } = useWindowDimensions();
  const v = d.savings;
  const cur = d.currency;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(state.goal?.label ?? '');
  const [price, setPrice] = useState(state.goal ? String(state.goal.price) : '');

  const chartW = Math.min(width, 560) - 48;
  const chartH = 120;
  const series = v.series.length > 1 ? v.series : [{ day: d.today, total: 0 }, ...v.series];
  const max = Math.max(state.goal?.price ?? 0, ...series.map((p) => p.total), v.perDay * 7, 1);
  const points = series
    .map((p, i) => `${(i / Math.max(1, series.length - 1)) * (chartW - 6)},${chartH - 4 - (p.total / max) * (chartH - 12)}`)
    .join(' ');
  const last = series[series.length - 1];
  const lastX = chartW - 6;
  const lastY = chartH - 4 - (last.total / max) * (chartH - 12);
  const goalY = state.goal ? chartH - 4 - (state.goal.price / max) * (chartH - 12) : null;

  const saveGoal = () => {
    const p = parseFloat(price.replace(',', '.'));
    if (!label.trim() || !(p > 0)) return;
    update((s) => setGoal(s, { label: label.trim(), price: p }));
    setEditing(false);
  };

  const amount = formatAmount(v.saved);

  return (
    <Screen variant="savings">
      <HeaderRow left={t.savings.header} right={state.profile ? t.savings.since(formatDay(state.profile.startDay)) : ''} />

      <View style={{ marginTop: 20 }}>
        <Text
          style={{ fontFamily: fonts.serif, fontSize: width < 370 ? 76 : 92, lineHeight: width < 370 ? 76 : 92, letterSpacing: -2, color: colors.ink }}
          accessibilityRole="header"
        >
          {amount}
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 34, color: colors.inkItalic }}> {cur}</Text>
        </Text>
        <Body muted style={{ marginTop: 8 }}>
          {t.savings.perDay(formatMoney(v.perDay, cur))}
        </Body>
      </View>

      <View style={{ marginTop: 22 }} accessible accessibilityLabel={t.savings.chartLabel(series.length, formatMoney(v.saved, cur))}>
        <Svg width={chartW} height={chartH}>
          <Line x1={0} y1={chartH - 1} x2={chartW} y2={chartH - 1} stroke={colors.ink} strokeOpacity={0.22} />
          {goalY != null ? <Line x1={0} y1={goalY} x2={chartW} y2={goalY} stroke={colors.ink} strokeOpacity={0.35} strokeDasharray="2 4" /> : null}
          <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} />
          <Circle cx={lastX} cy={lastY} r={4} fill={colors.accent} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Label small>{state.profile ? formatDay(state.profile.startDay) : ''}</Label>
          <Label small>{formatDay(d.today)}</Label>
        </View>
      </View>

      <Rule style={{ marginTop: 22 }} />
      <View style={{ paddingTop: 16, gap: 10 }}>
        <Label small>{t.savings.goal}</Label>
        {state.goal ? (
          <>
            <Serif size={26} italic>
              {state.goal.label}
            </Serif>
            <View style={{ height: 2, backgroundColor: 'rgba(237,230,218,0.18)' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((v.goalProgress ?? 0) * 100) }}>
              <View style={{ width: `${(v.goalProgress ?? 0) * 100}%`, height: 2, backgroundColor: colors.accent }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Body muted>{t.savings.goalProgress(formatMoney(Math.min(v.saved, state.goal.price), cur), formatMoney(state.goal.price, cur))}</Body>
              <Body muted>{(v.goalProgress ?? 0) >= 1 ? t.savings.goalDone : v.goalEta ? t.savings.goalEta(formatDay(v.goalEta, true)) : ''}</Body>
            </View>
          </>
        ) : (
          <Body muted>{t.savings.noGoal}</Body>
        )}
      </View>

      <Rule style={{ marginTop: 18 }} />
      <View style={{ paddingTop: 16 }}>
        <Label small style={{ marginBottom: 6 }}>
          {t.savings.projection}
        </Label>
        {[
          [t.savings.in1m, 30],
          [t.savings.in6m, 182],
          [t.savings.in1y, 365],
        ].map(([lbl, days], i) => (
          <View
            key={lbl}
            style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: colors.hairlineSoft }}
          >
            <Body style={{ fontSize: 14 }}>{lbl}</Body>
            <Serif size={18}>{formatMoney(v.perDay * (days as number), cur)}</Serif>
          </View>
        ))}
      </View>

      <GhostButton
        style={{ marginTop: 24 }}
        label={state.goal ? t.savings.changeGoal : t.savings.setGoal}
        onPress={() => {
          setLabel(state.goal?.label ?? '');
          setPrice(state.goal ? String(state.goal.price) : '');
          setEditing(true);
        }}
      />

      <Sheet visible={editing} onClose={() => setEditing(false)}>
        <Serif size={28}>{t.savings.goal}</Serif>
        <Field label={t.savings.goalLabel} placeholder={t.savings.goalLabelPlaceholder} value={label} onChangeText={setLabel} />
        <Field label={`${t.savings.goalPrice} (${cur})`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="450" />
        <PrimaryButton label={t.common.save} onPress={saveGoal} disabled={!label.trim() || !(parseFloat(price.replace(',', '.')) > 0)} />
      </Sheet>
    </Screen>
  );
}
