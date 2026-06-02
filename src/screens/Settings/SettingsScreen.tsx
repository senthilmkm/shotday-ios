import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { NOT_MEDICAL_ADVICE_SHORT } from '../../copy/disclaimers';
import {
  PRIVACY_URL,
  SUBSCRIPTION_DISCLOSURE_SHORT,
  TERMS_URL,
} from '../../copy/subscription';
import {
  computeEntitlement,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { proteinTargetGrams } from '../../domain/protein';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type {
  DayOfWeek,
  ThemePreference,
} from '../../types/domain';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

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

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
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

  const setHour = (
    field: 'shotReminderHour' | 'sideEffectPromptHour' | 'refillReminderHour' | 'quietHoursStart' | 'quietHoursEnd',
    delta: number,
  ): void => {
    Haptics.selectionAsync().catch(() => {});
    updateDb((prev) => {
      const next = (prev.profile[field] + delta + 24) % 24;
      return { ...prev, profile: { ...prev.profile, [field]: next } };
    });
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
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
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
            onPress={() => navigation.navigate('DoseLadder')}
            accessibilityRole="button"
            accessibilityLabel={`Drug and dose: ${profile.drug === 'OTHER' && profile.customDrugName ? profile.customDrugName : prettyDrug(profile.drug)}${profile.currentDoseLabel ? `, ${profile.currentDoseLabel}` : ''}`}
            accessibilityHint="Opens the dose ladder screen"
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
                {profile.drug === 'OTHER' && profile.customDrugName
                  ? profile.customDrugName
                  : prettyDrug(profile.drug)}
                {profile.currentDoseLabel && ` · ${profile.currentDoseLabel}`}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Tap to view ladder + history
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>›</Text>
          </Pressable>
        </Section>

        <Section title="WEIGHT + PROTEIN TARGET" theme={theme}>
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
                {profile.weight} {profile.weightUnit.toLowerCase()}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {proteinTarget} g protein/day
              </Text>
            </View>
          </View>
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
          <HourPicker
            label="Shot day"
            sublabel="Weekly reminder on shot day"
            value={profile.shotReminderHour}
            onMinus={() => setHour('shotReminderHour', -1)}
            onPlus={() => setHour('shotReminderHour', 1)}
            theme={theme}
          />
          <HourPicker
            label="Side-effect check"
            sublabel="Day after shot day"
            value={profile.sideEffectPromptHour}
            onMinus={() => setHour('sideEffectPromptHour', -1)}
            onPlus={() => setHour('sideEffectPromptHour', 1)}
            theme={theme}
          />
          <HourPicker
            label="Refill nudge"
            sublabel="Fires when running low"
            value={profile.refillReminderHour}
            onMinus={() => setHour('refillReminderHour', -1)}
            onPlus={() => setHour('refillReminderHour', 1)}
            theme={theme}
          />
        </Section>

        <Section title="QUIET HOURS" theme={theme}>
          <View style={styles.quietRow}>
            <HourPicker
              label="Start"
              value={profile.quietHoursStart}
              onMinus={() => setHour('quietHoursStart', -1)}
              onPlus={() => setHour('quietHoursStart', 1)}
              theme={theme}
              compact
            />
            <View style={{ width: 12 }} />
            <HourPicker
              label="End"
              value={profile.quietHoursEnd}
              onMinus={() => setHour('quietHoursEnd', -1)}
              onPlus={() => setHour('quietHoursEnd', 1)}
              theme={theme}
              compact
            />
          </View>
          <Text
            style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}
          >
            Notifications scheduled inside this window are skipped.
          </Text>
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

        {/* ─── Refill quick access ─────────────────────── */}
        <Section title="REFILL TRACKING" theme={theme}>
          <Pressable
            onPress={() => navigation.navigate('Refill')}
            accessibilityRole="button"
            accessibilityLabel={`Refill tracking: ${db.refill ? 'configured' : 'not configured'}`}
            accessibilityHint="Opens the refill screen"
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
                {db.refill ? 'Configured' : 'Not configured'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {db.refill
                  ? `${db.refill.dosesPerPen} dose${db.refill.dosesPerPen === 1 ? '' : 's'}/pen`
                  : 'Tap to set up'}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>›</Text>
          </Pressable>
        </Section>

        {/* ─── Notifications system link ─────────────────── */}
        <Section title="NOTIFICATIONS" theme={theme}>
          <Pressable
            onPress={() => Linking.openSettings().catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Open system notification settings"
            accessibilityHint="Opens the iOS Settings app"
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
                System permissions
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Open iOS Settings to enable / disable
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

      <Button
        label="Done"
        fullWidth
        size="lg"
        onPress={() => navigation.goBack()}
        style={{ margin: theme.spacing.lg, marginTop: 0 }}
      />
    </SafeAreaView>
  );
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

interface HourPickerProps {
  label: string;
  sublabel?: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  theme: ReturnType<typeof useTheme>;
  compact?: boolean;
}

function HourPicker({ label, sublabel, value, onMinus, onPlus, theme, compact }: HourPickerProps): React.ReactElement {
  return (
    <View
      style={[
        styles.hourRow,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          marginBottom: 8,
          flex: compact ? 1 : undefined,
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
      <View
        style={styles.hourPicker}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, currently ${formatHour(value)}`}
        accessibilityHint="Use the minus and plus buttons to change the hour"
      >
        <Pressable
          onPress={onMinus}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()} by one hour`}
          style={({ pressed }) => [
            styles.hourBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>−</Text>
        </Pressable>
        <Text
          style={[
            theme.typography.heading,
            { color: theme.colors.text, marginHorizontal: 12, minWidth: 56, textAlign: 'center' },
          ]}
        >
          {formatHour(value)}
        </Text>
        <Pressable
          onPress={onPlus}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()} by one hour`}
          style={({ pressed }) => [
            styles.hourBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
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
  quietRow: { flexDirection: 'row' },
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
  hourPicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
