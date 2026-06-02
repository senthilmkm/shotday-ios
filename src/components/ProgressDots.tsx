import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ProgressDotsProps {
  total: number;
  current: number;
}

/** Onboarding progress indicator — 6 dots, current dot is wider/colored. */
export function ProgressDots({ total, current }: ProgressDotsProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === current;
        return (
          <View
            key={i}
            style={{
              width: isCurrent ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isCurrent ? theme.colors.primary : theme.colors.border,
              marginHorizontal: 3,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
