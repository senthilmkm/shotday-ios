import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
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
import { DOSE_CHANGE_DISCLAIMER } from '../../copy/disclaimers';
import {
  daysUntilEligibleToBump,
  isOffLadder,
  ladderIdForDrug,
  nextRung,
  rungIndexForMg,
  rungsForDrug,
  STANDARD_ESCALATION_INTERVAL_DAYS,
} from '../../domain/dose';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { DoseRung } from '../../types/domain';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function DoseLadderScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();

  const ladder = ladderIdForDrug(db.profile.drug);
  const rungs = rungsForDrug(db.profile.drug);
  const isCustom = rungs.length === 0;
  const currentMg = db.profile.currentDoseMg;
  const currentIdx = rungIndexForMg(db.profile.drug, currentMg);
  const upcoming = nextRung(db.profile.drug, currentMg);
  const stranded = isOffLadder(db.profile.drug, currentMg);

  const lastChange = db.doseHistory[db.doseHistory.length - 1];
  const today = useMemo(() => new Date(), []);
  const daysToBump = lastChange
    ? daysUntilEligibleToBump(new Date(lastChange.startedAt), today)
    : 0;
  const eligible = daysToBump === 0;

  const [customOpen, setCustomOpen] = useState(false);
  const [customMg, setCustomMg] = useState('');

  const bumpTo = (rung: DoseRung): void => {
    Alert.alert(
      `Move up to ${rung.label}?`,
      'Future shots will be logged at this dose. Past entries are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => commit(rung.label, rung.mg),
        },
      ],
    );
  };

  const dropTo = (rung: DoseRung): void => {
    Alert.alert(
      `Step back to ${rung.label}?`,
      'Use this if your doctor lowered your dose or side effects became too strong.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => commit(rung.label, rung.mg),
        },
      ],
    );
  };

  const commit = (label: string, mg: number): void => {
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, currentDoseMg: mg, currentDoseLabel: label },
      doseHistory: [
        ...prev.doseHistory,
        { id: `dose-${Date.now()}`, startedAt: new Date().toISOString(), label, mg },
      ],
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onSaveCustom = (): void => {
    const mg = parseFloat(customMg);
    if (!Number.isFinite(mg) || mg <= 0) {
      Alert.alert('Invalid', 'Enter a positive number of milligrams.');
      return;
    }
    commit(`${mg} mg`, mg);
    setCustomMg('');
    setCustomOpen(false);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>Dose ladder</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            {db.profile.drug === 'OTHER' && db.profile.customDrugName
              ? db.profile.customDrugName
              : prettyDrug(db.profile.drug)}
            {!isCustom && ` · ${ladder === 'SEMAGLUTIDE' ? 'semaglutide' : 'tirzepatide'}`}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close dose ladder"
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: 999,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <X size={18} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0 }}>

        {/* ─── Eligibility / off-ladder banner ──────────────── */}
        <View
          style={[
            styles.banner,
            {
              backgroundColor: stranded
                ? theme.colors.surface
                : eligible
                  ? theme.colors.surfaceMuted
                  : theme.colors.surface,
              borderColor: stranded
                ? theme.colors.warning
                : eligible
                  ? theme.colors.primary
                  : theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.captionMedium,
              {
                color: stranded
                  ? theme.colors.warning
                  : eligible
                    ? theme.colors.primary
                    : theme.colors.textMuted,
              },
            ]}
          >
            {stranded ? 'OFF THE STANDARD LADDER' : eligible ? 'ELIGIBLE TO BUMP' : 'NOT YET'}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 4 }]}>
            {stranded
              ? `${db.profile.currentDoseLabel || `${currentMg} mg`} isn\u2019t a standard ${prettyDrug(db.profile.drug).toLowerCase()} dose. Pick a rung below to align with the FDA schedule, or use \u201CEnter a custom dose\u201D if your prescriber set this on purpose.`
              : !lastChange
                ? `Set a starting dose first.`
                : eligible
                  ? upcoming
                    ? `You can move up to ${upcoming.label} when ready.`
                    : 'You\u2019re at the top of the ladder.'
                  : `${daysToBump} day${daysToBump === 1 ? '' : 's'} until you\u2019ve been on ${db.profile.currentDoseLabel} for the standard ${STANDARD_ESCALATION_INTERVAL_DAYS}-day window.`}
          </Text>
        </View>

        {/* ─── Ladder visualization ─────────────────────────── */}
        {!isCustom ? (
          <View style={{ marginTop: 24 }}>
            {[...rungs].reverse().map((rung) => {
              const isCurrent = rung.mg === currentMg;
              const isPast = currentIdx >= 0 && rung.mg < currentMg;
              const isFuture = currentIdx >= 0 && rung.mg > currentMg;
              const isNextStep = upcoming?.mg === rung.mg;
              return (
                <Pressable
                  key={rung.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isCurrent, disabled: isCurrent }}
                  accessibilityLabel={
                    isCurrent
                      ? `${rung.label}, current dose`
                      : isNextStep
                        ? `${rung.label}, next step`
                        : isPast
                          ? `${rung.label}, previous rung`
                          : `${rung.label}, future rung`
                  }
                  accessibilityHint={
                    isCurrent
                      ? undefined
                      : isFuture
                        ? eligible
                          ? 'Confirms a dose increase'
                          : 'Not eligible yet — opens override dialog'
                        : 'Confirms a dose decrease'
                  }
                  onPress={() => {
                    if (isCurrent) return;
                    if (isFuture) {
                      if (!eligible) {
                        Alert.alert(
                          'Not eligible yet',
                          `Standard practice is to stay on each dose for ${STANDARD_ESCALATION_INTERVAL_DAYS} days. ${daysToBump} day${daysToBump === 1 ? '' : 's'} to go.`,
                          [
                            { text: 'OK', style: 'cancel' },
                            { text: 'Bump anyway', style: 'destructive', onPress: () => bumpTo(rung) },
                          ],
                        );
                      } else {
                        bumpTo(rung);
                      }
                    } else if (isPast) {
                      dropTo(rung);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.rung,
                    {
                      backgroundColor: isCurrent
                        ? theme.colors.primary
                        : isNextStep
                          ? theme.colors.surfaceMuted
                          : theme.colors.surface,
                      borderColor: isCurrent
                        ? theme.colors.primary
                        : isNextStep
                          ? theme.colors.primary
                          : theme.colors.border,
                      borderRadius: theme.radii.md,
                      opacity: isFuture && !isNextStep ? 0.55 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.rungLeft}>
                    <Text
                      style={[
                        theme.typography.heading,
                        { color: isCurrent ? theme.colors.onPrimary : theme.colors.text },
                      ]}
                    >
                      {rung.label}
                    </Text>
                  </View>
                  <View style={styles.rungRight}>
                    {isCurrent && (
                      <Text style={[theme.typography.captionMedium, { color: theme.colors.onPrimary }]}>
                        Current
                      </Text>
                    )}
                    {isNextStep && !isCurrent && (
                      <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                        Next →
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: 24 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
              No standard ladder for {db.profile.customDrugName || 'this drug'}. Use the custom button below
              to log dose changes.
            </Text>
          </View>
        )}

        {/* ─── Custom override ──────────────────────────────── */}
        <Button
          label="Enter a custom dose"
          variant="ghost"
          fullWidth
          haptic={false}
          onPress={() => setCustomOpen(true)}
          style={{ marginTop: 24 }}
        />

        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              marginTop: 16,
              lineHeight: 18,
              textAlign: 'center',
            },
          ]}
        >
          {DOSE_CHANGE_DISCLAIMER}
        </Text>

        {/* ─── Recent history ───────────────────────────────── */}
        {db.doseHistory.length > 0 && (
          <>
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 32, marginBottom: 12 },
              ]}
            >
              HISTORY
            </Text>
            {[...db.doseHistory].reverse().slice(0, 6).map((h) => (
              <View
                key={h.id}
                style={[
                  styles.historyRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{h.label}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  {prettyDate(new Date(h.startedAt))}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ─── Custom-dose modal ─────────────────────────── */}
      <Modal animationType="slide" transparent visible={customOpen} onRequestClose={() => setCustomOpen(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCustomOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss custom dose sheet"
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
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Custom dose</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              Use this for off-ladder or compounded doses.
            </Text>
            <TextInput
              value={customMg}
              onChangeText={setCustomMg}
              placeholder="e.g. 0.7"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Custom dose in milligrams"
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
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
              milligrams (mg)
            </Text>
            <Button label="Save" fullWidth size="lg" onPress={onSaveCustom} style={{ marginTop: 16 }} />
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

function prettyDrug(d: string): string {
  return d.charAt(0) + d.slice(1).toLowerCase();
}

function prettyDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  banner: {
    marginTop: 24,
    padding: 14,
    borderWidth: 1,
  },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    marginBottom: 8,
  },
  rungLeft: { flex: 1 },
  rungRight: { alignItems: 'flex-end' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalAnchor: { justifyContent: 'flex-end' },
  modalCard: { padding: 24, paddingBottom: 36 },
  modalInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 16,
    minHeight: 48,
    textAlign: 'center',
  },
});
