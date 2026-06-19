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
import { summarizeWeeklyProgress } from '../../domain/weeklyProgress';
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
  const progress = useMemo(() => summarizeWeeklyProgress(db, now), [db, now]);
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
            TAKEAWAY
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 6 }]}>
            {progress.takeaway}
          </Text>
        </Card>

        <InsightCard
          title="Shot routine"
          headline={progress.shot.label}
          detail={progress.shot.detail}
        />
        <InsightCard
          title="Protein"
          headline={progress.protein.label}
          detail={progress.protein.detail}
          meta={
            progress.protein.status === 'READY'
              ? `This cycle: ${progress.protein.hits}/${progress.protein.days} days · Last cycle: ${progress.protein.previousHits}/${progress.protein.previousDays} days`
              : undefined
          }
        />
        <InsightCard
          title="Symptoms"
          headline={progress.symptoms.label}
          detail={progress.symptoms.detail}
          meta={
            progress.symptoms.currentAverage !== null && progress.symptoms.previousAverage !== null
              ? `This cycle: ${progress.symptoms.currentAverage}/5 · Last cycle: ${progress.symptoms.previousAverage}/5`
              : undefined
          }
        />
        <InsightCard
          title="Weight"
          headline={progress.weight.label}
          detail={progress.weight.detail}
          meta={
            progress.weight.change !== null
              ? `${progress.weight.points} recent weight entries`
              : undefined
          }
          action={
            progress.weight.needsAnotherWeight
              ? {
                  label: 'Add this week’s weight',
                  onPress: () => setWeightSheetOpen(true),
                }
              : undefined
          }
        />

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            WEIGHT MILESTONE
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {milestone.label}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
            {milestone.status === 'ACTIVE'
              ? `Starting ${milestone.startWeight} ${milestone.unit}; current ${milestone.currentWeight} ${milestone.unit}. ${milestone.detail}`
              : milestone.detail}
          </Text>
          {milestone.status === 'ACTIVE' && milestone.nextMilestone !== null && (
            <View style={[styles.milestoneStats, { borderColor: theme.colors.border }]}>
              <Stat label="Total lost" value={`${milestone.totalLost} ${milestone.unit}`} />
              <Stat label="Next milestone" value={`${milestone.nextMilestone} ${milestone.unit}`} />
              <Stat label="To go" value={`${milestone.remainingToNext} ${milestone.unit}`} />
            </View>
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

        <Button
          label="Create Doctor Report"
          fullWidth
          size="lg"
          onPress={() => navigation.navigate('DoctorReport')}
          style={{ marginTop: theme.spacing.md }}
        />
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

function InsightCard({
  title,
  headline,
  detail,
  meta,
  action,
}: {
  title: string;
  headline: string;
  detail: string;
  meta?: string;
  action?: { label: string; onPress: () => void };
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Card style={{ marginBottom: theme.spacing.md }}>
      <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
        {headline}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
        {detail}
      </Text>
      {meta && (
        <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, marginTop: 10 }]}>
          {meta}
        </Text>
      )}
      {action && (
        <Button
          label={action.label}
          fullWidth
          onPress={action.onPress}
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
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
});
