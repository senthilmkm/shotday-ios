import * as Haptics from 'expo-haptics';
import { Award, Calendar, CheckCircle2, Sparkles, Syringe, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';

interface ShotCelebrationModalProps {
  visible: boolean;
  zoneLabel: string;
  doseLabel: string;
  nextShotDateStr: string;
  weekCount: number;
  onClose: () => void;
}

export function ShotCelebrationModal({
  visible,
  zoneLabel,
  doseLabel,
  nextShotDateStr,
  weekCount,
  onClose,
}: ShotCelebrationModalProps): React.ReactElement {
  const theme = useTheme();

  useEffect(() => {
    if (visible) {
      // Celebratory multi-stage haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary + '50',
              borderRadius: theme.radii.xl,
            },
          ]}
        >
          {/* Confetti & Sparkles Header Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.colors.primary + '20',
                borderColor: theme.colors.primary + '50',
              },
            ]}
          >
            <Sparkles size={36} color={theme.colors.primary} strokeWidth={2.2} />
          </View>

          <Text style={[theme.typography.hero, { color: theme.colors.text, fontSize: 24, textAlign: 'center', marginTop: 16 }]}>
            Week {weekCount > 0 ? weekCount : 1} Shot Logged! 🏆
          </Text>

          <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 }]}>
            Consistency protects your progress. Your body will absorb this dose smoothly over the coming days.
          </Text>

          {/* Dose & Site Recap */}
          <View
            style={[
              styles.detailBox,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <View style={styles.detailRow}>
              <CheckCircle2 size={16} color={theme.colors.success} strokeWidth={2.5} />
              <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 8, flex: 1 }]}>
                Dose: <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{doseLabel}</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <CheckCircle2 size={16} color={theme.colors.success} strokeWidth={2.5} />
              <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 8, flex: 1 }]}>
                Rotated to: <Text style={{ fontWeight: '700' }}>{zoneLabel}</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Calendar size={16} color={theme.colors.primary} strokeWidth={2.2} />
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginLeft: 8, flex: 1 }]}>
                Next shot: <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{nextShotDateStr}</Text>
              </Text>
            </View>
          </View>

          <Button label="Done" fullWidth size="lg" onPress={onClose} style={{ marginTop: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBox: {
    width: '100%',
    padding: 14,
    borderWidth: 1,
    marginTop: 18,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
