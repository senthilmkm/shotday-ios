import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Info,
  Scale,
  Share2,
  TrendingUp,
  X,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { MedicationLevelChart } from '../../components/MedicationLevelChart';
import { ShareableProgressCard } from '../../components/ShareableProgressCard';
import { rungsForDrug } from '../../domain/dose';
import {
  generateMedicationCurve,
  simulateTitration,
  summarizeActiveLevel,
} from '../../domain/medicationLevel';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type ViewMode = 'curve' | 'correlation' | 'titration';
type Timeframe = 7 | 30 | 90;

export function MedicationLevelScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { width: windowWidth } = useWindowDimensions();
  const { db } = useShotdayDb();

  const [viewMode, setViewMode] = useState<ViewMode>('curve');
  const [timeframe, setTimeframe] = useState<Timeframe>(30);
  const [shareOpen, setShareOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const chartWidth = Math.max(windowWidth - theme.spacing.lg * 2, 280);

  const summary = useMemo(
    () => summarizeActiveLevel(db.injections, db.profile.drug, today),
    [db.injections, db.profile.drug, today],
  );

  // Timeframe calculation
  const { curvePoints, weightPlotPoints } = useMemo(() => {
    const start = new Date(today.getTime() - timeframe * 24 * 60 * 60 * 1000);
    const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days projected forecast

    const stepHours = timeframe <= 7 ? 3 : timeframe <= 30 ? 6 : 12;
    const curve = generateMedicationCurve(db.injections, db.profile.drug, start, end, stepHours);

    const weights = db.weightEntries
      .filter((w) => {
        const wDate = new Date(w.loggedAt);
        return wDate >= start && wDate <= end;
      })
      .map((w) => ({ date: new Date(w.loggedAt), weight: w.weight }));

    return { curvePoints: curve, weightPlotPoints: weights };
  }, [db.injections, db.profile.drug, db.weightEntries, timeframe, today]);

  // Dose Ladder for Titration Simulator
  const ladderRungs = useMemo(() => rungsForDrug(db.profile.drug), [db.profile.drug]);
  const currentDoseMg = db.profile.currentDoseMg || (ladderRungs[0]?.mg ?? 2.5);
  const [targetDoseMg, setTargetDoseMg] = useState<number>(() => {
    const next = ladderRungs.find((r) => r.mg > currentDoseMg);
    return next ? next.mg : currentDoseMg;
  });

  const titrationSim = useMemo(
    () =>
      simulateTitration(
        db.injections,
        db.profile.drug,
        currentDoseMg,
        targetDoseMg,
        4,
        today,
      ),
    [db.injections, db.profile.drug, currentDoseMg, targetDoseMg, today],
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            Medication Levels
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
            Pharmacokinetic model & active half-life estimation
          </Text>
        </View>

        <Pressable
          onPress={() => setShareOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Share progress card"
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: 999,
              opacity: pressed ? 0.6 : 1,
              marginRight: 8,
            },
          ]}
        >
          <Share2 size={18} color={theme.colors.primary} strokeWidth={2} />
        </Pressable>

        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close medication levels"
          style={({ pressed }) => [
            styles.iconBtn,
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

      {/* Segmented View Mode Toggle */}
      <View style={[styles.segmentContainer, { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }]}>
        <View style={[styles.segmentGroup, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md }]}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setViewMode('curve');
            }}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: viewMode === 'curve' ? theme.colors.surface : 'transparent',
                borderRadius: theme.radii.sm,
              },
            ]}
          >
            <Activity size={14} color={viewMode === 'curve' ? theme.colors.primary : theme.colors.textMuted} />
            <Text
              style={[
                theme.typography.captionMedium,
                { color: viewMode === 'curve' ? theme.colors.text : theme.colors.textMuted, marginLeft: 4 },
              ]}
            >
              Active Curve
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setViewMode('correlation');
            }}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: viewMode === 'correlation' ? theme.colors.surface : 'transparent',
                borderRadius: theme.radii.sm,
              },
            ]}
          >
            <Scale size={14} color={viewMode === 'correlation' ? theme.colors.success : theme.colors.textMuted} />
            <Text
              style={[
                theme.typography.captionMedium,
                { color: viewMode === 'correlation' ? theme.colors.text : theme.colors.textMuted, marginLeft: 4 },
              ]}
            >
              Weight Impact
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setViewMode('titration');
            }}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: viewMode === 'titration' ? theme.colors.surface : 'transparent',
                borderRadius: theme.radii.sm,
              },
            ]}
          >
            <TrendingUp size={14} color={viewMode === 'titration' ? theme.colors.warning : theme.colors.textMuted} />
            <Text
              style={[
                theme.typography.captionMedium,
                { color: viewMode === 'titration' ? theme.colors.text : theme.colors.textMuted, marginLeft: 4 },
              ]}
            >
              Simulator
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] }}>
        {/* Active Readout Hero Card */}
        {viewMode !== 'titration' && (
          <Card accent style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                  {summary.headline.toUpperCase()}
                </Text>
                <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 4 }]}>
                  {summary.currentActiveMg} <Text style={{ fontSize: 18, color: theme.colors.textMuted }}>mg active</Text>
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
                  {summary.insight}
                </Text>
              </View>
              <View
                style={[
                  styles.phaseBadge,
                  {
                    backgroundColor:
                      summary.phase === 'PEAK_CONCENTRATION'
                        ? theme.colors.primary + '20'
                        : summary.phase === 'TROUGH_FOOD_NOISE'
                          ? theme.colors.warning + '20'
                          : theme.colors.surfaceMuted,
                    borderColor:
                      summary.phase === 'PEAK_CONCENTRATION'
                        ? theme.colors.primary
                        : summary.phase === 'TROUGH_FOOD_NOISE'
                          ? theme.colors.warning
                          : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.captionMedium,
                    {
                      color:
                        summary.phase === 'PEAK_CONCENTRATION'
                          ? theme.colors.primary
                          : summary.phase === 'TROUGH_FOOD_NOISE'
                            ? theme.colors.warning
                            : theme.colors.text,
                      fontSize: 11,
                    },
                  ]}
                >
                  {summary.phase === 'PEAK_CONCENTRATION'
                    ? '⚡ Peak Level'
                    : summary.phase === 'TROUGH_FOOD_NOISE'
                      ? '🍽️ Appetite Window'
                      : '🔄 Steady State'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* ─── Mode 1 & 2: Main Chart Card ────────────────────── */}
        {(viewMode === 'curve' || viewMode === 'correlation') && (
          <Card style={{ marginBottom: theme.spacing.md }}>
            {/* Timeframe Filter Buttons */}
            <View style={styles.filterRow}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                {viewMode === 'curve' ? 'ACTIVE BLOOD LEVEL (MG)' : 'MEDICATION VS WEIGHT (LBS)'}
              </Text>
              <View style={styles.timeframeRow}>
                {([7, 30, 90] as Timeframe[]).map((tf) => (
                  <Pressable
                    key={tf}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setTimeframe(tf);
                    }}
                    style={[
                      styles.tfChip,
                      {
                        backgroundColor: timeframe === tf ? theme.colors.primary : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.captionMedium,
                        { color: timeframe === tf ? theme.colors.surface : theme.colors.textMuted, fontSize: 11 },
                      ]}
                    >
                      {tf}D
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Interactive SVG Chart */}
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <MedicationLevelChart
                points={curvePoints}
                width={chartWidth - 32}
                height={200}
                weightPoints={viewMode === 'correlation' ? weightPlotPoints : []}
                weightUnit={db.profile.weightUnit.toLowerCase()}
              />
            </View>

            <View style={[styles.chartLegend, { borderTopColor: theme.colors.border }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Active Level (mg)
                </Text>
              </View>
              {viewMode === 'correlation' && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    Weight Points ({db.profile.weightUnit})
                  </Text>
                </View>
              )}
              <View style={styles.legendItem}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Touch chart to inspect
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* ─── Mode 3: Titration Simulator ────────────────────── */}
        {viewMode === 'titration' && (
          <>
            <Card accent style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                TITRATION FORECASTER
              </Text>
              <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                Compare Next Dose Step
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
                See how escalating your dose will change peak concentration and steady-state drug accumulation in your body over the next 4 weeks.
              </Text>

              {/* Ladder Selection Buttons */}
              <View style={{ marginTop: 14 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginBottom: 8 }]}>
                  Select prospective dose:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {ladderRungs.map((rung) => {
                    const isSelected = targetDoseMg === rung.mg;
                    return (
                      <Pressable
                        key={rung.mg}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setTargetDoseMg(rung.mg);
                        }}
                        style={[
                          styles.rungChip,
                          {
                            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceMuted,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            theme.typography.captionMedium,
                            { color: isSelected ? theme.colors.surface : theme.colors.text },
                          ]}
                        >
                          {rung.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Card>

            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                PROJECTED 4-WEEK ACCUMULATION
              </Text>
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <MedicationLevelChart
                  points={titrationSim.titrationCurve}
                  width={chartWidth - 32}
                  height={200}
                />
              </View>

              <View style={[styles.titrationCompareGrid, { borderColor: theme.colors.border }]}>
                <View style={styles.titrationCol}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    Current Plan ({currentDoseMg} mg)
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 2 }]}>
                    ~{titrationSim.steadyStateCurrentMg} mg
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                    steady state
                  </Text>
                </View>

                <ArrowRight size={18} color={theme.colors.primary} style={{ marginHorizontal: 8 }} />

                <View style={styles.titrationCol}>
                  <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
                    Next Step ({targetDoseMg} mg)
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.primary, marginTop: 2 }]}>
                    ~{titrationSim.steadyStateTitrationMg} mg
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>
                    steady state
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Clinical Guidance Card */}
        <Card style={{ marginBottom: theme.spacing.md }}>
          <View style={styles.guidanceRow}>
            <Info size={18} color={theme.colors.primary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                Physiological Tip
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4, lineHeight: 18 }]}>
                {summary.actionRecommendation}
              </Text>
            </View>
          </View>
        </Card>

        {/* Disclaimer */}
        <View style={styles.disclaimerBox}>
          <AlertCircle size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, flex: 1, fontSize: 11, lineHeight: 16 }]}>
            Estimates are pharmacokinetic models based on published half-lives. Individual metabolic clearance rates vary. Always consult your prescriber.
          </Text>
        </View>
      </ScrollView>

      {/* Share Modal */}
      <ShareableProgressCard
        visible={shareOpen}
        db={db}
        onClose={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    marginBottom: 8,
  },
  segmentGroup: {
    flexDirection: 'row',
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  phaseBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tfChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  rungChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  titrationCompareGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 14,
    padding: 12,
  },
  titrationCol: {
    flex: 1,
    alignItems: 'center',
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 8,
  },
});
