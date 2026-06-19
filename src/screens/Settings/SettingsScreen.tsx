import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DateTimePickerSheet } from '../../components/DateTimePickerSheet';
import { NOT_MEDICAL_ADVICE_SHORT } from '../../copy/disclaimers';
import {
  PRIVACY_URL,
  SUBSCRIPTION_DISCLOSURE_SHORT,
  TERMS_URL,
} from '../../copy/subscription';
import { isOffLadder } from '../../domain/dose';
import {
  computeEntitlement,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { buildCsv, buildJson } from '../../domain/export';
import { proteinTargetGrams } from '../../domain/protein';
import { isInQuietHours } from '../../notifications/schedule';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type {
  DayOfWeek,
  DrugFamily,
  ThemePreference,
  WeightUnit,
} from '../../types/domain';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { MainTabsParamList } from '../../navigation/MainTabs';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Settings'>,
  NativeStackNavigationProp<AppStackParamList>
>;

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
];

const DRUG_OPTIONS: { value: DrugFamily; label: string }[] = [
  { value: 'OZEMPIC', label: 'Ozempic' },
  { value: 'WEGOVY', label: 'Wegovy' },
  { value: 'MOUNJARO', label: 'Mounjaro' },
  { value: 'ZEPBOUND', label: 'Zepbound' },
  { value: 'OTHER', label: 'Something else' },
];

