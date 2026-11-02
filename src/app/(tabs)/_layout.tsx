import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../../i18n';
import { colors, fonts } from '../../theme';

const LABELS: Record<string, string> = {
  home: t.tabs.home,
  lineage: t.tabs.lineage,
  savings: t.tabs.savings,
  duo: t.tabs.duo,
};

/** Editorial tab bar: mono labels on a hairline, no icons. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={styles.tab}
          >
            <View style={[styles.dot, { opacity: focused ? 1 : 0 }]} />
            <Text style={[styles.label, { color: focused ? colors.ink : colors.muted }]}>{LABELS[route.name] ?? route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="lineage" />
      <Tabs.Screen name="savings" />
      <Tabs.Screen name="duo" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#100E0C',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 6, minHeight: 44, justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
});
