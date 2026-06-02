import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Slightly larger touch target for important chips (drug picker). */
  large?: boolean;
}

export function Chip({ label, selected = false, onPress, large = false }: ChipProps): React.ReactElement {
  const theme = useTheme();

  const handlePress = (): void => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : styles.regular,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.full,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          large ? theme.typography.bodyMedium : theme.typography.captionMedium,
          { color: selected ? theme.colors.onPrimary : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  regular: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
  },
  large: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 48,
  },
});
