import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddWeightSheet } from '../../components/AddWeightSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { weightMilestoneSummary } from '../../domain/weight';
import { buildWeeklyRewardSummary } from '../../domain/weeklyReward';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList, 'WeeklyProgress'>;

export function WeeklyProgressScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const reward = useMemo(() => buildWeeklyRewardSummary(db, now), [db, now]);
  const progress = reward.progress;
  const milestone = useMemo(() => weightMilestoneSummary(db, now), [db, now]);

  useEffect(() => {
    const refresh = (): void => setNow(new Date());
    const timer = setInterval(refresh, 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const nowIso = new Date().toISOString();
    updateDb((prev) => ({
      ...prev,
      reviewPrompt: {
        ...prev.reviewPrompt,
        weeklyProgressViewedAt: prev.reviewPrompt.weeklyProgressViewedAt ?? nowIso,
      },
    }));
  }, [updateDb]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            Weekly progress
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            Based on your shot cycle: {formatRange(progress.currentWindow.start, progress.currentWindow.end)}.
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close weekly progress"
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

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Card accent style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            THIS WEEK’S WIN
          </Text>
          <Text style={[theme.typography.title, { color: theme.colors.text, marginTop: 6 }]}>
            {reward.winTitle}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
            {reward.winDetail}
          </Text>
          <Button
            label="Create Doctor Report"
            fullWidth
            onPress={() => navigation.navigate('DoctorReport')}
            style={{ marginTop: 14 }}
          />
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            PROGRESS SCORE
          </Text>
          <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 6 }]}>
            {reward.scoreCompleted} / {reward.scoreTotal}
          </Text>
          <View style={styles.scoreGrid}>
            {reward.items.map((item) => (
              <ScorePill key={item.id} label={item.label} complete={item.complete} />
            ))}
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 12, lineHeight: 18 }]}>
            {reward.focusDetail}
          </Text>
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            WEIGHT MILESTONE
          </Text>
          <Text style={[theme.typography.title, { color: theme.colors.text, marginTop: 4 }]}>
            {milestone.label}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
            {milestone.status === 'ACTIVE'
              ? `Starting ${milestone.startWeight} ${milestone.unit}; current ${milestone.currentWeight} ${milestone.unit}. ${milestone.detail}`
              : milestone.detail}
          </Text>
          {milestone.status === 'ACTIVE' && milestone.nextMilestone !== null && (
            <>
              <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.colors.primary,
                      width: `${milestonePercent(milestone.totalLost, milestone.nextMilestone)}%`,
                    },
                  ]}
                />
              </View>
              <View style={[styles.milestoneStats, { borderColor: theme.colors.border }]}>
                <Stat label="Total lost" value={`${milestone.totalLost} ${milestone.unit}`} />
                <Stat label="Next badge" value={`${milestone.nextMilestone} ${milestone.unit}`} />
                <Stat label="To go" value={`${milestone.remainingToNext} ${milestone.unit}`} />
              </View>
            </>
          )}
          {milestone.status !== 'ACTIVE' && (
            <Button
              label="Add weight"
              fullWidth
              onPress={() => setWeightSheetOpen(true)}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            8-WEEK RHYTHM
          </Text>
          <RhythmRow label="Shot routine" values={reward.rhythm.shot} />
          <RhythmRow label="Weight check-ins" values={reward.rhythm.weight} />
          <RhythmRow label="Symptom checks" values={reward.rhythm.symptoms} />
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            {reward.comparisonTitle.toUpperCase()}
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {reward.comparisonCallout}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
            {reward.comparisonDetail}
          </Text>
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            {reward.focusTitle.toUpperCase()}
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {reward.focusDetail}
          </Text>
        </Card>
      </ScrollView>
      <AddWeightSheet
        visible={weightSheetOpen}
        initialWeight={db.profile.weight}
        initialUnit={db.profile.weightUnit}
        onClose={() => setWeightSheetOpen(false)}
        onSave={(weight, unit, note) => {
          const nowIso = new Date().toISOString();
          updateDb((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              weight,
              weightUnit: unit,
              weightUpdatedAt: nowIso,
            },
            weightEntries: [
              ...prev.weightEntries,
              {
                id: `weight-${Date.now()}`,
                loggedAt: nowIso,
                weight,
                unit,
                note: note ?? 'Weekly check-in',
              },
            ],
          }));
          setWeightSheetOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function ScorePill({ label, complete }: { label: string; complete: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.scorePill,
        {
          backgroundColor: complete ? theme.colors.surfaceMuted : 'transparent',
          borderColor: complete ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text style={[theme.typography.captionMedium, { color: complete ? theme.colors.primary : theme.colors.textMuted }]}>
        {complete ? '●' : '○'} {label}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.statCol}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginTop: 2 }]}>
        {value}
      </Text>
    </View>
  );
}

function RhythmRow({ label, values }: { label: string; values: boolean[] }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.rhythmRow}>
      <Text style={[theme.typography.captionMedium, { color: theme.colors.text, flex: 1 }]}>
        {label}
      </Text>
      <View style={styles.rhythmDots}>
        {values.map((hit, index) => (
          <View
            key={`${label}-${index}`}
            style={[
              styles.rhythmDot,
              {
                backgroundColor: hit ? theme.colors.success : theme.colors.surfaceMuted,
                borderColor: hit ? theme.colors.success : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function milestonePercent(totalLost: number | null, nextMilestone: number | null): number {
  if (!totalLost || !nextMilestone || nextMilestone <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((totalLost / nextMilestone) * 100)));
}

function formatRange(start: Date, end: Date): string {
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}–${endInclusive.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  milestoneStats: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
  },
  statCol: {
    flex: 1,
    padding: 10,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  scorePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  rhythmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  rhythmDots: {
    flexDirection: 'row',
    gap: 5,
  },
  rhythmDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
});
