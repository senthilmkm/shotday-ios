import { Activity, Pill, Syringe, Utensils } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { peakMetric } from '../../domain/sideEffects';
import { useTheme } from '../../theme/ThemeProvider';
import type { SideEffectEntry, SideEffectMetric } from '../../types/domain';
import { CHIP_LABEL, METRIC_LABEL, ZONE_LABEL, type TimelineEntry } from './timeline';

interface TimelineRowProps {
  entry: TimelineEntry;
  /** When true, the row's left-side connector line is omitted (last row in group). */
  isLast: boolean;
  /**
   * Called when the user long-presses this row. The parent typically
   * confirms via Alert and removes the entry from `ShotdayDb`. Omit
   * to disable the long-press affordance.
   */
  onLongPress?: (entry: TimelineEntry) => void;
}

/**
 * Single row on the History timeline (used by both the List and the
 * Calendar's selected-day section). Left column = circular icon +
 * connector line. Right column = title + detail + time.
 */
export function TimelineRow({ entry, isLast, onLongPress }: TimelineRowProps): React.ReactElement {
  const theme = useTheme();
  const time = entry.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  let icon: React.ReactNode;
  let title: string;
  let detail: string;

  if (entry.kind === 'injection') {
    icon = <Syringe size={18} color={theme.colors.primary} strokeWidth={2} />;
    title =
      entry.data.doseMg > 0
        ? `Logged ${entry.data.doseMg} mg shot`
        : 'Logged a shot';
    detail = ZONE_LABEL[entry.data.zone] + (entry.data.zoneNote ? ` · ${entry.data.zoneNote}` : '');
  } else if (entry.kind === 'side-effect') {
    icon = <Activity size={18} color={theme.colors.primary} strokeWidth={2} />;
    const peak = peakMetric(entry.data);
    const dominant = dominantSymptoms(entry.data);
    title = peak > 1 ? `Check-in · peak ${peak}/5` : 'Check-in · all clear';
    detail = dominant.length > 0 ? dominant.join(', ') : `Day ${entry.data.dayAfterShot} after shot`;
  } else if (entry.kind === 'food') {
    icon = <Utensils size={18} color={theme.colors.primary} strokeWidth={2} />;
    title = `${entry.data.proteinGrams} g protein`;
    detail = entry.data.name;
  } else {
    icon = <Pill size={18} color={theme.colors.primary} strokeWidth={2} />;
    title = `Moved to ${entry.data.label}`;
    detail = 'Dose change';
  }

  const content = (
    <>
      <View style={styles.iconCol}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {icon}
        </View>
        {!isLast && <View style={[styles.connector, { backgroundColor: theme.colors.border }]} />}
      </View>

      <View style={styles.bodyCol}>
        <View style={styles.bodyRow}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: theme.spacing.sm }]}>
            {time}
          </Text>
        </View>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: 2 },
          ]}
          numberOfLines={2}
        >
          {detail}
        </Text>
      </View>
    </>
  );

  if (!onLongPress) {
    return <View style={styles.row}>{content}</View>;
  }

  // Injections support edit-or-delete; other entry kinds are
  // delete-only. The accessibility hint reflects that nuance.
  const hint =
    entry.kind === 'injection'
      ? 'Long press to edit the time or delete'
      : 'Long press to remove this entry';

  return (
    <Pressable
      onLongPress={() => onLongPress(entry)}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}.`}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

function dominantSymptoms(entry: SideEffectEntry): string[] {
  const out: string[] = [];
  for (const [m, v] of Object.entries(entry.metrics)) {
    if ((v ?? 1) > 1) out.push(`${METRIC_LABEL[m as SideEffectMetric]} ${v}/5`);
  }
  for (const c of entry.chips) {
    out.push(CHIP_LABEL[c]);
  }
  for (const cs of entry.customSymptoms) {
    out.push(cs);
  }
  return out;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingBottom: 16,
  },
  iconCol: {
    width: 44,
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  bodyCol: {
    flex: 1,
    paddingLeft: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
