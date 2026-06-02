import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface IntensityRowProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
}

const INTENSITY_LABELS: Record<number, string> = {
  1: 'None',
  2: 'Mild',
  3: 'Moderate',
  4: 'Strong',
  5: 'Severe',
};

/**
 * 1–5 intensity selector. A row of 5 dots — tap to set. Default is 1
 * (rendered as a hollow ring so it doesn't suggest "selected" by accident).
 * No drag, no slider. Mobile-friendly and accessible.
 */
export function IntensityRow({ label, value, onChange }: IntensityRowProps): React.ReactElement {
  const theme = useTheme();

  const colorFor = (rank: number): string => {
    if (rank === 1) return theme.colors.surfaceMuted;
    if (rank === 2) return theme.colors.success;
    if (rank === 3) return theme.colors.warning;
    if (rank === 4) return theme.colors.warning;
    return theme.colors.danger;
  };

  return (
    <View style={[styles.row, { paddingVertical: theme.spacing.md }]}>
      <View style={styles.headerRow}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {INTENSITY_LABELS[value]}
        </Text>
      </View>
      <View style={styles.dotRow}>
        {[1, 2, 3, 4, 5].map((rank) => {
          const filled = rank <= value && value > 1;
          const isCurrent = rank === value;
          return (
            <Pressable
              key={rank}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${INTENSITY_LABELS[rank]}`}
              accessibilityState={{ selected: isCurrent }}
              hitSlop={6}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(rank);
              }}
              style={({ pressed }) => [
                styles.dot,
                {
                  backgroundColor: filled ? colorFor(value) : 'transparent',
                  borderColor: filled ? colorFor(value) : theme.colors.border,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
});