type HourField =
  | 'shotReminderHour'
  | 'sideEffectPromptHour'
  | 'refillReminderHour'
  | 'quietHoursStart'
  | 'quietHoursEnd';

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const tabBarHeight = useBottomTabBarHeight();
  const { db, updateDb, resetDb } = useShotdayDb();
  const profile = db.profile;

  const ent = computeEntitlement(profile, new Date());
  const trialDays = trialDaysRemaining(profile, new Date());
  const isDev = Boolean((globalThis as { __DEV__?: boolean }).__DEV__ ?? false);

  const proteinTarget = (() => {
    if (profile.weight <= 0) return 0;
    try {
      return proteinTargetGrams(profile.weight, profile.weightUnit);
    } catch {
      return 0;
    }
  })();

  const [editingHour, setEditingHour] = useState<HourField | null>(null);
  const [drugSheetOpen, setDrugSheetOpen] = useState(false);
  const [draftDrug, setDraftDrug] = useState<DrugFamily>(profile.drug);
  const [draftCustomDrug, setDraftCustomDrug] = useState<string>(profile.customDrugName ?? '');
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [draftWeight, setDraftWeight] = useState<string>(String(profile.weight ?? ''));
  const [draftUnit, setDraftUnit] = useState<WeightUnit>(profile.weightUnit);

  // Quiet-hours overlap warnings — if the user accidentally schedules
  // their shot reminder at 11 PM with quiet hours 10 PM → 7 AM, iOS
  // silently delays the notification and they'll think it's broken.
  const shotReminderInQuiet = useMemo(
    () => isInQuietHours(profile.shotReminderHour, profile),
    [profile],
  );
  const sideEffectInQuiet = useMemo(
    () => isInQuietHours(profile.sideEffectPromptHour, profile),
    [profile],
  );
  const refillInQuiet = useMemo(
    () => isInQuietHours(profile.refillReminderHour, profile),
    [profile],
  );

  const setHourValue = (field: HourField, hour: number): void => {
    Haptics.selectionAsync().catch(() => {});
    updateDb((prev) => ({ ...prev, profile: { ...prev.profile, [field]: hour } }));
  };

  const openWeightEditor = (): void => {
    setDraftWeight(profile.weight > 0 ? String(profile.weight) : '');
    setDraftUnit(profile.weightUnit);
    setWeightSheetOpen(true);
  };

  const onSaveWeight = (): void => {
    const w = parseFloat(draftWeight);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert('Invalid', 'Enter a positive number.');
      return;
    }
    const nowIso = new Date().toISOString();
    updateDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        weight: w,
        weightUnit: draftUnit,
        weightUpdatedAt: nowIso,
      },
      weightEntries: [
        ...prev.weightEntries,
        {
          id: `weight-${Date.now()}`,
          loggedAt: nowIso,
          weight: w,
          unit: draftUnit,
        },
      ],
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setWeightSheetOpen(false);
  };

  const openDrugEditor = (): void => {
    setDraftDrug(profile.drug);
    setDraftCustomDrug(profile.customDrugName ?? '');
    setDrugSheetOpen(true);
  };

  const onSaveDrug = (): void => {
    if (draftDrug === 'OTHER' && draftCustomDrug.trim().length === 0) {
      Alert.alert('Drug name needed', 'Enter a name when choosing "Something else".');
      return;
    }
    // If the user's current dose is not a rung on the new drug's
    // ladder, clear it so the dose ladder screen can re-enroll them.
    // Without this, an Ozempic 0.5 mg user who switches to Mounjaro
    // ends up "stranded" at 0.5 mg with no `Next ←` and no `Next →`
    // — the entire ladder UI breaks. Past entries (`doseHistory`,
    // `injections[].doseMg`) are preserved unchanged.
    const stranded = isOffLadder(draftDrug, profile.currentDoseMg);
    updateDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        drug: draftDrug,
        customDrugName: draftDrug === 'OTHER' ? draftCustomDrug.trim() : undefined,
        currentDoseMg: stranded ? 0 : prev.profile.currentDoseMg,
        currentDoseLabel: stranded ? '' : prev.profile.currentDoseLabel,
      },
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDrugSheetOpen(false);
    if (stranded) {
      // Defer the alert so the modal close animation doesn't fight with it.
      setTimeout(() => {
        Alert.alert(
          'Pick your new starting dose',
          `${prettyDrug(draftDrug)} uses different rung values. Past entries are kept, but pick your new dose so future shots are logged correctly.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open dose ladder', onPress: () => navigation.navigate('DoseLadder') },
          ],
        );
      }, 350);
    }
  };

  const onToggleNotifications = async (next: boolean): Promise<void> => {
    if (next) {
      // Re-enabling — make sure system permission is granted first.
      const status = await Notifications.getPermissionsAsync().catch(() => null);
      if (!status || status.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync().catch(() => null);
        if (!req || req.status !== 'granted') {
          Alert.alert(
            'Notifications are off in iOS Settings',
            'To get reminders you need to allow notifications for Shotday in the iOS Settings app.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
            ],
          );
          return;
        }
      }
    }
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, notificationsEnabled: next },
    }));
    Haptics.selectionAsync().catch(() => {});
  };

  const onExport = (): void => {
    Alert.alert(
      'Export your data',
      'Pick a format. Both contain your full Shotday log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV (spreadsheet)',
          onPress: () => {
            Share.share({
              title: 'Shotday data export.csv',
              message: buildCsv(db),
            }).catch(() => {});
          },
        },
        {
          text: 'JSON (full backup)',
          onPress: () => {
            Share.share({
              title: 'Shotday data export.json',
              message: buildJson(db),
            }).catch(() => {});
          },
        },
      ],
    );
  };

  const onResetAll = (): void => {
    Alert.alert(
      'Reset all data?',
      'This wipes onboarding, injections, side effects, foods, dose history, and refill data. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetDb();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: tabBarHeight + theme.spacing.lg }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Settings</Text>

        {/* ─── Subscription ───────────────────────────────── */}
        <Section title="SUBSCRIPTION" theme={theme}>
          <Pressable
            onPress={() => navigation.navigate('Paywall')}
            accessibilityRole="button"
            accessibilityLabel={`Subscription: ${labelForEntitlement(ent, trialDays)}`}
            accessibilityHint="Opens the subscription screen"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                {labelForEntitlement(ent, trialDays)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {sublabelForEntitlement(ent, trialDays)}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
              {ent === 'PRO' ? 'Manage' : 'Subscribe \u203a'}
            </Text>
          </Pressable>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: 8, lineHeight: 18 },
            ]}
          >
            {SUBSCRIPTION_DISCLOSURE_SHORT}
          </Text>
        </Section>

        {/* ─── Profile ───────────────────────────────────── */}
        <Section title="DRUG + DOSE" theme={theme}>
          <Pressable
            onPress={openDrugEditor}
            accessibilityRole="button"
            accessibilityLabel={`Drug: ${profile.drug === 'OTHER' && profile.customDrugName ? profile.customDrugName : prettyDrug(profile.drug)}. Tap to change.`}
            accessibilityHint="Opens a sheet to change which medication you're tracking"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                MEDICATION
              </Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 2 }]}>
                {profile.drug === 'OTHER' && profile.customDrugName
                  ? profile.customDrugName
                  : prettyDrug(profile.drug)}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>Edit</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('DoseLadder')}
            accessibilityRole="button"
            accessibilityLabel={`Current dose: ${profile.currentDoseLabel || 'not set'}. Opens dose ladder.`}
            accessibilityHint="Opens the dose ladder screen"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
                marginTop: 8,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                CURRENT DOSE
              </Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 2 }]}>
                {profile.currentDoseLabel || 'Not set'}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>›</Text>
          </Pressable>
        </Section>

        <Section title="WEIGHT + PROTEIN TARGET" theme={theme}>
          <Pressable
            onPress={openWeightEditor}
            accessibilityRole="button"
            accessibilityLabel={
              profile.weight > 0
                ? `Weight: ${profile.weight} ${profile.weightUnit.toLowerCase()}, protein target ${proteinTarget} grams. Tap to edit.`
                : 'Weight not set. Tap to add it.'
            }
            accessibilityHint="Opens a sheet to set your weight"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                {profile.weight > 0
                  ? `${profile.weight} ${profile.weightUnit.toLowerCase()}`
                  : 'Add your weight'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {proteinTarget > 0 ? `${proteinTarget} g protein/day` : 'No protein target yet'}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
              {profile.weight > 0 ? 'Edit' : 'Set'}
            </Text>
          </Pressable>
        </Section>

        {/* ─── Shot day ───────────────────────────────────── */}
        <Section title="SHOT DAY" theme={theme}>
          <View style={styles.dayRow}>
            {DAYS.map((d) => (
              <View key={d.value} style={styles.dayCell}>
                <Chip
                  label={d.label}
                  selected={profile.shotDay === d.value}
                  onPress={() =>
                    updateDb((prev) => ({ ...prev, profile: { ...prev.profile, shotDay: d.value } }))
                  }
                />
              </View>
            ))}
          </View>
        </Section>

        {/* ─── Reminder times ────────────────────────────── */}
        <Section title="REMINDER TIMES" theme={theme}>
          <HourRow
            label="Shot day"
            sublabel="Weekly reminder on shot day"
            value={profile.shotReminderHour}
            warn={shotReminderInQuiet}
            onPress={() => setEditingHour('shotReminderHour')}
            theme={theme}
          />
          <HourRow
            label="Side-effect check"
            sublabel="Day after shot day"
            value={profile.sideEffectPromptHour}
            warn={sideEffectInQuiet}
            onPress={() => setEditingHour('sideEffectPromptHour')}
            theme={theme}
          />
          <HourRow
            label="Refill nudge"
            sublabel="Fires when running low"
            value={profile.refillReminderHour}
            warn={refillInQuiet}
            onPress={() => setEditingHour('refillReminderHour')}
            theme={theme}
          />
          {(shotReminderInQuiet || sideEffectInQuiet || refillInQuiet) && (
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.warning,
                  marginTop: 4,
                  marginHorizontal: 4,
                  lineHeight: 18,
                },
              ]}
            >
              ⚠ One or more reminder times fall inside your quiet hours and may be delayed by iOS.
            </Text>
          )}
        </Section>

        <Section title="QUIET HOURS" theme={theme}>
          <HourRow
            label="Start"
            sublabel="No notifications after this hour"
            value={profile.quietHoursStart}
            onPress={() => setEditingHour('quietHoursStart')}
            theme={theme}
          />
          <HourRow
            label="End"
            sublabel="Notifications resume at this hour"
            value={profile.quietHoursEnd}
            onPress={() => setEditingHour('quietHoursEnd')}
            theme={theme}
          />
        </Section>

        {/* ─── Theme ──────────────────────────────────────── */}
        <Section title="APPEARANCE" theme={theme}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={profile.themePreference === opt.value}
                onPress={() =>
                  updateDb((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, themePreference: opt.value },
                  }))
                }
                large
              />
            ))}
          </View>
        </Section>

        {/* ─── Notifications ─────────────────────────────── */}
        <Section title="NOTIFICATIONS" theme={theme}>
          <View
            style={[
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                Send reminders
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Shot day, side-effect check, refill nudge
              </Text>
            </View>
            <Switch
              value={profile.notificationsEnabled}
              onValueChange={(next) => {
                onToggleNotifications(next).catch(() => {});
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              accessibilityLabel="Send reminders"
            />
          </View>
          <Pressable
            onPress={() => Linking.openSettings().catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Open iOS Settings"
            accessibilityHint="Opens the iOS Settings app to manage notification permissions"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
                marginTop: 8,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                System permissions
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Granular control in iOS Settings
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>›</Text>
          </Pressable>
        </Section>

        {/* ─── Data export ───────────────────────────────── */}
        <Section title="YOUR DATA" theme={theme}>
          <Pressable
            onPress={onExport}
            accessibilityRole="button"
            accessibilityLabel="Export your data"
            accessibilityHint="Opens the share sheet with a CSV or JSON export of your Shotday log"
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                Export data
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Share a CSV or JSON copy with yourself or your clinician
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>›</Text>
          </Pressable>
        </Section>

        {/* ─── Dev tools (only in __DEV__) ──────────────── */}
        {isDev && (
          <Section title="DEV TOOLS" theme={theme}>
            <View
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                  Force Pro entitlement
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                  Bypasses paywall in Expo Go for testing
                </Text>
              </View>
              <Switch
                value={profile.devProOverride}
                onValueChange={(next) =>
                  updateDb((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, devProOverride: next },
                  }))
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                accessibilityLabel="Force Pro entitlement"
              />
            </View>
            <Button
              label="Set trial → 1 day left"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
                updateDb((prev) => ({
                  ...prev,
                  profile: { ...prev.profile, trialStartedAt: past.toISOString() },
                }));
              }}
              style={{ marginTop: 8 }}
            />
            <Button
              label="Expire trial now"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                updateDb((prev) => ({
                  ...prev,
                  profile: {
                    ...prev.profile,
                    trialStartedAt: past.toISOString(),
                    proUntil: null,
                    devProOverride: false,
                  },
                }));
              }}
              style={{ marginTop: 8 }}
            />
          </Section>
        )}

        {/* ─── About ──────────────────────────────────────── */}
        <Section title="ABOUT" theme={theme}>
          <View
            style={[
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                Shotday
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                v{Constants.expoConfig?.version ?? '0.1.0'} · {Platform.OS}
              </Text>
            </View>
          </View>
          <Text
            style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8, lineHeight: 18 }]}
          >
            {NOT_MEDICAL_ADVICE_SHORT}
          </Text>

          <View style={styles.legalRow}>
            <Pressable
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel="Open Privacy Policy in your browser"
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                Privacy Policy
              </Text>
            </Pressable>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, marginHorizontal: 8 },
              ]}
            >
              ·
            </Text>
            <Pressable
              onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel="Open Terms of Use in your browser"
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                Terms of Use
              </Text>
            </Pressable>
          </View>
        </Section>

        {/* ─── Reset (destructive) ─────────────────────── */}
        <Button
          label="Reset all data"
          variant="ghost"
          fullWidth
          haptic={false}
          onPress={onResetAll}
          style={{ marginTop: 16 }}
        />
      </ScrollView>

      {/* ─── Hour-picker sheet ──────────────────────────── */}
      {editingHour && (
        <DateTimePickerSheet
          mode="time"
          visible={editingHour !== null}
          onClose={() => setEditingHour(null)}
          title={titleForHourField(editingHour)}
          initialDate={dateAtHour(profile[editingHour])}
          onConfirm={(d) => setHourValue(editingHour, d.getHours())}
        />
      )}

      {/* ─── Drug-edit sheet ─────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={drugSheetOpen}
        onRequestClose={() => setDrugSheetOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDrugSheetOpen(false)} />
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
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Change drug</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Past entries are preserved. The dose ladder may differ.
            </Text>
            <View style={[styles.themeRow, { marginTop: 16 }]}>
              {DRUG_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={draftDrug === opt.value}
                  onPress={() => setDraftDrug(opt.value)}
                  large
                />
              ))}
            </View>
            {draftDrug === 'OTHER' && (
              <TextInput
                value={draftCustomDrug}
                onChangeText={setDraftCustomDrug}
                placeholder="Drug name"
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel="Custom drug name"
                autoCapitalize="words"
                autoCorrect={false}
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
            )}
            <Button label="Save" fullWidth size="lg" onPress={onSaveDrug} style={{ marginTop: 16 }} />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => setDrugSheetOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Weight-edit sheet ──────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={weightSheetOpen}
        onRequestClose={() => setWeightSheetOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWeightSheetOpen(false)} />
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
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Your weight</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Used to compute your daily protein target.
            </Text>
            <View style={[styles.weightRow, { marginTop: 16 }]}>
              <TextInput
                value={draftWeight}
                onChangeText={setDraftWeight}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                accessibilityLabel="Body weight"
                maxLength={5}
                style={[
                  styles.weightInput,
                  theme.typography.title,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
              <View style={{ width: 12 }} />
              <Chip label="lb" selected={draftUnit === 'LB'} onPress={() => setDraftUnit('LB')} large />
              <View style={{ width: 8 }} />
              <Chip label="kg" selected={draftUnit === 'KG'} onPress={() => setDraftUnit('KG')} large />
            </View>
            <Button label="Save" fullWidth size="lg" onPress={onSaveWeight} style={{ marginTop: 16 }} />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => setWeightSheetOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function titleForHourField(field: HourField): string {
  switch (field) {
    case 'shotReminderHour':
      return 'Shot-day reminder time';
    case 'sideEffectPromptHour':
      return 'Side-effect check time';
    case 'refillReminderHour':
      return 'Refill reminder time';
    case 'quietHoursStart':
      return 'Quiet hours start';
    case 'quietHoursEnd':
      return 'Quiet hours end';
  }
}

function dateAtHour(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}

function Section({ title, children, theme }: SectionProps): React.ReactElement {
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={[
          theme.typography.captionMedium,
          { color: theme.colors.textMuted, marginBottom: 8 },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

interface HourRowProps {
  label: string;
  sublabel?: string;
  value: number;
  /**
   * When true, the row gets a warning border + tint to flag that this
   * hour is inside the user's quiet hours and may be suppressed by iOS.
   */
  warn?: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function HourRow({ label, sublabel, value, warn, onPress, theme }: HourRowProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, currently ${formatHour(value)}${warn ? ', inside quiet hours' : ''}`}
      accessibilityHint="Opens a time picker"
      style={({ pressed }) => [
        styles.hourRow,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderColor: warn ? theme.colors.warning : 'transparent',
          borderWidth: warn ? 1 : 0,
          marginBottom: 8,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{label}</Text>
        {sublabel && (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
            {sublabel}
          </Text>
        )}
      </View>
      <Text style={[theme.typography.heading, { color: warn ? theme.colors.warning : theme.colors.primary }]}>
        {formatHour(value)}
      </Text>
    </Pressable>
  );
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${ampm}`;
}

function prettyDrug(d: string): string {
  return d.charAt(0) + d.slice(1).toLowerCase();
}

function labelForEntitlement(ent: string, days: number | null): string {
  switch (ent) {
    case 'PRO':
      return 'Shotday Pro';
    case 'TRIAL':
      return days === 0 ? 'Trial ends today' : `Trial — ${days} day${days === 1 ? '' : 's'} left`;
    case 'EXPIRED':
      return 'Trial ended';
    default:
      return 'Free trial';
  }
}

function sublabelForEntitlement(ent: string, _days: number | null): string {
  switch (ent) {
    case 'PRO':
      return 'Active subscription';
    case 'TRIAL':
      return 'Tap to upgrade now';
    case 'EXPIRED':
      return 'Subscribe to keep tracking';
    default:
      return 'Tap to view plans';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { flexBasis: '30%', flexGrow: 1 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalAnchor: { justifyContent: 'flex-end' },
  modalCard: { padding: 24, paddingBottom: 36 },
  modalInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 12,
    minHeight: 48,
  },
  weightRow: { flexDirection: 'row', alignItems: 'center' },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlign: 'center',
  },
});
