import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { TimelineRow } from './TimelineRow';
import {
  buildTimeline,
  bucketByDay,
  dayKey,
  friendlyDateLabel,
  type TimelineEntry,
} from './timeline';
import type { ShotdayDb } from '../../types/domain';

interface HistoryListProps {
  db: ShotdayDb;
  onDeleteEntry?: (entry: TimelineEntry) => void;
}

interface DateGroup {
  key: string;
  label: string;
  date: Date;
  entries: TimelineEntry[];
}

/**
 * Chronological timeline grouped by day. Newest first, with friendly date
 * headers ("Today", "Yesterday", or "Wed, Jun 5"). Renders an empty-state
 * card when there are no entries.
 */
export function HistoryList({ db, onDeleteEntry }: HistoryListProps): React.ReactElement {
  const theme = useTheme();

  const groups = useMemo<DateGroup[]>(() => {
    const timeline = buildTimeline(db);
    const buckets = bucketByDay(timeline);
    const out: DateGroup[] = [];
    for (const [key, entries] of buckets) {
      const date = entries[0]?.date ?? new Date();
      out.push({
        key,
        label: friendlyDateLabel(date),
        date,
        entries,
      });
    }
    out.sort((a, b) => b.date.getTime() - a.date.getTime());
    return out;
  }, [db]);

  if (groups.length === 0) {
    return (
      <View style={[styles.empty, { marginTop: theme.spacing['2xl'] }]}>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Nothing logged yet</Text>
        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              marginTop: theme.spacing.xs,
              textAlign: 'center',
            },
          ]}
        >
          Your timeline fills in as you log shots, food, and how you feel.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.key} style={{ marginTop: theme.spacing.xl }}>
          <Text
            style={[
              theme.typography.captionMedium,
              {
                color: theme.colors.textMuted,
                letterSpacing: 0.5,
                marginBottom: theme.spacing.md,
              },
            ]}
          >
            {group.label.toUpperCase()}
          </Text>

          {group.entries.map((entry, idx) => (
            <TimelineRow
              key={`${entry.kind}-${dayKey(entry.date)}-${idx}-${entry.date.getTime()}`}
              entry={entry}
              isLast={idx === group.entries.length - 1}
              onLongPress={onDeleteEntry}
            />
          ))}
        </View>
      ))}

      {onDeleteEntry && groups.length > 0 && (
        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              textAlign: 'center',
              marginTop: theme.spacing.lg,
              fontStyle: 'italic',
            },
          ]}
        >
          Long-press any entry to remove it.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
  },
});
