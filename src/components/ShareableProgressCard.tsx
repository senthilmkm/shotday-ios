import * as Haptics from 'expo-haptics';
import { Award, Check, Copy, Flame, MessageSquare, Scale, Share2, Sparkles, Syringe, X } from 'lucide-react-native';
import React, { useState } from 'react';
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

const NSV_OPTIONS = [
  { id: 'food_noise', label: '🤫 Food noise vanished' },
  { id: 'belt', label: '👔 Down belt notches' },
  { id: 'airplane', label: '✈️ Comfort on flights' },
  { id: 'labs', label: '🩺 Normalized A1C/labs' },
  { id: 'energy', label: '⚡ All-day steady energy' },
  { id: 'clothes', label: '👗 Fitting old clothes' },
];

export function ShareableProgressCard({
  visible,
  db,
  onClose,
}: ShareableProgressCardProps): React.ReactElement {
  const theme = useTheme();
  const today = new Date();
  const [hideAbsoluteWeight, setHideAbsoluteWeight] = useState(true);
  const [selectedNsvs, setSelectedNsvs] = useState<string[]>(['food_noise']);
  const [copiedReddit, setCopiedReddit] = useState(false);

  const activeLevel = summarizeActiveLevel(db.injections, db.profile.drug, today);
  const milestone = weightMilestoneSummary(db, today);
  const adherence = recentWeeklyAdherence(db.injections, db.profile.shotDay, today, 8);
  const hits = adherenceCount(adherence);

  const drugName = db.profile.drug === 'OTHER'
    ? (db.profile.customDrugName || 'GLP-1')
    : db.profile.drug;

  const totalShots = db.injections.length;

  const toggleNsv = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedNsvs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const getSelectedNsvLabels = () => {
    return NSV_OPTIONS.filter((opt) => selectedNsvs.includes(opt.id)).map((opt) => opt.label);
  };

  const buildShareBody = (format: 'SOCIAL' | 'REDDIT') => {
    const lossText = milestone.status === 'ACTIVE' && milestone.totalLost !== null
      ? `Down ${milestone.totalLost} ${milestone.unit}`
      : 'Tracking my GLP-1 journey';

    const objectComparison = milestone.milestoneObject
      ? ` (Equivalent to 1 ${milestone.milestoneObject.name} ${milestone.milestoneObject.emoji}!)`
      : '';

    const nsvLabels = getSelectedNsvLabels();
    const nsvText = nsvLabels.length > 0 ? `✨ NSVs: ${nsvLabels.join(' · ')}` : '';

    if (format === 'REDDIT') {
      const lines = [
        `**🎯 My GLP-1 Journey Update**`,
        `- **Medication:** ${drugName} (${db.profile.currentDoseLabel || 'Active dose'})`,
        `- **Progress:** ${lossText}${objectComparison}`,
        `- **Consistency:** ${hits}/8 recent weekly shots (${totalShots} total shots logged)`,
        `- **Active Medication Level:** ~${activeLevel.currentActiveMg} mg active`,
      ];
      if (nsvText) lines.push(`- **Non-Scale Victories:** ${nsvLabels.join(' | ')}`);
      lines.push('', `*Tracked privately with Shotday (on-device GLP-1 companion)*`);
      return lines.join('\n');
    }

    return [
      `🎯 ${lossText}${objectComparison} on ${drugName} (${db.profile.currentDoseLabel || 'Active dose'})`,
      `💉 ${totalShots} total shots logged · ${hits}/8 recent weekly consistency`,
      nsvText,
      `📊 Current estimated active level: ${activeLevel.currentActiveMg} mg`,
      `🛡️ Tracked privately with Shotday (on-device GLP-1 companion)`,
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const onShareText = async (): Promise<void> => {
    Haptics.selectionAsync().catch(() => {});
    const shareBody = buildShareBody('SOCIAL');

    try {
      await Share.share({
        message: shareBody,
        title: 'My GLP-1 Progress with Shotday',
      });
    } catch {
      // User cancelled
    }
  };

  const onShareReddit = async (): Promise<void> => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const redditBody = buildShareBody('REDDIT');
    setCopiedReddit(true);
    setTimeout(() => setCopiedReddit(false), 2500);

    try {
      await Share.share({
        message: redditBody,
        title: 'Reddit r/Zepbound / r/semaglutide Update',
      });
    } catch {
      // User cancelled
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
            Share Progress & NSVs
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
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 14 }]}>
            Screenshot this card or share directly to Reddit (<Text style={{ color: theme.colors.primary }}>r/Zepbound, r/semaglutide</Text>) and social channels.
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
              {hideAbsoluteWeight ? '🔒 Privacy Mode: Showing Only Total Lost' : '⚖️ Showing Total Lost + Exact Weight'}
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
                GLP-1 Milestone Card
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

            {/* Object Milestone Pill */}
            {milestone.milestoneObject ? (
              <View style={[styles.objectPill, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}>
                <Text style={styles.objectEmoji}>{milestone.milestoneObject.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, fontWeight: '700' }]}>
                    Lost the weight of 1 {milestone.milestoneObject.name}!
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                    Equal to {milestone.milestoneObject.comparison}
                  </Text>
                </View>
              </View>
            ) : milestone.nextMilestoneObject ? (
              <View style={[styles.objectPill, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Text style={styles.objectEmoji}>{milestone.nextMilestoneObject.object.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
                    Next Object: {milestone.nextMilestoneObject.object.name}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                    {milestone.nextMilestoneObject.remaining} {milestone.unit} away!
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Selected NSV Badges inside card */}
            {selectedNsvs.length > 0 && (
              <View style={styles.nsvCardContainer}>
                {getSelectedNsvLabels().map((label, i) => (
                  <View
                    key={i}
                    style={[styles.nsvMiniBadge, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
                  >
                    <Text style={[theme.typography.caption, { color: theme.colors.text, fontSize: 11 }]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

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

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                🔒 100% Private & On-Device · shotday.app
              </Text>
            </View>
          </View>

          {/* ─── NSV Quick Selector ─────────────────────────────── */}
          <View style={styles.nsvSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Sparkles size={14} color={theme.colors.primary} />
              <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 6 }]}>
                Include Non-Scale Victories (Select up to 3)
              </Text>
            </View>
            <View style={styles.nsvChipsRow}>
              {NSV_OPTIONS.map((opt) => {
                const isSelected = selectedNsvs.includes(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => toggleNsv(opt.id)}
                    style={[
                      styles.nsvChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.surfaceMuted,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '600' : '400' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── Action Buttons ─────────────────────────────────── */}
          <View style={styles.actionBlock}>
            <Button
              label="Share Social Story / Text"
              fullWidth
              size="lg"
              onPress={onShareText}
            />

            <Button
              label={copiedReddit ? '✓ Copied Reddit Format!' : '📋 Share Reddit Format (r/Zepbound)'}
              variant="secondary"
              fullWidth
              size="lg"
              onPress={onShareReddit}
              style={{ marginTop: 10 }}
            />
          </View>

          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 14, textAlign: 'center' }]}>
            Tip: Take a screenshot of the card above to post directly to your Instagram or TikTok story!
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
    marginBottom: 12,
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
    marginVertical: 8,
  },
  objectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  objectEmoji: {
    fontSize: 24,
  },
  nsvCardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    justifyContent: 'center',
  },
  nsvMiniBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
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
    marginTop: 14,
  },
  privacyToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  nsvSection: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
  },
  nsvChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nsvChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionBlock: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
  },
});

