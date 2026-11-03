import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import type { CompanionStatus } from '../domain/types';
import { getSpecies } from '../domain/species';

interface Props {
  speciesId: string;
  stage: number;
  health: number;
  status: CompanionStatus;
  size?: number;
  /** "ghost" = a future form, drawn as a dark silhouette. */
  ghost?: boolean;
  breathing?: boolean;
  /** Breathing exercise: drives the scale from outside. */
  scale?: Animated.Value;
}

// Body size per stage, relative to the drawing box.
const STAGE_SIZE = [
  { w: 0.36, h: 0.44 },
  { w: 0.5, h: 0.5 },
  { w: 0.66, h: 0.7 },
  { w: 0.76, h: 0.78 },
  { w: 0.82, h: 0.84 },
  { w: 0.84, h: 0.86 },
];

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function blobPath(cx: number, top: number, w: number, h: number): string {
  const r = cx + w / 2;
  const l = cx - w / 2;
  const b = top + h;
  return [
    `M ${cx} ${top}`,
    `C ${cx + 0.34 * w} ${top} ${r} ${top + 0.28 * h} ${r} ${top + 0.55 * h}`,
    `C ${r} ${top + 0.82 * h} ${cx + 0.3 * w} ${b} ${cx} ${b}`,
    `C ${cx - 0.3 * w} ${b} ${l} ${top + 0.82 * h} ${l} ${top + 0.55 * h}`,
    `C ${l} ${top + 0.28 * h} ${cx - 0.34 * w} ${top} ${cx} ${top} Z`,
  ].join(' ');
}

