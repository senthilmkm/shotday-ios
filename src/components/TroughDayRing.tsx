import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import type { TroughDayState, TroughPhase } from '../domain/troughDay';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TroughDayRingProps {
  state: TroughDayState;
  onPress?: () => void;
  onShare?: () => void;
  size?: number;
}

function accentForPhase(phase: TroughPhase, primary: string, warning: string, muted: string): string {
  switch (phase) {
    case 'SHOT_DAY':
    case 'PEAK':
      return primary;
    case 'STEADY':
      return primary;
    case 'TROUGH':
    case 'PRE_SHOT':
      return warning;
    case 'OVERDUE':
      return warning;
    case 'NO_DATA':
    default:
      return muted;
  }
}

/**
 * Free Home hero: named cycle day + ring fill. No mg values.
 */
export function TroughDayRing({
  state,
  onPress,
  onShare,
  size = 168,
}: TroughDayRingProps): React.ReactElement {
  const theme = useTheme();
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, state.ringFill)), { duration: 700 });
  }, [progress, state.ringFill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const accent = accentForPhase(
    state.phase,
    theme.colors.primary,
    theme.colors.warning,
    theme.colors.textMuted,
  );

  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: accent + '55',
          borderRadius: theme.radii.xl,
          marginBottom: onPress ? 0 : 14,
        },
      ]}
    >
      <Text
        style={[
          theme.typography.captionMedium,
          { color: accent, letterSpacing: 0.6, fontSize: 11 },
        ]}
      >
        {state.badge}
      </Text>

      <View style={[styles.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.colors.surfaceMuted}
              strokeWidth={stroke}
              fill="none"
            />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={accent}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={animatedProps}
            />
          </G>
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerLabel]}>
          <Text
            allowFontScaling={false}
            style={[theme.typography.captionMedium, { color: theme.colors.textMuted, fontSize: 11 }]}
          >
            {state.isTroughDay ? 'Hungry day' : 'Cycle'}
          </Text>
          <Text
            allowFontScaling={false}
            style={[
              theme.typography.heading,
              {
                color: theme.colors.text,
                fontSize: state.isTroughDay ? 22 : 18,
                textAlign: 'center',
                marginTop: 2,
              },
            ]}
          >
            {state.isTroughDay
              ? state.weekdayLabel ?? 'Trough'
              : state.phase === 'SHOT_DAY'
                ? 'Full'
                : state.phase === 'NO_DATA'
                  ? '—'
                  : `${Math.round(state.ringFill * 100)}%`}
          </Text>
        </View>
      </View>

      <Text
        style={[
          theme.typography.heading,
          { color: theme.colors.text, textAlign: 'center', marginTop: 4 },
        ]}
      >
        {state.headline}
      </Text>
      <Text
        style={[
          theme.typography.caption,
          {
            color: theme.colors.textMuted,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 18,
            paddingHorizontal: 8,
          },
        ]}
      >
        {state.insight}
      </Text>

      {onShare ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onShare();
          }}
          accessibilityRole="button"
          accessibilityLabel="Share Trough Day"
          style={({ pressed }) => [
            styles.shareBtn,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            {state.isTroughDay ? 'Share Trough Day' : 'Share this day'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${state.badge}. ${state.headline}. ${state.insight}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1, marginBottom: 14 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ringWrap: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
});
