import { X } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

interface LockedFeatureScreenProps {
  title: string;
  body: string;
  onUpgrade: () => void;
  onClose?: () => void;
}

export function LockedFeatureScreen({
  title,
  body,
  onUpgrade,
  onClose,
}: LockedFeatureScreenProps): React.ReactElement {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {onClose ? (
        <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
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
      ) : null}

      <View style={[styles.content, { paddingHorizontal: theme.spacing.lg }]}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            SHOTDAY PRO
          </Text>
        </View>
        <Text style={[theme.typography.title, { color: theme.colors.text, marginTop: 14, textAlign: 'center' }]}>
          {title}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 22 }]}>
          {body}
        </Text>
        <Button label="Subscribe to unlock" onPress={onUpgrade} fullWidth style={{ marginTop: 22 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
