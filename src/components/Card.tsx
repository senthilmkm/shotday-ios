import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** When true, the card uses surfaceMuted instead of surface. */
  muted?: boolean;
  /** When true, the card draws an accent left border (for the "today" priority card). */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * VoiceOver label for pressable cards. Required when `onPress` is set
   * because the children are typically several lines of mixed Text and
   * VoiceOver doesn't always read them in a sensible order.
   */
  accessibilityLabel?: string;
  /** Optional VoiceOver hint, e.g. "Opens your dose ladder". */
  accessibilityHint?: string;
}

export function Card({
  children,
  onPress,
  muted = false,
  accent = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: CardProps): React.ReactElement {
  const theme = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: muted ? theme.colors.surfaceMuted : theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderLeftWidth: accent ? 4 : 0,
    borderLeftColor: accent ? theme.colors.primary : 'transparent',
    shadowColor: theme.mode === 'dark' ? '#000' : '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.06,
    shadowRadius: 6,
    elevation: 2,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [baseStyle, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
});
