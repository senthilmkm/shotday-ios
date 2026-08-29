import { LinearGradient } from 'expo-linear-gradient';
import { Activity, ShieldCheck, Sparkles, Zap } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

interface SatietyShieldHeaderProps {
  drugName: string;
  doseLabel: string;
  activeLevelMg: number;
  nominalDoseMg: number;
  dayAfterShot: number | null;
  onPress: () => void;
}

export function SatietyShieldHeader({
  drugName,
  doseLabel,
  activeLevelMg,
  nominalDoseMg,
  dayAfterShot,
  onPress,
}: SatietyShieldHeaderProps): React.ReactElement {
  const theme = useTheme();

  // Breathing pulse animation
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1800 }),
        withTiming(1.0, { duration: 1800 })
      ),
      -1,
      true
    );
  }, [pulse]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Determine cycle state & colors
  const day = dayAfterShot ?? 0;
  const isPeak = day >= 1 && day <= 2;
  const isSteady = day >= 3 && day <= 4;
  const isDrift = day >= 5 && day <= 6;

  // Approximate relative satiety shield strength (0 - 100%)
  const maxEstimated = nominalDoseMg > 0 ? nominalDoseMg * 1.3 : 5;
  const rawPct = Math.min(100, Math.max(15, Math.round((activeLevelMg / maxEstimated) * 100)));

  const gradientColors: [string, string] = isPeak
    ? ['#10B98135', '#06B6D415']
    : isSteady
      ? ['#6366F135', '#8B5CF615']
      : isDrift
        ? ['#F59E0B35', '#EC489915']
        : ['#3B82F635', '#2563EB15'];

  const accentColor = isPeak
    ? '#10B981'
    : isSteady
      ? '#818CF8'
      : isDrift
        ? '#F59E0B'
        : '#3B82F6';

  const phaseTitle = isPeak
    ? 'PEAK SATIETY SHIELD'
    : isSteady
      ? 'STEADY METABOLIC FLOW'
      : isDrift
        ? 'APPETITE RETURN (HALF-LIFE DIP)'
        : 'SHOT DAY CONCENTRATION';

  const phaseTag = isPeak
    ? 'Day 1–2 Peak'
    : isSteady
      ? 'Day 3–4 Steady'
      : isDrift
        ? 'Day 5–6 Drift'
        : 'Shot Ritual';

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${phaseTitle}. Estimated active level: ${activeLevelMg} mg. Tap to view active half-life curve.`}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor: accentColor + '60',
          borderRadius: theme.radii.xl,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBg, { borderRadius: theme.radii.xl }]}
      >
        <View style={styles.topRow}>
          {/* Animated Glowing Pulse Dot */}
          <View style={styles.pulseWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                { backgroundColor: accentColor + '40', borderColor: accentColor },
                animatedPulseStyle,
              ]}
            />
            <View style={[styles.pulseCenter, { backgroundColor: accentColor }]} />
          </View>

          <Text style={[theme.typography.captionMedium, { color: accentColor, fontSize: 11, letterSpacing: 0.5, flex: 1, marginLeft: 8 }]}>
            {phaseTitle}
          </Text>

          <View style={[styles.tagPill, { backgroundColor: accentColor + '20', borderColor: accentColor + '50' }]}>
            <Text style={[theme.typography.captionMedium, { color: accentColor, fontSize: 10 }]}>
              {phaseTag}
            </Text>
          </View>
        </View>

        {/* Level Stats Bar */}
        <View style={styles.statRow}>
          <View>
            <Text style={[theme.typography.hero, { color: theme.colors.text, fontSize: 26, lineHeight: 30 }]}>
              {activeLevelMg} <Text style={{ fontSize: 15, fontWeight: '500', color: theme.colors.textMuted }}>mg</Text>
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 11 }]}>
              Estimated Active in System · {drugName}
            </Text>
          </View>

          {/* Satiety Gauge Meter */}
          <View style={styles.gaugeBlock}>
            <Text style={[theme.typography.captionMedium, { color: accentColor, fontSize: 12, textAlign: 'right' }]}>
              {rawPct}% Active Shield
            </Text>
            <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${rawPct}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    marginBottom: 14,
    overflow: 'hidden',
  },
  gradientBg: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pulseWrapper: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  pulseCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  gaugeBlock: {
    alignItems: 'flex-end',
    width: 120,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
});
