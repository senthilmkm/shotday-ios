import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { DateTimePickerSheet } from '../../components/DateTimePickerSheet';
import { defaultDosesPerPen, refillStatus } from '../../domain/refill';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function RefillScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();

  const existing = db.refill;
  const [dosesPerPen, setDosesPerPen] = useState<string>(
    existing?.dosesPerPen != null
      ? String(existing.dosesPerPen)
      : String(defaultDosesPerPen(db.profile.drug)),
  );
  // First-time setup: leave the date unset until the user explicitly
  // picks one. The previous behavior of defaulting to today caused
  // people to silently accept "today" when the refill was actually
  // last week, which throws off the dose-remaining count from day one.
  const [filledDate, setFilledDate] = useState<Date | null>(
    existing ? new Date(existing.lastFilledAt) : null,
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const status = useMemo(
    () => refillStatus(existing, db.injections, today),
    [existing, db.injections, today],
  );

  const dosesPerPenNum = parseInt(dosesPerPen, 10);
  const validDoses = Number.isFinite(dosesPerPenNum) && dosesPerPenNum > 0;
  const canSave = validDoses && filledDate !== null;

  const onSaveSetup = (): void => {
    if (!validDoses) {
      Alert.alert('Invalid', 'Doses per pen must be a positive whole number.');
      return;
    }
    if (!filledDate) {
      Alert.alert('Pick a date', 'Tap "Last filled" and choose when this pen was filled.');
      return;
    }
    updateDb((prev) => ({
      ...prev,
      refill: {
        dosesPerPen: dosesPerPenNum,
        lastFilledAt: filledDate.toISOString(),
        refillRequested: prev.refill?.refillRequested ?? false,
      },
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Saved', 'Refill tracking is on.');
  };

  const onToggleRequested = (next: boolean): void => {
    updateDb((prev) => ({
      ...prev,
      refill: prev.refill
        ? { ...prev.refill, refillRequested: next }
        : prev.refill,
    }));
    Haptics.selectionAsync().catch(() => {});
  };

  const onMarkPickedUp = (): void => {
    Alert.alert(
      'Picked up your refill?',
      'This resets the count to a full pen, starting today.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'default',
          onPress: () => {
            const pickedUpAt = new Date();
            updateDb((prev) => ({
              ...prev,
              refill: {
                dosesPerPen: prev.refill?.dosesPerPen ?? defaultDosesPerPen(prev.profile.drug),
                lastFilledAt: pickedUpAt.toISOString(),
                refillRequested: false,
              },
            }));
            setFilledDate(pickedUpAt);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ],
    );
  };

  const onResetAll = (): void => {
    Alert.alert('Disable refill tracking?', 'You can re-enable it any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: () => {
          updateDb((prev) => ({ ...prev, refill: null }));
          navigation.goBack();
        },
      },
    ]);
  };

  const alertColor =
    status.alertLevel === 'EMPTY' || status.alertLevel === 'URGENT'
      ? theme.colors.danger
      : status.alertLevel === 'INFO'
        ? theme.colors.warning
        : theme.colors.success;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>Refill</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            We count down from each shot you log so you don't run out.
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close refill"
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

        {/* ─── Status pill (only if configured) ────────────── */}
        {!status.unconfigured && (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: alertColor,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Text style={[theme.typography.captionMedium, { color: alertColor }]}>
              {labelForLevel(status.alertLevel)}
            </Text>
            <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 4 }]}>
              {status.dosesRemaining} / {status.dosesPerPen}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
              dose{status.dosesRemaining === 1 ? '' : 's'} left in this pen
            </Text>
          </View>
        )}

        {/* ─── Setup form ───────────────────────────────────── */}
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: 28, marginBottom: 8 },
          ]}
        >
          DOSES PER PEN
        </Text>
        <View style={styles.row}>
          {[1, 2, 4].map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setDosesPerPen(String(n));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: dosesPerPenNum === n }}
              accessibilityLabel={`${n} dose${n === 1 ? '' : 's'} per pen`}
              style={({ pressed }) => [
                styles.numChip,
                {
                  backgroundColor:
                    dosesPerPenNum === n ? theme.colors.primary : theme.colors.surface,
                  borderColor:
                    dosesPerPenNum === n ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radii.full,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.bodyMedium,
                  { color: dosesPerPenNum === n ? theme.colors.onPrimary : theme.colors.text },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
          <TextInput
            value={dosesPerPen}
            onChangeText={setDosesPerPen}
            keyboardType="number-pad"
            placeholder="custom"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Custom doses per pen"
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
            maxLength={3}
          />
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
          Ozempic / Wegovy pens hold 4 doses. Mounjaro / Zepbound vials hold 1.
        </Text>

        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, marginTop: 24, marginBottom: 8 },
          ]}
        >
          LAST FILLED
        </Text>
        <Pressable
          onPress={() => setDatePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={
            filledDate
              ? `Last filled: ${filledDate.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}. Tap to change.`
              : 'Last filled date not set. Tap to choose a date.'
          }
          accessibilityHint="Opens a date picker"
          style={({ pressed }) => [
            styles.dateRowTap,
            {
              backgroundColor: theme.colors.surface,
              borderColor: filledDate ? theme.colors.border : theme.colors.warning,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            {filledDate ? (
              <>
                <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
                  {filledDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                  {daysAgoLabel(filledDate)}
                </Text>
              </>
            ) : (
              <>
                <Text style={[theme.typography.heading, { color: theme.colors.textMuted }]}>
                  Pick a date
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.warning, marginTop: 2 }]}>
                  Required — when did you fill this pen?
                </Text>
              </>
            )}
          </View>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
            {filledDate ? 'Edit' : 'Choose'}
          </Text>
        </Pressable>

        {/*
         * Single-primary-action stack. The audit found that when all three
         * buttons (save / pick up / disable) are full-width primary stacks
         * the user can't tell which is the "right" thing to tap. We pick
         * one CTA based on status and demote the others.
         *
         *   unconfigured    → primary: "Turn on refill tracking"
         *   EMPTY / URGENT  → primary: "I picked up my refill"
         *   INFO / NONE     → primary: "Save changes"
         */}
        {(() => {
          if (status.unconfigured) {
            return (
              <Button
                label="Turn on refill tracking"
                fullWidth
                size="lg"
                disabled={!canSave}
                onPress={onSaveSetup}
                style={{ marginTop: 24 }}
              />
            );
          }

          const showPickedUpAsPrimary =
            status.alertLevel === 'EMPTY' || status.alertLevel === 'URGENT';

          if (showPickedUpAsPrimary) {
            return (
              <>
                <Button
                  label="I picked up my refill"
                  fullWidth
                  size="lg"
                  onPress={onMarkPickedUp}
                  style={{ marginTop: 24 }}
                />
                <Button
                  label="Save changes"
                  variant="secondary"
                  fullWidth
                  disabled={!canSave}
                  onPress={onSaveSetup}
                  style={{ marginTop: 12 }}
                />
              </>
            );
          }

          return (
            <>
              <Button
                label="Save changes"
                fullWidth
                size="lg"
                disabled={!canSave}
                onPress={onSaveSetup}
                style={{ marginTop: 24 }}
              />
              <Button
                label="I picked up my refill"
                variant="secondary"
                fullWidth
                onPress={onMarkPickedUp}
                style={{ marginTop: 12 }}
              />
            </>
          );
        })()}

        {/* ─── Refill-requested toggle (if configured) ────── */}
        {!status.unconfigured && (
          <View
            style={[
              styles.toggleRow,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                marginTop: 32,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                Refill requested
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Silences the urgent alert until you mark "picked up".
              </Text>
            </View>
            <Switch
              value={status.refillRequested}
              onValueChange={onToggleRequested}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              accessibilityLabel="Refill requested"
              accessibilityHint="Silences the urgent refill alert until you mark the refill as picked up"
            />
          </View>
        )}

        {!status.unconfigured && (
          <Button
            label="Disable refill tracking"
            variant="ghost"
            fullWidth
            haptic={false}
            onPress={onResetAll}
            style={{ marginTop: 12 }}
          />
        )}
      </ScrollView>

      <DateTimePickerSheet
        mode="date"
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        title="When was this filled?"
        initialDate={filledDate ?? new Date()}
        maximumDate={new Date()}
        onConfirm={(d) => setFilledDate(d)}
      />
    </SafeAreaView>
  );
}

function daysAgoLabel(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function labelForLevel(level: 'NONE' | 'INFO' | 'URGENT' | 'EMPTY'): string {
  switch (level) {
    case 'EMPTY':
      return 'NO DOSES LEFT';
    case 'URGENT':
      return 'REFILL NEEDED';
    case 'INFO':
      return 'HEADS UP';
    case 'NONE':
      return 'STOCKED';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statusCard: {
    marginTop: 16,
    padding: 16,
    borderWidth: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    textAlign: 'center',
    marginLeft: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  dateRowTap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
});
