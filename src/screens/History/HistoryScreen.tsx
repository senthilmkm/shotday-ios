import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Calendar as CalendarIcon, ChartLine, List as ListIcon, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePickerSheet } from '../../components/DateTimePickerSheet';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { HistoryCalendar } from './HistoryCalendar';
import { HistoryCharts } from './HistoryCharts';
import { HistoryList } from './HistoryList';
import {
  entryKindLabel,
  removeTimelineEntry,
  updateInjectionTakenAt,
  type TimelineEntry,
} from './timeline';

type Nav = NativeStackNavigationProp<AppStackParamList, 'History'>;

type Mode = 'list' | 'calendar' | 'charts';

const MODES: { id: Mode; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'charts', label: 'Charts' },
];

/**
 * History screen — three views in one modal:
 *
 *   List      – chronological timeline grouped by day
 *   Calendar  – month grid; tap a date to see its entries
 *   Charts    – 4 stat strip + 3 simple SVG charts
 *
 * One segmented toggle near the top swaps between them. We keep this
 * single-screen instead of pushing sub-routes so the user never has
 * to "go back twice" to dismiss History.
 */
export function HistoryScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();
  const [mode, setMode] = useState<Mode>('list');
  // For "Edit time" on a logged shot. We render a single shared
  // DateTimePickerSheet driven by `editingInjection`. When non-null
  // the sheet opens and the user can change the takenAt timestamp.
  const [editingInjectionId, setEditingInjectionId] = useState<string | null>(null);
  const [editingInjectionDate, setEditingInjectionDate] = useState<Date>(() => new Date());

  const confirmDelete = useCallback(
    (entry: TimelineEntry): void => {
      const kindLabel = entryKindLabel(entry.kind);
      Alert.alert(
        `Remove this ${kindLabel}?`,
        'This entry will be removed from your timeline. Other history is unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              updateDb((prev) => removeTimelineEntry(prev, entry));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            },
          },
        ],
      );
    },
    [updateDb],
  );

  /**
   * Long-press handler. For a logged injection we offer a 3-way
   * action sheet: edit the time (most-requested correction), delete,
   * or cancel. Other entry kinds fall through to the simpler delete
   * confirmation.
   */
  const onEntryLongPress = useCallback(
    (entry: TimelineEntry): void => {
      if (entry.kind !== 'injection') {
        confirmDelete(entry);
        return;
      }
      const inj = entry.data;
      Alert.alert(
        'Edit shot',
        `Logged at ${new Date(inj.takenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`,
        [
          {
            text: 'Edit time',
            onPress: () => {
              setEditingInjectionId(inj.id);
              setEditingInjectionDate(new Date(inj.takenAt));
            },
          },
          { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(entry) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    },
    [confirmDelete],
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <Text style={[theme.typography.title, { color: theme.colors.text, flex: 1 }]}>History</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close history"
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

      {/* ─── Mode toggle ───────────────────────────────────────── */}
      <View style={[styles.toggleRow, { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }]}>
        <View
          style={[
            styles.toggleGroup,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m.label}
                style={({ pressed }) => [
                  styles.toggleCell,
                  {
                    backgroundColor: active ? theme.colors.surface : 'transparent',
                    borderRadius: theme.radii.sm,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <ModeIcon mode={m.id} active={active} theme={theme} />
                <Text
                  style={[
                    theme.typography.captionMedium,
                    {
                      color: active ? theme.colors.text : theme.colors.textMuted,
                      marginLeft: 6,
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {mode === 'list' && <HistoryList db={db} onDeleteEntry={onEntryLongPress} />}
        {mode === 'calendar' && <HistoryCalendar db={db} onDeleteEntry={onEntryLongPress} />}
        {mode === 'charts' && <HistoryCharts db={db} />}
      </ScrollView>

      <DateTimePickerSheet
        visible={editingInjectionId !== null}
        mode="datetime"
        title="When was this shot?"
        initialDate={editingInjectionDate}
        maximumDate={new Date()}
        onClose={() => setEditingInjectionId(null)}
        onConfirm={(d) => {
          if (editingInjectionId) {
            const id = editingInjectionId;
            updateDb((prev) => updateInjectionTakenAt(prev, id, d));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }}
      />
    </SafeAreaView>
  );
}

function ModeIcon({
  mode,
  active,
  theme,
}: {
  mode: Mode;
  active: boolean;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const color = active ? theme.colors.text : theme.colors.textMuted;
  if (mode === 'list') return <ListIcon size={16} color={color} strokeWidth={2} />;
  if (mode === 'calendar') return <CalendarIcon size={16} color={color} strokeWidth={2} />;
  return <ChartLine size={16} color={color} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {},
  toggleGroup: {
    flexDirection: 'row',
    padding: 4,
  },
  toggleCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
