import { Heart, Star } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface SoftReviewPromptSheetProps {
  visible: boolean;
  onLater: () => void;
  onReview: () => void;
}

export function SoftReviewPromptSheet({
  visible,
  onLater,
  onReview,
}: SoftReviewPromptSheetProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onLater}
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.xl,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Heart size={22} color={theme.colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={[theme.typography.title, { color: theme.colors.text, textAlign: 'center', marginTop: 14 }]}>
            Enjoying Shotday?
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
            If Shotday is helping your weekly GLP-1 routine, a quick App Store review really helps.
          </Text>

          <View style={styles.starsRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={18} color={theme.colors.warning} fill={theme.colors.warning} strokeWidth={1.8} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onLater}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.full,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
                Maybe later
              </Text>
            </Pressable>
            <Pressable
              onPress={onReview}
              accessibilityRole="button"
              accessibilityLabel="Leave App Store review"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radii.full,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.captionMedium, { color: theme.colors.onPrimary }]}>
                Leave review
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    alignSelf: 'stretch',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
});