export function Companion({ speciesId, stage, health, status, size = 240, ghost, breathing = true, scale }: Props) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const species = getSpecies(speciesId);
  const dead = status !== 'alive';

  // The lower the health, the greyer and more tired it looks.
  const fade = dead ? 1 : Math.max(0, Math.min(1, (60 - health) / 60)) * 0.75;
  const accent = mix(species.accent, '#6E6862', fade);
  const deep = mix(species.deep, '#2A2724', fade);
  const light = mix('#F1D9B8', '#9A948C', fade);

  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!breathing || dead || ghost || scale) return;
    const duration = health < 30 ? 4200 : 3000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(breath, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathing, dead, ghost, health, scale, breath]);

  const animatedScale = scale ?? breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  const S = 200;
  const cx = 100;
  const dims = STAGE_SIZE[Math.min(stage, STAGE_SIZE.length - 1)];
  const w = dims.w * S;
  const h = dims.h * S * (dead ? 0.82 : 1);
  const bottom = 176;
  const top = bottom - h;
  const eyeY = top + h * (stage === 0 ? 0.6 : 0.53);
  const eyeDx = w * 0.13;
  const eyeR = Math.max(2.4, w * 0.032);

  const crest = !ghost && stage >= 1 ? renderCrest(species.crest, cx, top, w, h, stage, mix(deep, accent, 0.35), accent) : null;

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Animated.View style={{ width: size, height: size, transform: [{ scale: animatedScale }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${S} ${S}`}>
          <Defs>
            <RadialGradient id={`body${id}`} cx="0.42" cy="0.32" r="0.75">
              {(dead
                ? [['0', '#9A948C'], ['0.6', '#4A4640'], ['1', '#1E1C1A']]
                : ghost
                  ? [['0', '#4A433B'], ['1', '#211D19']]
                  : [['0', light], ['0.35', accent], ['0.8', deep], ['1', '#1B0F0C']]
              ).map(([offset, color]) => (
                <Stop key={offset} offset={offset} stopColor={color} />
              ))}
            </RadialGradient>
            <RadialGradient id={`halo${id}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={accent} stopOpacity={0.5} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`shadow${id}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {!dead && !ghost && health >= 30 ? (
            // Kept inside the drawing box so the glow never shows a hard edge.
            <Circle cx={cx} cy={Math.min(100, top + h * 0.5)} r={Math.min(w * 0.95, 99)} fill={`url(#halo${id})`} />
          ) : null}
          {!ghost ? <Ellipse cx={cx} cy={bottom + 4} rx={w * 0.5} ry={7} fill={`url(#shadow${id})`} /> : null}

          {stage >= 3 && !ghost ? (
            <G>
              <Ellipse cx={cx - w * 0.5} cy={top + h * 0.66} rx={w * 0.09} ry={h * 0.06} fill={deep} transform={`rotate(-25 ${cx - w * 0.5} ${top + h * 0.66})`} />
              <Ellipse cx={cx + w * 0.5} cy={top + h * 0.66} rx={w * 0.09} ry={h * 0.06} fill={deep} transform={`rotate(25 ${cx + w * 0.5} ${top + h * 0.66})`} />
            </G>
          ) : null}

          {stage >= 2 && !ghost ? (
            <G>
              <Ellipse cx={cx - w * 0.2} cy={bottom - 1} rx={w * 0.11} ry={h * 0.045} fill={deep} />
              <Ellipse cx={cx + w * 0.2} cy={bottom - 1} rx={w * 0.11} ry={h * 0.045} fill={deep} />
            </G>
          ) : null}
          {crest}
          <Path d={blobPath(cx, top, w, h)} fill={`url(#body${id})`} />

          {!ghost && !dead ? (
            <Path
              d={`M ${cx - w * 0.3} ${top + h * 0.33} C ${cx - w * 0.24} ${top + h * 0.2} ${cx - w * 0.12} ${top + h * 0.16} ${cx - w * 0.02} ${top + h * 0.17}`}
              stroke="#F7E9D3"
              strokeWidth={1.4}
              strokeLinecap="round"
              fill="none"
              opacity={0.45 * (1 - fade)}
            />
          ) : null}

          {stage >= 4 && !ghost && !dead ? (
            <G opacity={0.55}>
              <Circle cx={cx + w * 0.22} cy={top + h * 0.74} r={2.2} fill={light} />
              <Circle cx={cx + w * 0.28} cy={top + h * 0.66} r={1.6} fill={light} />
              <Circle cx={cx - w * 0.25} cy={top + h * 0.76} r={1.8} fill={light} />
            </G>
          ) : null}
          {stage >= 5 && !ghost && !dead ? (
            <Circle cx={cx} cy={top + h * 0.5} r={w * 0.68} fill="none" stroke={accent} strokeWidth={1} strokeDasharray="2 5" opacity={0.8} />
          ) : null}

          {!ghost ? renderEyes({ cx, eyeY, eyeDx, eyeR, health, dead, seed: stage === 0 }) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

function renderEyes(p: { cx: number; eyeY: number; eyeDx: number; eyeR: number; health: number; dead: boolean; seed: boolean }) {
  const { cx, eyeY, eyeDx, eyeR, health, dead, seed } = p;
  const xs = [cx - eyeDx, cx + eyeDx];
  if (dead || seed) {
    // Closed eyes: asleep (seed) or gone out (dead).
    return xs.map((x) => (
      <Path
        key={x}
        d={`M ${x - eyeR * 1.6} ${eyeY} Q ${x} ${eyeY + eyeR * 1.4} ${x + eyeR * 1.6} ${eyeY}`}
        stroke={dead ? '#1A1816' : '#2A1510'}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    ));
  }
  const tired = health < 60;
  const low = health < 30;
  return xs.map((x, i) => (
    <G key={x}>
      <Ellipse cx={x} cy={eyeY + (low ? eyeR * 0.4 : 0)} rx={eyeR} ry={eyeR * (low ? 0.55 : tired ? 0.9 : 1.4)} fill="#1A0D0A" />
      {!tired ? <Circle cx={x + eyeR * 0.3} cy={eyeY - eyeR * 0.5} r={eyeR * 0.32} fill="#F7E9D3" /> : null}
      {tired ? (
        // Heavy eyelid, tilted outward when health is low.
        <Path
          d={`M ${x - eyeR * 1.5} ${eyeY - eyeR * (low ? 0.2 : 0.7) + (i === 0 ? -1 : 1) * (low ? 1.5 : 0)} L ${x + eyeR * 1.5} ${eyeY - eyeR * (low ? 0.2 : 0.7) + (i === 0 ? 1 : -1) * (low ? 1.5 : 0)}`}
          stroke="#2A1510"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ) : null}
    </G>
  ));
}

function renderCrest(kind: string, cx: number, top: number, w: number, h: number, stage: number, deep: string, accent: string) {
  const grow = 0.6 + stage * 0.12;
  const sw = Math.max(2.5, w * 0.045);
  const lx = cx - w * 0.17;
  const rx = cx + w * 0.17;
  const y = top + h * 0.07;
  const hh = h * 0.17 * grow;
  switch (kind) {
    case 'leaves':
      return (
        <G>
          <Path d={`M ${lx} ${y + 2} C ${lx - hh * 0.9} ${y - hh * 0.3} ${lx - hh * 0.7} ${y - hh * 1.3} ${lx - hh * 0.2} ${y - hh * 1.4} C ${lx} ${y - hh * 0.8} ${lx + 2} ${y - hh * 0.3} ${lx} ${y + 2} Z`} fill={deep} />
          <Path d={`M ${rx} ${y + 2} C ${rx + hh * 0.9} ${y - hh * 0.3} ${rx + hh * 0.7} ${y - hh * 1.3} ${rx + hh * 0.2} ${y - hh * 1.4} C ${rx} ${y - hh * 0.8} ${rx - 2} ${y - hh * 0.3} ${rx} ${y + 2} Z`} fill={deep} />
        </G>
      );
    case 'wisps':
      return (
        <G>
          {[-0.18, 0, 0.18].map((dx, i) => (
            <Path
              key={dx}
              d={`M ${cx + dx * w} ${top + h * 0.05} q ${-hh * 0.4} ${-hh * 0.5} 0 ${-hh} q ${hh * 0.4} ${-hh * 0.4} 0 ${-hh * (i === 1 ? 0.8 : 0.5)}`}
              stroke={accent}
              strokeWidth={sw * 0.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.8}
            />
          ))}
        </G>
      );
    case 'nubs':
      return (
        <G>
          {[-0.2, 0, 0.2].map((dx) => (
            <Circle key={dx} cx={cx + dx * w} cy={top + h * 0.03 - (dx === 0 ? hh * 0.25 : 0)} r={hh * 0.45} fill={deep} />
          ))}
        </G>
      );
    default:
      // Horns, as in the direction E mockup.
      return (
        <G>
          <Path d={`M ${lx + 3} ${y + 4} C ${lx - hh * 0.5} ${y - hh} ${lx + hh * 0.1} ${y - hh * 1.6} ${lx + hh * 0.6} ${y - hh * 0.9}`} stroke={deep} strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Path d={`M ${rx - 3} ${y + 4} C ${rx + hh * 0.5} ${y - hh} ${rx - hh * 0.1} ${y - hh * 1.6} ${rx - hh * 0.6} ${y - hh * 0.9}`} stroke={deep} strokeWidth={sw} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}
