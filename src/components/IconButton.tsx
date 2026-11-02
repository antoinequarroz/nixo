import { Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

type Icon = 'settings' | 'close' | 'back';

export function IconButton({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.4} strokeLinecap="round">
        {icon === 'settings' ? (
          <>
            <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <Circle cx={16} cy={7} r={2} />
            <Circle cx={8} cy={17} r={2} />
          </>
        ) : icon === 'close' ? (
          <Path d="M6 6l12 12M18 6L6 18" />
        ) : (
          <Path d="M15 5l-7 7 7 7" />
        )}
      </Svg>
    </Pressable>
  );
}
