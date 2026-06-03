import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DateTimePickerSheet } from '../../components/DateTimePickerSheet';
import { rungsForDrug } from '../../domain/dose';
import { proteinTargetGrams } from '../../domain/protein';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { DayOfWeek, DrugFamily, WeightUnit } from '../../types/domain';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'QuickSetup'>;

const DRUG_OPTIONS: { value: DrugFamily; label: string }[] = [
  { value: 'OZEMPIC', label: 'Ozempic' },
  { value: 'WEGOVY', label: 'Wegovy' },
  { value: 'MOUNJARO', label: 'Mounjaro' },
  { value: 'ZEPBOUND', label: 'Zepbound' },
  { value: 'OTHER', label: 'Something else' },
];

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
];

export function QuickSetupScreen({}: Props): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();

  const [drug, setDrug] = useState<DrugFamily>(db.profile.drug ?? 'OZEMPIC');
  const [customName, setCustomName] = useState<string>(db.profile.customDrugName ?? '');
  const [doseMg, setDoseMg] = useState<number>(db.profile.currentDoseMg ?? 0);
  const [doseLabel, setDoseLabel] = useState<string>(db.profile.currentDoseLabel ?? '');
  const [customDoseStr, setCustomDoseStr] = useState<string>(
    db.profile.currentDoseMg && rungsForDrug(drug).length === 0
      ? String(db.profile.currentDoseMg)
      : '',
  );
  const [weightStr, setWeightStr] = useState<string>('');
  const [unit, setUnit] = useState<WeightUnit>(db.profile.weightUnit ?? 'LB');
  // Default Sunday but stash a "user explicitly confirmed" flag so we
  // can require an explicit choice before "Start tracking" enables.
  // The audit found that brand-new users were finishing onboarding
  // with the Sunday default whether or not it was right, then getting
  // misaligned reminders.
  const [shotDay, setShotDay] = useState<DayOfWeek | null>(
    db.profile.onboardingComplete ? db.profile.shotDay : null,
  );
  const [reminders, setReminders] = useState<boolean>(true);
  // "Since when?" for established-dose users so we don't slap them
  // with a fake 28-day countdown until eligibility on day one.
  const [doseStartedAt, setDoseStartedAt] = useState<Date>(new Date());
  const [doseDateOpen, setDoseDateOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const rungs = useMemo(() => rungsForDrug(drug), [drug]);
  const isCustomDrug = drug === 'OTHER';
  const hasLadder = rungs.length > 0;

  const weight = parseFloat(weightStr);
  const weightValid = Number.isFinite(weight) && weight > 0;

  const proteinPreview = useMemo<string>(() => {
    if (!weightValid) return '';
    try {
      return `~ ${proteinTargetGrams(weight, unit)} g protein/day`;
    } catch {
      return '';
    }
  }, [weight, unit, weightValid]);

  const customDoseNum = parseFloat(customDoseStr);
  const customDoseValid = Number.isFinite(customDoseNum) && customDoseNum > 0;

  const customNameValid = !isCustomDrug || customName.trim().length > 0;
  const hasDose =
    isCustomDrug ? customDoseValid : doseMg > 0;
  const canSubmit = customNameValid && shotDay !== null && !busy;

  const onSelectRung = (mg: number, label: string): void => {
    setDoseMg(mg);
    setDoseLabel(label);
  };

  const onClearDose = (): void => {
    setDoseMg(0);
    setDoseLabel('');
    setCustomDoseStr('');
  };

  const onSubmit = async (): Promise<void> => {
    if (shotDay === null) return; // canSubmit guard already checks this
    setBusy(true);
    try {
      if (reminders) {
        await Notifications.requestPermissionsAsync().catch(() => {});
      }

      const finalDoseMg = isCustomDrug
        ? customDoseValid
          ? customDoseNum
          : 0
        : doseMg;
      const finalDoseLabel = isCustomDrug
        ? customDoseValid
          ? `${customDoseNum} mg`
          : ''
        : doseLabel;

      const nowIso = new Date().toISOString();
      // Use the user's "Since when?" pick when present; otherwise the
      // dose history starts today. The 28-day "until eligible to bump"
      // counter is keyed off this date, so an established user who
      // says "I started this dose 3 weeks ago" will only have to wait
      // a week to be eligible — instead of a full month from install.
      const doseStartedIso = hasDose ? doseStartedAt.toISOString() : nowIso;

      updateDb((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          drug,
          customDrugName: isCustomDrug ? customName.trim() : undefined,
          currentDoseMg: finalDoseMg,
          currentDoseLabel: finalDoseLabel,
          weight: weightValid ? weight : 0,
          weightUnit: unit,
          weightUpdatedAt: weightValid ? nowIso : null,
          shotDay,
          notificationsEnabled: reminders,
          onboardingComplete: true,
          trialStartedAt: prev.profile.trialStartedAt ?? nowIso,
        },
        doseHistory:
          finalDoseMg > 0
            ? [
                ...prev.doseHistory,
                {
                  id: `dose-${Date.now()}`,
                  startedAt: doseStartedIso,
                  label: finalDoseLabel,
                  mg: finalDoseMg,
                },
              ]
            : prev.doseHistory,
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.bg }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Quick setup</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Fill these once. Everything stays on your phone.
        </Text>

        {/* ─── Medication ─────────────────────────────────────── */}
        <SectionLabel theme={theme}>MEDICATION</SectionLabel>
        <View style={styles.chipRow}>
          {DRUG_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={drug === opt.value}
              onPress={() => {
                setDrug(opt.value);
                setDoseMg(0);
                setDoseLabel('');
                setCustomDoseStr('');
              }}
              large
            />
          ))}
        </View>
        {isCustomDrug && (
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Drug name (e.g. compounded semaglutide)"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Drug name"
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                marginTop: theme.spacing.md,
              },
            ]}
            autoCapitalize="words"
            autoCorrect={false}
          />
        )}

        {/* ─── Current dose ───────────────────────────────────── */}
        <SectionLabel theme={theme}>
          CURRENT DOSE
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontWeight: '400' }]}>
            {'  '}· optional
          </Text>
        </SectionLabel>

        {hasLadder ? (
          <View style={styles.chipRow}>
            {rungs.map((r) => (
              <Chip
                key={r.label}
                label={r.label}
                selected={doseMg === r.mg}
                onPress={() => onSelectRung(r.mg, r.label)}
                large
              />
            ))}
            {doseMg > 0 && (
              <Chip label="Clear" selected={false} onPress={onClearDose} large />
            )}
          </View>
        ) : (
          <>
            <TextInput
              value={customDoseStr}
              onChangeText={setCustomDoseStr}
              placeholder="e.g. 0.25"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Current dose in milligrams"
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
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
              ]}
            >
              milligrams · typical compounded doses range 0.25–5.0 mg
            </Text>
          </>
        )}

        {hasDose && (
          <Pressable
            onPress={() => setDoseDateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Started this dose on ${formatDoseDate(doseStartedAt)}. Tap to change.`}
            style={({ pressed }) => [
              styles.doseSinceRow,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                marginTop: theme.spacing.md,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                STARTED THIS DOSE ON
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 2 }]}>
                {formatDoseDate(doseStartedAt)}
              </Text>
            </View>
            <Text style={[theme.typography.body, { color: theme.colors.primary }]}>Change</Text>
          </Pressable>
        )}

        {/* ─── Weight ─────────────────────────────────────────── */}
        <SectionLabel theme={theme}>
          WEIGHT
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontWeight: '400' }]}>
            {'  '}· optional · for protein target
          </Text>
        </SectionLabel>
        <View style={styles.weightRow}>
          <TextInput
            value={weightStr}
            onChangeText={setWeightStr}
            placeholder="0"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            accessibilityLabel="Body weight"
            style={[
              styles.weightInput,
              theme.typography.title,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
            maxLength={5}
          />
          <View style={{ width: theme.spacing.md }} />
          <Chip label="lb" selected={unit === 'LB'} onPress={() => setUnit('LB')} large />
          <View style={{ width: theme.spacing.sm }} />
          <Chip label="kg" selected={unit === 'KG'} onPress={() => setUnit('KG')} large />
        </View>
        {proteinPreview ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.primary, marginTop: theme.spacing.sm },
            ]}
          >
            {proteinPreview}
          </Text>
        ) : null}

        {/* ─── Shot day ───────────────────────────────────────── */}
        <SectionLabel theme={theme}>
          SHOT DAY
          <Text style={[theme.typography.caption, { color: theme.colors.danger, fontWeight: '400' }]}>
            {'  '}· required
          </Text>
        </SectionLabel>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginBottom: theme.spacing.sm, marginTop: -theme.spacing.sm },
          ]}
        >
          We send your reminder on this day.
        </Text>
        <View style={styles.dayRow}>
          {DAYS.map((d) => (
            <View key={d.value} style={styles.dayCell}>
              <Chip
                label={d.label}
                selected={shotDay === d.value}
                onPress={() => setShotDay(d.value)}
                large
              />
            </View>
          ))}
        </View>

        {/* ─── Reminders toggle ───────────────────────────────── */}
        <View
          style={[
            styles.reminderRow,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              marginTop: theme.spacing.xl,
              padding: theme.spacing.md,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
              Send weekly reminders
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, marginTop: 2 },
              ]}
            >
              3 gentle pings: shot day, day-after check-in, refill alert.
            </Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={setReminders}
            trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
            thumbColor={theme.colors.surface}
            accessibilityLabel="Send weekly reminders"
          />
        </View>

        {/* ─── Submit ─────────────────────────────────────────── */}
        <Button
          label="Start tracking"
          fullWidth
          size="lg"
          loading={busy}
          disabled={!canSubmit}
          onPress={onSubmit}
          style={{ marginTop: theme.spacing.xl }}
        />
        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              marginTop: theme.spacing.md,
              textAlign: 'center',
            },
          ]}
        >
          You can change anything later in Settings.
        </Text>
      </ScrollView>

      <DateTimePickerSheet
        visible={doseDateOpen}
        mode="date"
        title="Started this dose on"
        initialDate={doseStartedAt}
        maximumDate={new Date()}
        onClose={() => setDoseDateOpen(false)}
        onConfirm={(d) => setDoseStartedAt(d)}
      />
    </SafeAreaView>
  );
}

function formatDoseDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SectionLabelProps {
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}

function SectionLabel({ children, theme }: SectionLabelProps): React.ReactElement {
  return (
    <Text
      style={[
        theme.typography.captionMedium,
        {
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xl,
          marginBottom: theme.spacing.md,
          letterSpacing: 0.5,
        },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  weightRow: { flexDirection: 'row', alignItems: 'center' },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    textAlign: 'center',
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { flexBasis: '22%', flexGrow: 1 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  doseSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
});
