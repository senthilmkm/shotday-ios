import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { TimelineRow } from './TimelineRow';
import {
  buildTimeline,
  bucketByDay,
  dayKey,
  friendlyDateLabel,
  startOfDay,
  type TimelineEntry,
} from './timeline';
import type { ShotdayDb } from '../../types/domain';

interface HistoryCalendarProps {
  db: ShotdayDb;
  onDeleteEntry?: (entry: TimelineEntry) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Month-grid calendar. Days with logged entries show one to four colored
 * dots (one per data type: shot / check-in / food / dose). Tapping a
 * day reveals that day's entries below. Defaults to "today" so opening
 * the screen always shows something useful.
 */
export function HistoryCalendar({ db, onDeleteEntry }: HistoryCalendarProps): React.ReactElement {
  const theme = useTheme();

  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState<Date>(() => firstOfMonth(today));
  const [selected, setSelected] = useState<Date>(today);

  const buckets = useMemo(() => bucketByDay(buildTimeline(db)), [db]);
  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const onPrevMonth = (): void => {
    const next = new Date(cursor);
    next.setMonth(cursor.getMonth() - 1);
    setCursor(next);
  };
  const onNextMonth = (): void => {
    const next = new Date(cursor);
    next.setMonth(cursor.getMonth() + 1);
    setCursor(next);
  };

  const selectedKey = dayKey(selected);
  const selectedEntries = buckets.get(selectedKey) ?? [];

  return (
    <View>
      {/* ─── Month header ─────────────────────────────────────── */}
      <View style={[styles.monthHeader, { marginTop: theme.spacing.lg }]}>
        <Pressable
          onPress={onPrevMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
        >
          <ChevronLeft size={20} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>{monthLabel}</Text>
        <Pressable
          onPress={onNextMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
        >
          <ChevronRight size={20} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ─── Weekday header ───────────────────────────────────── */}
      <View style={[styles.weekRow, { marginTop: theme.spacing.md }]}>
        {WEEKDAY_LABELS.map((d, i) => (
          <Text
            key={`wd-${i}`}
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, textAlign: 'center', flex: 1 },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* ─── Day grid ─────────────────────────────────────────── */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (cell === null) {
            return <View key={`blank-${idx}`} style={styles.cell} />;
          }
          const cellKey = dayKey(cell);
          const isToday = cellKey === dayKey(today);
          const isSelected = cellKey === selectedKey;
          const dayEntries = buckets.get(cellKey) ?? [];
          const dotKinds = uniqueKinds(dayEntries);

          return (
            <Pressable
              key={cellKey}
              onPress={() => setSelected(cell)}
              accessibilityRole="button"
              accessibilityLabel={`${cell.toLocaleDateString([], { month: 'long', day: 'numeric' })}${
                dayEntries.length > 0 ? `, ${dayEntries.length} entries` : ', no entries'
              }`}
              style={({ pressed }) => [
                styles.cell,
                {
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.dayBubble,
                  isSelected && {
                    backgroundColor: theme.colors.primary,
                  },
                  !isSelected && isToday && {
                    borderWidth: 1,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: isSelected
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                      fontWeight: isToday || isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {cell.getDate()}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {dotKinds.map((kind) => (
                  <View
                    key={kind}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.onPrimary
                          : kindColor(kind, theme),
                      },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Legend ──────────────────────────────────────────── */}
      <View style={[styles.legendRow, { marginTop: theme.spacing.md }]}>
        <Legend color={theme.colors.primary} label="Shot" />
        <Legend color={theme.colors.warning} label="Symptom" />
        <Legend color={theme.colors.success} label="Food" />
        <Legend color={theme.colors.textMuted} label="Dose" />
      </View>

      {/* ─── Selected-day entries ────────────────────────────── */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text
          style={[
            theme.typography.captionMedium,
            { color: theme.colors.textMuted, letterSpacing: 0.5, marginBottom: theme.spacing.md },
          ]}
        >
          {friendlyDateLabel(selected).toUpperCase()}
          {selectedEntries.length > 0 ? ` · ${selectedEntries.length} ENTRIES` : ''}
        </Text>

        {selectedEntries.length === 0 ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Nothing logged on this day.
          </Text>
        ) : (
          selectedEntries.map((entry, idx) => (
            <TimelineRow
              key={`${entry.kind}-${idx}-${entry.date.getTime()}`}
              entry={entry}
              isLast={idx === selectedEntries.length - 1}
              onLongPress={onDeleteEntry}
            />
          ))
        )}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 4 }]}>
        {label}
      </Text>
    </View>
  );
}

function firstOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns an array of 35 or 42 cells representing the month grid.
 * `null` cells are leading blanks before day 1.
 */
function buildMonthCells(cursorMonthFirstDay: Date): (Date | null)[] {
  const out: (Date | null)[] = [];
  const firstWeekday = cursorMonthFirstDay.getDay();
  for (let i = 0; i < firstWeekday; i++) {
    out.push(null);
  }
  const month = cursorMonthFirstDay.getMonth();
  const year = cursorMonthFirstDay.getFullYear();
  // Walk forward until the month flips; gives us the right number of days per month.
  const probe = new Date(year, month, 1);
  while (probe.getMonth() === month) {
    out.push(new Date(probe));
    probe.setDate(probe.getDate() + 1);
  }
  return out;
}

function uniqueKinds(entries: TimelineEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) seen.add(e.kind);
  // Stable display order so dots don't shuffle between renders.
  const order = ['injection', 'side-effect', 'food', 'dose-change'];
  return order.filter((k) => seen.has(k));
}

function kindColor(kind: string, theme: ReturnType<typeof useTheme>): string {
  switch (kind) {
    case 'injection':
      return theme.colors.primary;
    case 'side-effect':
      return theme.colors.warning;
    case 'food':
      return theme.colors.success;
    case 'dose-change':
      return theme.colors.textMuted;
    default:
      return theme.colors.textMuted;
  }
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
