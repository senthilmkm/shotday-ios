import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { IntensityRow } from '../../components/IntensityRow';
import { SIDE_EFFECT_DISCLAIMER } from '../../copy/disclaimers';
import { dayAfterShot, mostRecentInjection } from '../../domain/dateMath';
import {
  buildAdHocEntry,
  buildPostShotEntry,
  defaultMetrics,
} from '../../domain/sideEffects';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import {
  SIDE_EFFECT_CHIPS,
  SIDE_EFFECT_METRICS,
  type SideEffectChip,
  type SideEffectMetric,
} from '../../types/domain';
import type { AppStackParamList } from '../../navigation/AppNavigator';

const METRIC_LABELS: Record<SideEffectMetric, string> = {
  NAUSEA: 'Nausea',
  FATIGUE: 'Fatigue',
  CONSTIPATION: 'Constipation',
  APPETITE_SUPPRESSION: 'Appetite suppression',
};

const CHIP_LABELS: Record<SideEffectChip, string> = {
  HEADACHE: 'Headache',
  HEARTBURN: 'Heartburn',
  SULFUR_BURPS: 'Sulfur burps',
  DIZZINESS: 'Dizziness',
  DIARRHEA: 'Diarrhea',
};

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function SideEffectLogScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();

  const [metrics, setMetrics] = useState(() => defaultMetrics());
  const [chips, setChips] = useState<SideEffectChip[]>([]);
  const [customDraft, setCustomDraft] = useState('');
  const [customs, setCustoms] = useState<string[]>([]);

  const now = useMemo(() => new Date(), []);
  const day = dayAfterShot(db.injections, now);
  const last = mostRecentInjection(db.injections);
  const inWindow = day !== null;

  const setMetric = (m: SideEffectMetric, v: number): void => {
    setMetrics((prev) => ({ ...prev, [m]: v }));
  };

  const toggleChip = (c: SideEffectChip): void => {
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const addCustom = (): void => {
    const v = customDraft.trim();
    if (!v) return;
    setCustoms((prev) => [...prev, v]);
    setCustomDraft('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const removeCustom = (idx: number): void => {
    setCustoms((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = (): void => {
    const fresh = new Date();
    const entry = inWindow
      ? buildPostShotEntry({
          metrics,
          chips,
          customSymptoms: customs,
          injections: db.injections,
          now: fresh,
        })
      : buildAdHocEntry({
          metrics,
          chips,
          customSymptoms: customs,
          doseMg: db.profile.currentDoseMg,
          now: fresh,
        });
    if (!entry) return;
    updateDb((prev) => ({ ...prev, sideEffects: [entry, ...prev.sideEffects] }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Logged', 'Saved to your timeline.');
    navigation.goBack();
  };

  const subtitle = inWindow
    ? `Day ${day} after your ${last?.doseMg} mg shot`
    : last
      ? `Outside the post-shot window — saving as an ad-hoc check-in.`
      : 'No injection logged yet — saving as an ad-hoc check-in.';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>How are you feeling?</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
          {subtitle}
        </Text>

        {/* ─── Intensity rows ─────────────────────────── */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
          {SIDE_EFFECT_METRICS.map((m, idx) => (
            <View
              key={m}
              style={[
                idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border },
              ]}
            >
              <View style={{ paddingHorizontal: theme.spacing.lg }}>
                <IntensityRow
                  label={METRIC_LABELS[m]}
                  value={metrics[m]}
                  onChange={(v) => setMetric(m, v)}
                />
              </View>
            </View>
          ))}
        </View>

        {/* ─── Quick chips ───────────────────────────── */}
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm },
          ]}
        >
          ANYTHING ELSE?
        </Text>
        <View style={styles.chipRow}>
          {SIDE_EFFECT_CHIPS.map((c) => (
            <Chip
              key={c}
              label={CHIP_LABELS[c]}
              selected={chips.includes(c)}
              onPress={() => toggleChip(c)}
            />
          ))}
        </View>

        {/* ─── Custom symptoms ───────────────────────── */}
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm },
          ]}
        >
          SOMETHING NOT LISTED?
        </Text>
        <View style={[styles.customRow]}>
          <TextInput
            value={customDraft}
            onChangeText={setCustomDraft}
            placeholder="e.g. cold sweats"
            placeholderTextColor={theme.colors.textMuted}
            onSubmitEditing={addCustom}
            returnKeyType="done"
            accessibilityLabel="Custom symptom name"
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
          />
          <Button
            label="Add"
            variant="secondary"
            haptic={false}
            onPress={addCustom}
            disabled={customDraft.trim().length === 0}
            style={{ marginLeft: 8, minWidth: 64 }}
          />
        </View>
        {customs.length > 0 && (
          <View style={[styles.customList]}>
            {customs.map((c, i) => (
              <Pressable
                key={`${c}-${i}`}
                onPress={() => removeCustom(i)}
                accessibilityRole="button"
                accessibilityLabel={`Remove custom symptom: ${c}`}
                style={({ pressed }) => [
                  styles.customPill,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.full,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{c}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 6 }]}>×</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              marginTop: 24,
              lineHeight: 18,
              textAlign: 'center',
            },
          ]}
        >
          {SIDE_EFFECT_DISCLAIMER}
        </Text>

        <View style={{ height: 16 }} />
        <Button label="Save" fullWidth size="lg" onPress={onSave} />
        <Button
          label="Cancel"
          variant="ghost"
          fullWidth
          haptic={false}
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    marginTop: 24,
    paddingVertical: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  customList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  customPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
