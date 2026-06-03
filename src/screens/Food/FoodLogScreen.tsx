import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import {
  buildCustomEntry,
  buildPresetEntry,
  entriesForDay,
  FOOD_PRESETS,
  totalProteinForDay,
  type FoodPreset,
} from '../../domain/food';
import { proteinTargetGrams } from '../../domain/protein';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { FoodEntry } from '../../types/domain';

export function FoodLogScreen(): React.ReactElement {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const { db, updateDb } = useShotdayDb();
  const now = new Date();

  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customGrams, setCustomGrams] = useState('');

  const target = useMemo(() => {
    if (db.profile.weight <= 0) return 0;
    try {
      return proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
    } catch {
      return 0;
    }
  }, [db.profile.weight, db.profile.weightUnit]);

  const todayEntries = useMemo(() => entriesForDay(db.foods, now), [db.foods, now]);
  const todayTotal = useMemo(() => totalProteinForDay(db.foods, now), [db.foods, now]);
  const pct = target > 0 ? Math.min(1, todayTotal / target) : 0;

  const onPreset = (preset: FoodPreset): void => {
    const entry = buildPresetEntry(preset, new Date());
    updateDb((prev) => ({ ...prev, foods: [entry, ...prev.foods] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const onSaveCustom = (): void => {
    const grams = parseFloat(customGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Enter protein grams', 'A positive number is required.');
      return;
    }
    try {
      const entry = buildCustomEntry(customName, grams, new Date());
      updateDb((prev) => ({ ...prev, foods: [entry, ...prev.foods] }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCustomOpen(false);
      setCustomName('');
      setCustomGrams('');
    } catch {
      Alert.alert('Invalid', 'Enter a positive protein gram count.');
    }
  };

  const removeEntry = (entry: FoodEntry): void => {
    Alert.alert('Remove entry?', `${entry.name} (+${entry.proteinGrams} g)`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          updateDb((prev) => ({ ...prev, foods: prev.foods.filter((f) => f.id !== entry.id) }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: tabBarHeight + theme.spacing.lg }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Today's protein</Text>

        {/* ─── Gauge ───────────────────────────────────── */}
        {target > 0 ? (
          <>
            <View style={[styles.gaugeRow, { marginTop: 16 }]}>
              <Text style={[theme.typography.hero, { color: theme.colors.text }]}>{todayTotal}</Text>
              <Text
                style={[theme.typography.body, { color: theme.colors.textMuted, marginLeft: 6, marginBottom: 6 }]}
              >
                / {target} g
              </Text>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.colors.surfaceMuted }]}>
              <View
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  backgroundColor: pct >= 1 ? theme.colors.success : theme.colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
            {todayTotal >= target && (
              <Text
                style={[
                  theme.typography.captionMedium,
                  { color: theme.colors.success, marginTop: 8 },
                ]}
              >
                Target hit. Muscle stays.
              </Text>
            )}
          </>
        ) : (
          <View
            style={[
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radii.md,
                padding: 14,
                marginTop: 16,
              },
            ]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
              No protein target yet
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4, lineHeight: 18 }]}>
              Add your weight in Settings to compute a daily target. You can still log entries below
              — they'll start counting once a target is set.
            </Text>
          </View>
        )}

        {/* ─── Preset grid ─────────────────────────────── */}
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
          ]}
        >
          QUICK ADD
        </Text>
        <View style={styles.grid}>
          {FOOD_PRESETS.map((p) => (
            <PresetTile key={p.id} preset={p} onPress={() => onPreset(p)} />
          ))}
          <Pressable
            onPress={() => setCustomOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add custom food entry"
            accessibilityHint="Opens a sheet to enter a name and protein grams"
            style={({ pressed }) => [
              styles.tile,
              styles.customTile,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.hero, { color: theme.colors.primary }]}>+</Text>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginTop: 2 }]}>
              Custom
            </Text>
          </Pressable>
        </View>

        {/* ─── Today's entries ──────────────────────────── */}
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
          ]}
        >
          TODAY ({todayEntries.length})
        </Text>
        {todayEntries.length === 0 ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
            ]}
          >
            Nothing logged yet. Tap a tile above.
          </Text>
        ) : (
          todayEntries.map((e) => (
            <Pressable
              key={e.id}
              onLongPress={() => removeEntry(e)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={`${e.name}, ${e.proteinGrams} grams of protein, logged at ${timeOf(e.loggedAt)}`}
              accessibilityHint="Long press to remove this entry"
              style={({ pressed }) => [
                styles.entryRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{e.name}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                  {timeOf(e.loggedAt)}
                  {!e.preset && ' · custom'}
                </Text>
              </View>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                +{e.proteinGrams} g
              </Text>
            </Pressable>
          ))
        )}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: 12, textAlign: 'center' },
          ]}
        >
          Long-press an entry to remove it.
        </Text>
      </ScrollView>

      {/* ─── Custom entry modal ─────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={customOpen}
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCustomOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss custom entry sheet"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalAnchor}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Custom entry</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Name + protein grams.
            </Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Smoothie"
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel="Food name"
              style={[
                styles.modalInput,
                theme.typography.body,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            />
            <TextInput
              value={customGrams}
              onChangeText={setCustomGrams}
              placeholder="protein grams"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Protein in grams"
              style={[
                styles.modalInput,
                theme.typography.body,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            />
            <Button label="Save" fullWidth size="lg" onPress={onSaveCustom} />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => setCustomOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

interface PresetTileProps {
  preset: FoodPreset;
  onPress: () => void;
}

function PresetTile({ preset, onPress }: PresetTileProps): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${preset.name}, ${preset.serving}, ${preset.proteinGrams} grams of protein`}
      accessibilityHint="Adds this preset to your protein log"
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={[theme.typography.heading, { color: theme.colors.primary }]}>+{preset.proteinGrams}g</Text>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 4 }]}>
        {preset.name}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
        {preset.serving}
      </Text>
    </Pressable>
  );
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gaugeRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: {
    height: 10,
    borderRadius: 5,
    marginTop: 8,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  customTile: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    borderStyle: 'dashed',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalAnchor: {
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 24,
    paddingBottom: 36,
  },
  modalInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 12,
    minHeight: 48,
  },
});
