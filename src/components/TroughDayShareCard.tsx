import * as Haptics from 'expo-haptics';
import { Share2, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildTroughDayShareText,
  type TroughDayState,
} from '../domain/troughDay';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

interface TroughDayShareCardProps {
  visible: boolean;
  state: TroughDayState;
  onClose: () => void;
}

/**
 * Free text share sheet for Trough Day. No native screenshot module —
 * OTA-safe on the live 1.0.0 binary.
 */
export function TroughDayShareCard({
  visible,
  state,
  onClose,
}: TroughDayShareCardProps): React.ReactElement {
  const theme = useTheme();
  const shareBody = buildTroughDayShareText(state);
  const accent = state.isTroughDay ? theme.colors.warning : theme.colors.primary;

  const onShare = async (): Promise<void> => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await Share.share({
        message: shareBody,
        title: state.isTroughDay ? 'Trough Day' : 'Shotday cycle day',
      });
    } catch {
      // cancelled
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
        <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg }]}>
          <Text style={[theme.typography.heading, { color: theme.colors.text, flex: 1 }]}>
            Share
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.closeBtn,
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

        <View style={{ padding: theme.spacing.lg, flex: 1 }}>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 14 },
            ]}
          >
            Free to share. No accounts. Screenshot the card or send the text.
          </Text>

          <View
            style={[
              styles.poster,
              {
                backgroundColor: theme.colors.surface,
                borderColor: accent,
                borderRadius: theme.radii.xl,
              },
            ]}
          >
            <Text style={[theme.typography.captionMedium, { color: accent, letterSpacing: 1 }]}>
              SHOTDAY
            </Text>
            <Text
              style={[
                theme.typography.hero,
                {
                  color: theme.colors.text,
                  marginTop: 16,
                  fontSize: state.isTroughDay ? 32 : 26,
                  lineHeight: state.isTroughDay ? 38 : 32,
                },
              ]}
            >
              {state.isTroughDay
                ? `It’s Trough Day · ${state.weekdayLabel ?? 'today'}`
                : state.headline}
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textMuted, marginTop: 12, lineHeight: 22 },
              ]}
            >
              {state.isTroughDay
                ? 'Hunger today is pharmacology, not personality.'
                : state.insight}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textMuted, marginTop: 28 },
              ]}
            >
              On this iPhone. Nowhere else.
            </Text>
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            <Button label="Share text" onPress={onShare} fullWidth />
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              style={styles.secondaryHint}
            >
              <Share2 size={14} color={theme.colors.primary} />
              <Text style={[theme.typography.caption, { color: theme.colors.primary, marginLeft: 6 }]}>
                Opens the system share sheet
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    borderWidth: 2,
    padding: 24,
    minHeight: 280,
  },
  secondaryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
