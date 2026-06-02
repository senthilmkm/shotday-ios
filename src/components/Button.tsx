import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Default: light haptic on press. Set false to suppress. */
  haptic?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  haptic = true,
}: ButtonProps): React.ReactElement {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = (): void => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.surface
        : variant === 'danger'
          ? theme.colors.danger
          : 'transparent';

  const fg =
    variant === 'primary'
      ? theme.colors.onPrimary
      : variant === 'danger'
        ? theme.colors.onPrimary
        : variant === 'ghost'
          ? theme.colors.primary
          : theme.colors.text;

  const borderColor = variant === 'secondary' ? theme.colors.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: theme.radii.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[theme.typography.button, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  md: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
