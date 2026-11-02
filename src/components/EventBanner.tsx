import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stageIndex } from '../domain/rules';
import { t } from '../i18n';
import { useGame } from '../state/GameProvider';
import { colors, fonts } from '../theme';
import { Label } from './ui';

const SHOWN = new Set(['evolved', 'revived', 'goalReached', 'frozen', 'reported', 'cheered']);

export function useHasEvent(): boolean {
  const { state } = useGame();
  return state.events.some((e) => SHOWN.has(e.kind));
}

/** Shows the latest notable event (evolution, revival, goal...) once, until dismissed. */
export function EventBanner() {
  const { state, update } = useGame();
  const relevant = state.events.filter((e) => SHOWN.has(e.kind));
  const event = relevant[relevant.length - 1];
  if (!event) return null;
  const c = state.companions.find((x) => x.id === event.companionId);
  let text = '';
  switch (event.kind) {
    case 'evolved':
      text = c ? t.events.evolved(c.name, t.stages[stageIndex(c.cleanDays)]) : '';
      break;
    case 'revived':
      text = c ? t.events.revived(c.name) : '';
      break;
    case 'goalReached':
      text = state.goal ? t.events.goalReached(state.goal.label) : '';
      break;
    case 'frozen':
      text = t.events.frozen;
      break;
    case 'reported': {
      const active = state.companions.find((x) => x.id === state.activeId);
      text = t.events.reported(event.who ?? '', active?.name ?? '');
      break;
    }
    case 'cheered':
      text = t.events.cheered(event.who ?? '');
      break;
  }
  if (!text) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t.common.close}
      onPress={() => update((s) => ({ ...s, events: [] }))}
      style={styles.banner}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{text}</Text>
      <Label small>{t.common.close}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(20,18,16,0.6)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  text: { flex: 1, color: colors.ink, fontFamily: fonts.serifRegularItalic, fontSize: 17, lineHeight: 22 },
});
