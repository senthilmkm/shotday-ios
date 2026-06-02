import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
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
  const [filledDate, setFilledDate] = useState<Date>(
    existing ? new Date(existing.lastFilledAt) : new Date(),
  );

  const today = useMemo(() => new Date(), []);
  const status = useMemo(
    () => refillStatus(existing, db.injections, today),
    [existing, db.injections, today],
  );

  const dosesPerPenNum = parseInt(dosesPerPen, 10);
  const validDoses = Number.isFinite(dosesPerPenNum) && dosesPerPenNum > 0;

  const onSaveSetup = (): void => {
    if (!validDoses) {
      Alert.alert('Invalid', 'Doses per pen must be a positive whole number.');
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
            const today = new Date();
            updateDb((prev) => ({
              ...prev,
              refill: {
                dosesPerPen: prev.refill?.dosesPerPen ?? defaultDosesPerPen(prev.profile.drug),
                lastFilledAt: today.toISOString(),
                refillRequested: false,
              },
            }));
            setFilledDate(today);
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
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Refill</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
          We count down from each shot you log so you don't run out.
        </Text>

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
        <View style={[styles.dateRow]}>
          <Pressable
            onPress={() => {
              const earlier = new Date(filledDate);
              earlier.setDate(earlier.getDate() - 7);
              setFilledDate(earlier);
              Haptics.selectionAsync().catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Move last filled date back one week"
            style={({ pressed }) => [
              styles.dateBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>−1 wk</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
              {filledDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Pressable
              onPress={() => setFilledDate(new Date())}
              accessibilityRole="button"
              accessibilityLabel="Reset last filled date to today"
              style={({ pressed }) => [{ marginTop: 4, opacity: pressed ? 0.5 : 1 }]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>Today</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              const later = new Date(filledDate);
              later.setDate(later.getDate() + 7);
              if (later.getTime() > Date.now()) return;
              setFilledDate(later);
              Haptics.selectionAsync().catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Move last filled date forward one week"
            style={({ pressed }) => [
              styles.dateBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>+1 wk</Text>
          </Pressable>
        </View>

        <Button
          label={status.unconfigured ? 'Turn on refill tracking' : 'Save changes'}
          fullWidth
          size="lg"
          disabled={!validDoses}
          onPress={onSaveSetup}
          style={{ marginTop: 24 }}
        />

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
            label="I picked up my refill"
            variant="secondary"
            fullWidth
            onPress={onMarkPickedUp}
            style={{ marginTop: 16 }}
          />
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
});
