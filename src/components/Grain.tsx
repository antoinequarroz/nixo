import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme';

type Variant = 'home' | 'lineage' | 'savings' | 'dead' | 'quiet';

// Soft colour blobs, positioned on a 390×844 phone frame and scaled to cover any screen.
const BLOBS: Record<Variant, { x: number; y: number; r: number; color: string; o: number }[]> = {
  home: [
    { x: 40, y: 160, r: 260, color: colors.blobOxblood, o: 0.9 },
    { x: 360, y: 420, r: 240, color: colors.blobTeal, o: 0.85 },
    { x: 120, y: 760, r: 220, color: colors.blobOchre, o: 0.6 },
  ],
  lineage: [
    { x: 360, y: 120, r: 260, color: colors.blobTeal, o: 0.8 },
    { x: 20, y: 520, r: 240, color: colors.blobOxblood, o: 0.85 },
    { x: 300, y: 800, r: 220, color: colors.blobOchre, o: 0.55 },
  ],
  savings: [
    { x: 330, y: 200, r: 260, color: colors.blobOchre, o: 0.75 },
    { x: 40, y: 620, r: 240, color: colors.blobTeal, o: 0.8 },
  ],
  dead: [{ x: 195, y: 330, r: 240, color: '#2A2724', o: 1 }],
  quiet: [
    { x: 380, y: 60, r: 220, color: colors.blobOxblood, o: 0.55 },
    { x: 0, y: 820, r: 220, color: colors.blobTeal, o: 0.5 },
  ],
};

export function GrainBackground({ variant = 'home', children }: { variant?: Variant; children?: ReactNode }) {
  const blobs = BLOBS[variant];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: variant === 'dead' ? colors.groundDead : colors.ground }]}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Defs>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`blob${variant}${i}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={b.color} stopOpacity={b.o} />
              <Stop offset="0.45" stopColor={b.color} stopOpacity={b.o * 0.55} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b, i) => (
          <Circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#blob${variant}${i})`} />
        ))}
      </Svg>
      {children}
    </View>
  );
}

/** Film grain laid over everything, including the companion. */
export function GrainOverlay({ strong }: { strong?: boolean }) {
  return (
    <Image
      source={require('../../assets/grain.png')}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: strong ? 0.5 : 0.35 }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
