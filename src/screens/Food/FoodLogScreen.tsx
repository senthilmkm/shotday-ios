import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
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
import {
  buildWaterEntry,
  entriesForDay as waterEntriesForDay,
  mlToOz,
  ozToMl,
  totalWaterForDay,
  WATER_PRESETS,
  waterProgress,
  waterTargetMl,
  waterTargetOz,
  type WaterPreset,
} from '../../domain/water';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { MainTabsParamList } from '../../navigation/MainTabs';
import type { FoodEntry, WaterEntry } from '../../types/domain';

type FoodLogRouteProp = RouteProp<MainTabsParamList, 'Food'>;

export function FoodLogScreen(): React.ReactElement {
  const theme = useTheme();
  const route = useRoute<FoodLogRouteProp>();
  const tabBarHeight = useBottomTabBarHeight();
  const { db, updateDb } = useShotdayDb();
  const now = new Date();

  const [activeTab, setActiveTab] = useState<'PROTEIN' | 'WATER'>('PROTEIN');

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Protein state & logic
  const [customProteinOpen, setCustomProteinOpen] = useState(false);
  const [customProteinName, setCustomProteinName] = useState('');
  const [customProteinGrams, setCustomProteinGrams] = useState('');

  const proteinTarget = useMemo(() => {
    if (db.profile.weight <= 0) return 0;
    try {
      return proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
    } catch {
      return 0;
    }
  }, [db.profile.weight, db.profile.weightUnit]);

  const todayFoodEntries = useMemo(() => entriesForDay(db.foods, now), [db.foods, now]);
  const todayProteinTotal = useMemo(() => totalProteinForDay(db.foods, now), [db.foods, now]);
  const proteinPct = proteinTarget > 0 ? Math.min(1, todayProteinTotal / proteinTarget) : 0;

  // Water state & logic
  const [customWaterOpen, setCustomWaterOpen] = useState(false);
  const [customWaterAmount, setCustomWaterAmount] = useState('');
  const [customWaterLabel, setCustomWaterLabel] = useState('');

  const isMetric = db.profile.weightUnit === 'KG';
  const targetWaterOz = useMemo(
    () => waterTargetOz(db.profile.weight, db.profile.weightUnit),
    [db.profile.weight, db.profile.weightUnit],
  );
  const targetWaterMl = useMemo(
    () => waterTargetMl(db.profile.weight, db.profile.weightUnit),
    [db.profile.weight, db.profile.weightUnit],
  );

  const todayWaterEntries = useMemo(
    () => waterEntriesForDay(db.waterEntries ?? [], now),
    [db.waterEntries, now],
  );
  const todayWaterTotal = useMemo(
    () => totalWaterForDay(db.waterEntries ?? [], now),
    [db.waterEntries, now],
  );
  const waterPct = Math.min(1, waterProgress(todayWaterTotal.oz, targetWaterOz));

  // Protein handlers
  const onProteinPreset = (preset: FoodPreset): void => {
    const entry = buildPresetEntry(preset, new Date());
    updateDb((prev) => ({ ...prev, foods: [entry, ...prev.foods] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const onSaveCustomProtein = (): void => {
    const grams = parseFloat(customProteinGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Enter protein grams', 'A positive number is required.');
      return;
    }
    try {
      const entry = buildCustomEntry(customProteinName, grams, new Date());
      updateDb((prev) => ({ ...prev, foods: [entry, ...prev.foods] }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCustomProteinOpen(false);
      setCustomProteinName('');
      setCustomProteinGrams('');
    } catch {
      Alert.alert('Invalid', 'Enter a positive protein gram count.');
    }
  };

  const removeFoodEntry = (entry: FoodEntry): void => {
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

  // Water handlers
  const onWaterPreset = (preset: WaterPreset): void => {
    const label = isMetric ? `${preset.name} (${preset.amountMl} ml)` : `${preset.name} (${preset.amountOz} oz)`;
    const entry = buildWaterEntry(preset.amountOz, label, new Date());
    updateDb((prev) => ({
      ...prev,
      waterEntries: [entry, ...(prev.waterEntries ?? [])],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const onSaveCustomWater = (): void => {
    const rawVal = parseFloat(customWaterAmount);
    if (!Number.isFinite(rawVal) || rawVal <= 0) {
      Alert.alert('Enter water amount', 'A positive number is required.');
      return;
    }
    const amountOz = isMetric ? mlToOz(rawVal) : rawVal;
    try {
      const displayLabel = customWaterLabel.trim()
        ? customWaterLabel.trim()
        : isMetric
          ? `Custom (${Math.round(rawVal)} ml)`
          : `Custom (${Math.round(rawVal * 10) / 10} oz)`;

      const entry = buildWaterEntry(amountOz, displayLabel, new Date());
      updateDb((prev) => ({
        ...prev,
        waterEntries: [entry, ...(prev.waterEntries ?? [])],
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCustomWaterOpen(false);
      setCustomWaterAmount('');
      setCustomWaterLabel('');
    } catch {
      Alert.alert('Invalid', 'Enter a positive water amount.');
    }
  };

  const removeWaterEntry = (entry: WaterEntry): void => {
    const displayAmount = isMetric ? `${ozToMl(entry.amountOz)} ml` : `${entry.amountOz} oz`;
    Alert.alert('Remove water entry?', `${entry.label ?? 'Water'} (+${displayAmount})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          updateDb((prev) => ({
            ...prev,
            waterEntries: (prev.waterEntries ?? []).filter((w) => w.id !== entry.id),
          }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: tabBarHeight + theme.spacing.lg }}>
        {/* ─── Top Segmented Switcher ─────────────────── */}
        <View style={[styles.segmentedWrapper, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.lg }]}>
          <Pressable
            onPress={() => {
              setActiveTab('PROTEIN');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'PROTEIN' }}
            accessibilityLabel="Protein tracker tab"
            style={[
              styles.segmentButton,
              activeTab === 'PROTEIN' && [
                styles.segmentButtonActive,
                { backgroundColor: theme.colors.surface, shadowColor: '#000' },
              ],
            ]}
          >
            <Text
              style={[
                theme.typography.captionMedium,
                {
                  color: activeTab === 'PROTEIN' ? theme.colors.text : theme.colors.textMuted,
                  fontWeight: activeTab === 'PROTEIN' ? '700' : '500',
                },
              ]}
            >
              🥩 Protein
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setActiveTab('WATER');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'WATER' }}
            accessibilityLabel="Water hydration tracker tab"
            style={[
              styles.segmentButton,
              activeTab === 'WATER' && [
                styles.segmentButtonActive,
                { backgroundColor: theme.colors.surface, shadowColor: '#000' },
              ],
            ]}
          >
            <Text
              style={[
                theme.typography.captionMedium,
                {
                  color: activeTab === 'WATER' ? theme.colors.primary : theme.colors.textMuted,
                  fontWeight: activeTab === 'WATER' ? '700' : '500',
                },
              ]}
            >
              💧 Water
            </Text>
          </Pressable>
        </View>

        {activeTab === 'PROTEIN' ? (
          <>
            {/* ─── Protein Section ───────────────────────────── */}
            <Text style={[theme.typography.title, { color: theme.colors.text, marginTop: 16 }]}>
              Today's protein
            </Text>

            {proteinTarget > 0 ? (
              <>
                <View style={[styles.gaugeRow, { marginTop: 16 }]}>
                  <Text style={[theme.typography.hero, { color: theme.colors.text }]}>{todayProteinTotal}</Text>
                  <Text
                    style={[theme.typography.body, { color: theme.colors.textMuted, marginLeft: 6, marginBottom: 6 }]}
                  >
                    / {proteinTarget} g
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <View
                    style={{
                      width: `${proteinPct * 100}%`,
                      height: '100%',
                      backgroundColor: proteinPct >= 1 ? theme.colors.success : theme.colors.primary,
                      borderRadius: 4,
                    }}
                  />
                </View>
                {todayProteinTotal >= proteinTarget && (
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

            {/* ─── Protein Preset Grid ──────────────────────── */}
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
              ]}
            >
              QUICK ADD PROTEIN
            </Text>
            <View style={styles.grid}>
              {FOOD_PRESETS.map((p) => (
                <PresetTile key={p.id} preset={p} onPress={() => onProteinPreset(p)} />
              ))}
              <Pressable
                onPress={() => setCustomProteinOpen(true)}
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

            {/* ─── Today's Food Entries ─────────────────────── */}
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
              ]}
            >
              TODAY ({todayFoodEntries.length})
            </Text>
            {todayFoodEntries.length === 0 ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
                ]}
              >
                Nothing logged yet. Tap a tile above.
              </Text>
            ) : (
              todayFoodEntries.map((e) => (
                <Pressable
                  key={e.id}
                  onLongPress={() => removeFoodEntry(e)}
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
          </>
        ) : (
          <>
            {/* ─── Water Section ─────────────────────────────── */}
            <Text style={[theme.typography.title, { color: theme.colors.text, marginTop: 16 }]}>
              Today's hydration
            </Text>

            {/* ─── Water Gauge ──────────────────────────────── */}
            <View style={[styles.gaugeRow, { marginTop: 16 }]}>
              <Text style={[theme.typography.hero, { color: theme.colors.text }]}>
                {isMetric ? todayWaterTotal.ml.toLocaleString() : todayWaterTotal.oz}
              </Text>
              <Text
                style={[theme.typography.body, { color: theme.colors.textMuted, marginLeft: 6, marginBottom: 6 }]}
              >
                / {isMetric ? targetWaterMl.toLocaleString() : targetWaterOz} {isMetric ? 'ml' : 'oz'}
              </Text>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.colors.surfaceMuted }]}>
              <View
                style={{
                  width: `${waterPct * 100}%`,
                  height: '100%',
                  backgroundColor: waterPct >= 1 ? theme.colors.success : theme.colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text
              style={[
                theme.typography.captionMedium,
                { color: waterPct >= 1 ? theme.colors.success : theme.colors.textMuted, marginTop: 8 },
              ]}
            >
              {waterPct >= 1
                ? 'Target hit. Optimal hydration for GLP-1.'
                : 'GLP-1 blunts thirst signals. Staying hydrated prevents constipation and headaches.'}
            </Text>

            {/* ─── Water Preset Grid ────────────────────────── */}
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
              ]}
            >
              QUICK ADD WATER
            </Text>
            <View style={styles.grid}>
              {WATER_PRESETS.map((p) => (
                <WaterPresetTile
                  key={p.id}
                  preset={p}
                  isMetric={isMetric}
                  onPress={() => onWaterPreset(p)}
                />
              ))}
              <Pressable
                onPress={() => setCustomWaterOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Add custom water amount"
                accessibilityHint="Opens a sheet to enter a custom water amount"
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

            {/* ─── Today's Water Entries ────────────────────── */}
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 28, marginBottom: 12 },
              ]}
            >
              TODAY'S LOGS ({todayWaterEntries.length})
            </Text>
            {todayWaterEntries.length === 0 ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
                ]}
              >
                No water logged yet today. Tap a container above.
              </Text>
            ) : (
              todayWaterEntries.map((e) => {
                const amountDisplay = isMetric ? `${ozToMl(e.amountOz)} ml` : `${e.amountOz} oz`;
                return (
                  <Pressable
                    key={e.id}
                    onLongPress={() => removeWaterEntry(e)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.label ?? 'Water'}, ${amountDisplay}, logged at ${timeOf(e.loggedAt)}`}
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
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                        {e.label ?? 'Water'}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                        {timeOf(e.loggedAt)}
                      </Text>
                    </View>
                    <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                      +{amountDisplay}
                    </Text>
                  </Pressable>
                );
              })
            )}
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, marginTop: 12, textAlign: 'center' },
              ]}
            >
              Long-press an entry to remove it.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ─── Custom Protein Modal ─────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={customProteinOpen}
        onRequestClose={() => setCustomProteinOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCustomProteinOpen(false)}
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
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Custom protein entry</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Food name + protein grams.
            </Text>
            <TextInput
              value={customProteinName}
              onChangeText={setCustomProteinName}
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
              value={customProteinGrams}
              onChangeText={setCustomProteinGrams}
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
            <Button label="Save" fullWidth size="lg" onPress={onSaveCustomProtein} />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => setCustomProteinOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Custom Water Modal ───────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={customWaterOpen}
        onRequestClose={() => setCustomWaterOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCustomWaterOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss custom water entry sheet"
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
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Custom water entry</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Enter amount in {isMetric ? 'milliliters (ml)' : 'fluid ounces (oz)'}.
            </Text>
            <TextInput
              value={customWaterAmount}
              onChangeText={setCustomWaterAmount}
              placeholder={isMetric ? 'e.g. 350' : 'e.g. 12'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Water amount"
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
              value={customWaterLabel}
              onChangeText={setCustomWaterLabel}
              placeholder="Label (optional, e.g. Tea, Tumbler)"
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel="Optional container label"
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
            <Button label="Save" fullWidth size="lg" onPress={onSaveCustomWater} />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => setCustomWaterOpen(false)}
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

interface WaterPresetTileProps {
  preset: WaterPreset;
  isMetric: boolean;
  onPress: () => void;
}

function WaterPresetTile({ preset, isMetric, onPress }: WaterPresetTileProps): React.ReactElement {
  const theme = useTheme();
  const displayAmount = isMetric ? `+${preset.amountMl}ml` : `+${preset.amountOz}oz`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${preset.name}, ${displayAmount}`}
      accessibilityHint="Adds this water amount to your daily hydration log"
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
      <Text style={{ fontSize: 24, marginBottom: 2 }}>{preset.icon}</Text>
      <Text style={[theme.typography.heading, { color: theme.colors.primary }]}>{displayAmount}</Text>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 4 }]}>
        {preset.name}
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
  segmentedWrapper: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
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
