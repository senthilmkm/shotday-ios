import { Lock } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FREE_SHOT_LIMIT, isFreeShotLimitReached } from '../../domain/proGating';
import { useProAccess } from '../../hooks/useProAccess';
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
  const { hasProAccess, openPaywall } = useProAccess();
  const limitReached = isFreeShotLimitReached(db.injections.length, hasProAccess);

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
        {!hasProAccess && (
          <Pressable
            onPress={openPaywall}
            accessibilityRole="button"
            accessibilityLabel="Shotday Pro features locked. Tap to view subscription."
            style={({ pressed }) => [
              styles.proBanner,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                marginBottom: 16,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Lock size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                FREE TIER (0/{FREE_SHOT_LIMIT} SHOTS LOGGED)
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Subscribe for unlimited shot logging & doctor reports.
              </Text>
            </View>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, marginLeft: 6 }]}>
              Pro ›
            </Text>
          </Pressable>
        )}
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
      {!hasProAccess && (
        <Pressable
          onPress={openPaywall}
          accessibilityRole="button"
          accessibilityLabel="Shotday Pro features locked. Tap to view subscription."
          style={({ pressed }) => [
            styles.proBanner,
            {
              backgroundColor: theme.colors.surface,
              borderColor: limitReached ? theme.colors.danger : theme.colors.border,
              borderRadius: theme.radii.md,
              marginTop: 12,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Lock size={16} color={limitReached ? theme.colors.danger : theme.colors.primary} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.captionMedium, { color: limitReached ? theme.colors.danger : theme.colors.primary }]}>
              {limitReached ? 'FREE SHOT LIMIT REACHED (3/3)' : `FREE TIER (${db.injections.length}/${FREE_SHOT_LIMIT} SHOTS LOGGED)`}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
              {limitReached
                ? 'Upgrade to Shotday Pro for unlimited shot logging & doctor reports.'
                : 'Subscribe for unlimited shot logging, doctor reports & smart alerts.'}
            </Text>
          </View>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, marginLeft: 6 }]}>
            Pro ›
          </Text>
        </Pressable>
      )}

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
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
  },
});

