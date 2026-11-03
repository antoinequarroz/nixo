import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, type } from '../theme';
import { GrainBackground, GrainOverlay } from './Grain';

type Variant = Parameters<typeof GrainBackground>[0]['variant'];

/** Full screen with grain background, safe areas and a readable max width. */
export function Screen({
  children,
  variant,
  scroll = true,
  wide = false,
}: {
  children: ReactNode;
  variant?: Variant;
  scroll?: boolean;
  /** Allow the content to use the full width (two-pane layouts). */
  wide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxWidth = wide ? 1100 : 560;
  const content = (
    <View
      style={{
        flexGrow: 1,
        width: '100%',
        maxWidth,
        alignSelf: 'center',
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: width < 360 ? 18 : 24,
      }}
    >
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <GrainBackground variant={variant} />
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
      <GrainOverlay strong={variant === 'dead'} />
    </View>
  );
}

export function Label({
  children,
  style,
  small,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  small?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[small ? type.smallLabel : type.label, style]}>
      {children}
    </Text>
  );
}

export function HeaderRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 }}>
      {typeof left === 'string' ? <Label>{left}</Label> : left}
      {typeof right === 'string' ? <Label>{right}</Label> : right}
    </View>
  );
}

/** Magazine headline: a light serif line, then an italic one. */
export function Headline({ line1, italic, size = 60, color }: { line1: string; italic?: string; size?: number; color?: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ fontFamily: fonts.serif, fontSize: size, lineHeight: size * 0.98, letterSpacing: -size * 0.02, color: color ?? colors.ink }}
    >
      {line1}
      {italic ? (
        <>
          {'\n'}
          <Text style={{ fontFamily: fonts.serifItalic, color: color ? colors.deadMuted : colors.inkItalic }}>{italic}</Text>
        </>
      ) : null}
    </Text>
  );
}

export function Serif({ children, size = 26, italic, style }: { children: ReactNode; size?: number; italic?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: italic ? fonts.serifRegularItalic : fonts.serifRegular, fontSize: size, color: colors.ink }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, muted }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[type.body, muted && { color: colors.muted, fontSize: 14, lineHeight: 20 }, style]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  dead,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  dead?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: dead ? colors.deadInk : colors.ink, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.primaryText, { color: dead ? colors.groundDead : colors.ground }]}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.ghost, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}
    >
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress, color, style }: { label: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12} style={[{ alignSelf: 'center', paddingVertical: 10 }, style]}>
      <Text style={[styles.link, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.hairline }, style]} />;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Label small>{label}</Label>
      <TextInput
        placeholderTextColor="rgba(237,230,218,0.35)"
        selectionColor={colors.accent}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

/** Minus / value / plus control for small numbers. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <View style={styles.stepper}>
      <Body style={{ flex: 1 }}>{label}</Body>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} −`}
        onPress={() => onChange(Math.max(min, round(value - step)))}
        style={styles.stepBtn}
        hitSlop={6}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Serif size={22} style={{ minWidth: 76, textAlign: 'center' }}>
        {format ? format(value) : value}
      </Serif>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} +`}
        onPress={() => onChange(Math.min(max, round(value + step)))}
        style={styles.stepBtn}
        hitSlop={6}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

/** Bottom sheet on phones, centered card on wide screens. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }]}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 24, width: wide ? 440 : '100%' },
            wide && { borderRadius: 24 },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  primary: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryText: { fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.2 },
  ghost: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(237,230,218,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  ghostText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
  link: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  input: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    color: colors.ink,
    fontFamily: fonts.serifRegular,
    fontSize: 24,
    paddingVertical: 6,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.ink, fontSize: 20, fontFamily: fonts.sans },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1C1916',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
});
