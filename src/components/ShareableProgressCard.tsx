import * as Haptics from 'expo-haptics';
import { Award, Flame, Scale, Share2, Syringe, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ShotdayDb } from '../types/domain';
import { summarizeActiveLevel } from '../domain/medicationLevel';
import { weightMilestoneSummary } from '../domain/weight';
import { adherenceCount, recentWeeklyAdherence } from '../domain/adherence';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

interface ShareableProgressCardProps {
  visible: boolean;
  db: ShotdayDb;
  onClose: () => void;
}

export function ShareableProgressCard({
  visible,
  db,
  onClose,
}: ShareableProgressCardProps): React.ReactElement {
  const theme = useTheme();
  const today = new Date();
  const [hideAbsoluteWeight, setHideAbsoluteWeight] = React.useState(true);

  const activeLevel = summarizeActiveLevel(db.injections, db.profile.drug, today);
  const milestone = weightMilestoneSummary(db, today);
  const adherence = recentWeeklyAdherence(db.injections, db.profile.shotDay, today, 8);
  const hits = adherenceCount(adherence);

  const drugName = db.profile.drug === 'OTHER'
    ? (db.profile.customDrugName || 'GLP-1')
    : db.profile.drug;

  const totalShots = db.injections.length;

  const onShareText = async (): Promise<void> => {
    Haptics.selectionAsync().catch(() => {});
    const lossText = milestone.status === 'ACTIVE' && milestone.totalLost !== null
      ? `Down ${milestone.totalLost} ${milestone.unit}`
      : 'Tracking my GLP-1 journey';

    const shareBody = [
      `🎯 ${lossText} on ${drugName} (${db.profile.currentDoseLabel || 'Active dose'})`,
      `💉 ${totalShots} total shots logged · ${hits}/8 recent weekly consistency`,
      `📊 Current estimated active level: ${activeLevel.currentActiveMg} mg`,
      `🛡️ Tracked privately with Shotday (on-device GLP-1 companion)`,
    ].join('\n\n');

    try {
      await Share.share({
        message: shareBody,
        title: 'My GLP-1 Progress with Shotday',
      });
    } catch {
      // Ignored if cancelled
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
        <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
          <Text style={[theme.typography.heading, { color: theme.colors.text, flex: 1 }]}>
            Share Progress
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close share card"
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

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, alignItems: 'center' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 12 }]}>
            Screenshot this card or share your milestones to Reddit (r/Zepbound, r/semaglutide) and social channels. No private personal info is included.
          </Text>

          {/* Privacy Toggle */}
          <Pressable
            onPress={() => {
              setHideAbsoluteWeight((prev) => !prev);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: hideAbsoluteWeight }}
            accessibilityLabel="Toggle privacy mode"
            style={({ pressed }) => [
              styles.privacyToggle,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.captionMedium, { color: theme.colors.text, fontSize: 11 }]}>
              {hideAbsoluteWeight ? '🔒 Privacy: Showing Only Total Lost' : '⚖️ Showing Total Lost + Weight'}
            </Text>
          </Pressable>

          {/* ─── Anonymized Social Card ─────────────────────────── */}
          <View
            style={[
              styles.cardContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.xl,
              },
            ]}
          >
            {/* Card Brand Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.logoPill, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Flame size={14} color={theme.colors.primary} />
                <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, marginLeft: 4 }]}>
                  SHOTDAY
                </Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                GLP-1 Tracker
              </Text>
            </View>

            {/* Total Lost Highlight */}
            <View style={styles.heroBlock}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                TOTAL WEIGHT LOST
              </Text>
              <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 4, fontSize: 36 }]}>
                {milestone.status === 'ACTIVE' && milestone.totalLost !== null
                  ? `-${milestone.totalLost} ${milestone.unit}`
                  : 'Active Journey'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.primary, marginTop: 4 }]}>
                {drugName} · {db.profile.currentDoseLabel || 'Dosing steady'}
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={[styles.statsGrid, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
              <View style={styles.statCell}>
                <Syringe size={16} color={theme.colors.primary} />
                <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                  {totalShots}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Total Shots
                </Text>
              </View>

              <View style={[styles.statCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.colors.border }]}>
                <Award size={16} color={theme.colors.success} />
                <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                  {hits}/8
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Consistency
                </Text>
              </View>

              <View style={styles.statCell}>
                <Scale size={16} color={theme.colors.warning} />
                <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                  {activeLevel.currentActiveMg} mg
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Active Level
                </Text>
              </View>
            </View>

            {/* Privacy Badge */}
            <View style={styles.cardFooter}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                🔒 100% Private & On-Device · shotday.app
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <Button
            label="Share Text Summary"
            fullWidth
            size="lg"
            onPress={onShareText}
            style={{ marginTop: 24 }}
          />

          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 12, textAlign: 'center' }]}>
            Tip: Take a screenshot of the card above to share as an image!
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBlock: {
    alignItems: 'center',
    marginVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cardFooter: {
    alignItems: 'center',
    marginTop: 16,
  },
  privacyToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
});
