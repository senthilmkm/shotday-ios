import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Activity,
  Bell,
  Calendar,
  FileText,
  HeartPulse,
  History,
  Pill,
  Scale,
  Settings,
  Share2,
  Syringe,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddWeightSheet } from '../../components/AddWeightSheet';
import { AdherenceRing } from '../../components/AdherenceRing';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ShareableProgressCard } from '../../components/ShareableProgressCard';
import { SoftReviewPromptSheet } from '../../components/SoftReviewPromptSheet';
import { CycleConciergeCard } from '../../components/CycleConciergeCard';
import { SmartAlertsSheet } from '../../components/SmartAlertsSheet';
import { SatietyShieldHeader } from '../../components/SatietyShieldHeader';
import { QuickLogMicroBar } from '../../components/QuickLogMicroBar';
import { adherenceCount, recentWeeklyAdherence } from '../../domain/adherence';
import { buildCycleConcierge, type ConciergeAction } from '../../domain/cycleConcierge';
import { dayAfterShotClamped } from '../../domain/dateMath';
import { daysUntilEligibleToBump, nextRung } from '../../domain/dose';
import {
  computeEntitlement,
  shouldShowTrialBanner,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { buildCsv, buildJson } from '../../domain/export';
import { totalProteinForDay } from '../../domain/food';
import { summarizeActiveLevel } from '../../domain/medicationLevel';
import { proteinProgress, proteinTargetGrams } from '../../domain/protein';
import { refillStatus } from '../../domain/refill';
import type { FoodEntry, WaterEntry } from '../../types/domain';
import {
  APP_STORE_REVIEW_URL,
  APP_STORE_REVIEW_WEB_URL,
  shouldShowSoftReviewPrompt,
} from '../../domain/reviewPrompt';
import {
  buildSmartAlerts,
  markSmartAlertsSeen,
  unreadSmartAlertCount,
  type SmartAlertAction,
  type SmartAlertIcon,
} from '../../domain/smartAlerts';
import { buildTodaysCoach, type CoachAction } from '../../domain/todaysCoach';
import { weightMilestoneSummary } from '../../domain/weight';
import { summarizeWeeklyProgress } from '../../domain/weeklyProgress';
import {
  totalWaterForDay,
  waterProgress,
  waterTargetMl,
  waterTargetOz,
} from '../../domain/water';
import { useProAccess } from '../../hooks/useProAccess';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import type { MainTabsParamList } from '../../navigation/MainTabs';

/**
 * Home is hosted inside `MainTabs`, which itself is hosted inside the
 * root native stack. We compose both navigation prop types so callers
 * can `navigate('Shot')` (a tab) or `navigate('DoseLadder')` (a modal
 * on the parent stack) without TypeScript complaining.
 */
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<AppStackParamList>
>;

const ACTION_ICONS: Record<SmartAlertIcon, LucideIcon> = {
  settings: Settings,
  syringe: Syringe,
  scale: Scale,
  heart: HeartPulse,
  utensils: Utensils,
  pill: Pill,
  file: FileText,
  download: FileText,
};

export function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const tabBarHeight = useBottomTabBarHeight();
  const { db, updateDb } = useShotdayDb();
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [reviewPromptShownThisSession, setReviewPromptShownThisSession] = useState(false);

  const [today, setToday] = useState(() => new Date());
  const { hasProAccess, requireProAccess } = useProAccess(today);

  useEffect(() => {
    const refresh = (): void => setToday(new Date());
    const timer = setInterval(refresh, 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  const coach = useMemo(() => buildTodaysCoach(db, today), [db, today]);
  const cycleConcierge = useMemo(() => buildCycleConcierge(db, today), [db, today]);

  // Active GLP-1 blood level and cycle phase
  const activeLevel = useMemo(
    () => summarizeActiveLevel(db.injections, db.profile.drug, today),
    [db.injections, db.profile.drug, today],
  );

  // Adherence ring: how many of the last 8 weekly windows had a shot
  // logged? The current (in-progress) week shows hollow until logged.
  const ADHERENCE_WEEKS = 8;
  const adherence = useMemo(
    () => recentWeeklyAdherence(db.injections, db.profile.shotDay, today, ADHERENCE_WEEKS),
    [db.injections, db.profile.shotDay, today],
  );
  const adherenceHits = adherenceCount(adherence);
  const weeklyProgress = useMemo(
    () => summarizeWeeklyProgress(db, today),
    [db, today],
  );
  const weightMilestone = useMemo(
    () => weightMilestoneSummary(db, today),
    [db, today],
  );
  const smartAlerts = useMemo(
    () => buildSmartAlerts(db, today),
    [db, today],
  );
  const unreadAlerts = hasProAccess ? unreadSmartAlertCount(smartAlerts) : 0;

  const openAlerts = (): void => {
    if (!requireProAccess()) return;
    setAlertsOpen(true);
    if (smartAlerts.length === 0 || unreadAlerts === 0) return;
    updateDb((prev) => ({
      ...prev,
      smartAlerts: markSmartAlertsSeen(prev.smartAlerts, smartAlerts, new Date()),
    }));
  };

  const openMedicationLevels = (): void => {
    if (requireProAccess()) navigation.navigate('MedicationLevels');
  };

  const openDoseLadder = (): void => {
    if (requireProAccess()) navigation.navigate('DoseLadder');
  };

  const openShotLog = (): void => {
    if (requireProAccess()) navigation.navigate('Shot');
  };

  const openWeightSheet = (): void => {
    if (requireProAccess()) setWeightSheetOpen(true);
  };

  const openSymptomsLog = (): void => {
    if (requireProAccess()) navigation.navigate('Symptoms');
  };

  const openFoodLog = (initialTab: 'PROTEIN' | 'WATER' = 'PROTEIN'): void => {
    if (requireProAccess()) navigation.navigate('Food', { initialTab });
  };

  const openRefill = (): void => {
    if (requireProAccess()) navigation.navigate('Refill');
  };

  const openWeeklyProgress = (): void => {
    if (requireProAccess()) navigation.navigate('WeeklyProgress');
  };

  const openDoctorReport = (): void => {
    if (requireProAccess()) navigation.navigate('DoctorReport');
  };

  const onAlertAction = (action: SmartAlertAction): void => {
    setAlertsOpen(false);
    updateDb((prev) => ({
      ...prev,
      smartAlerts: markSmartAlertsSeen(prev.smartAlerts, smartAlerts, new Date()),
    }));
    switch (action) {
      case 'DOSE':
        openDoseLadder();
        return;
      case 'SHOT':
        openShotLog();
        return;
      case 'WEIGHT':
        openWeightSheet();
        return;
      case 'SYMPTOMS':
        openSymptomsLog();
        return;
      case 'FOOD':
        openFoodLog();
        return;
      case 'REFILL':
        openRefill();
        return;
      case 'WEEKLY_PROGRESS':
        openWeeklyProgress();
        return;
      case 'DOCTOR_REPORT':
        openDoctorReport();
        return;
      case 'SETTINGS_EXPORT':
        openExportDialog();
    }
  };

  const onConciergeAction = (action: ConciergeAction): void => {
    switch (action.type) {
      case 'SHOT':
        openShotLog();
        return;
      case 'WEIGHT':
        openWeightSheet();
        return;
      case 'SYMPTOMS':
        openSymptomsLog();
        return;
      case 'FOOD':
        openFoodLog(action.initialTab ?? 'PROTEIN');
        return;
      case 'DOSE':
        openDoseLadder();
        return;
      case 'REFILL':
        openRefill();
        return;
      case 'WEEKLY_PROGRESS':
        openWeeklyProgress();
        return;
      case 'DOCTOR_REPORT':
        openDoctorReport();
        return;
      case 'MEDICATION_LEVELS':
        openMedicationLevels();
        return;
    }
  };

  const openExportDialog = (): void => {
    Alert.alert(
      'Export your data',
      'Pick a format. Both contain your full Shotday log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV (spreadsheet)',
          onPress: () => {
            Share.share({
              title: 'Shotday data export.csv',
              message: buildCsv(db),
            }).catch(() => {});
          },
        },
        {
          text: 'JSON (full backup)',
          onPress: () => {
            Share.share({
              title: 'Shotday data export.json',
              message: buildJson(db),
            }).catch(() => {});
          },
        },
      ],
    );
  };

  const handleAddQuickWater = (oz: number): void => {
    const newEntry: WaterEntry = {
      id: `w-${Date.now()}`,
      amountOz: oz,
      loggedAt: new Date().toISOString(),
      label: `${oz} oz quick log`,
    };
    updateDb((prev) => ({
      ...prev,
      waterEntries: [...(prev.waterEntries ?? []), newEntry],
    }));
  };

  const handleAddQuickProtein = (grams: number): void => {
    const newEntry: FoodEntry = {
      id: `f-${Date.now()}`,
      name: 'Quick Protein',
      proteinGrams: grams,
      preset: false,
      loggedAt: new Date().toISOString(),
    };
    updateDb((prev) => ({
      ...prev,
      foods: [...prev.foods, newEntry],
    }));
  };

  const dayAfterShot = useMemo(
    () => dayAfterShotClamped(db.injections, today),
    [db.injections, today],
  );

  // Protein
  const proteinTarget = useMemo(() => {
    if (db.profile.weight <= 0) return 0;
    try {
      return proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
    } catch {
      return 0;
    }
  }, [db.profile.weight, db.profile.weightUnit]);

  const proteinTodayG = useMemo(
    () => totalProteinForDay(db.foods, today),
    [db.foods, today],
  );
  const proteinPct = proteinProgress(proteinTodayG, proteinTarget);

  // Water / Hydration
  const isMetric = db.profile.weightUnit === 'KG';
  const targetWaterOz = useMemo(
    () => waterTargetOz(db.profile.weight, db.profile.weightUnit),
    [db.profile.weight, db.profile.weightUnit],
  );
  const targetWaterMl = useMemo(
    () => waterTargetMl(db.profile.weight, db.profile.weightUnit),
    [db.profile.weight, db.profile.weightUnit],
  );
  const waterToday = useMemo(
    () => totalWaterForDay(db.waterEntries ?? [], today),
    [db.waterEntries, today],
  );
  const waterPct = waterProgress(waterToday.oz, targetWaterOz);

  // Dose ladder mini
  const upcomingRung = nextRung(db.profile.drug, db.profile.currentDoseMg);
  const lastRungChange = db.doseHistory[db.doseHistory.length - 1];
  const daysToBump = lastRungChange
    ? daysUntilEligibleToBump(new Date(lastRungChange.startedAt), today)
    : null;

  // Refill
  const refill = useMemo(
    () => refillStatus(db.refill, db.injections, today),
    [db.refill, db.injections, today],
  );

  // Subscription / trial — banner is the only entry point. We never
  // auto-push the paywall on cold launch: that was hostile UX, kicking
  // the user out of Home before they could even see what they were
  // paying for. The "TRIAL ENDED" banner is sticky at the top of Home
  // and the Settings → Subscription row is always one tap away.
  const entitlement = computeEntitlement(db.profile, today);
  const trialDays = trialDaysRemaining(db.profile, today);
  const showTrialBanner = shouldShowTrialBanner(db.profile, today);

  useEffect(() => {
    if (reviewPromptShownThisSession || reviewPromptOpen) return;
    if (!shouldShowSoftReviewPrompt(db, today)) return;
    const timer = setTimeout(() => {
      const nowIso = new Date().toISOString();
      setReviewPromptShownThisSession(true);
      setReviewPromptOpen(true);
      updateDb((prev) => ({
        ...prev,
        reviewPrompt: {
          ...prev.reviewPrompt,
          lastShownAt: nowIso,
        },
      }));
    }, 900);
    return () => clearTimeout(timer);
  }, [db, reviewPromptOpen, reviewPromptShownThisSession, today, updateDb]);

  const closeReviewPrompt = (): void => {
    const nowIso = new Date().toISOString();
    setReviewPromptOpen(false);
    updateDb((prev) => ({
      ...prev,
      reviewPrompt: {
        ...prev.reviewPrompt,
        lastDismissedAt: nowIso,
      },
    }));
  };

  const openReview = (): void => {
    const nowIso = new Date().toISOString();
    setReviewPromptOpen(false);
    updateDb((prev) => ({
      ...prev,
      reviewPrompt: {
        ...prev.reviewPrompt,
        reviewedAt: nowIso,
      },
    }));
    Linking.openURL(APP_STORE_REVIEW_URL)
      .catch(() => Linking.openURL(APP_STORE_REVIEW_WEB_URL))
      .catch(() => {});
  };

  // Weight re-ask nudge — protein target drifts as users on GLP-1 lose
  // weight, and most never re-open Settings to update it. After 60
  // days we surface a one-line banner so the target stays calibrated.
  const showWeightNudge = useMemo(() => {
    if (db.profile.weight <= 0) return false;
    if (!db.profile.weightUpdatedAt) return false;
    const updated = new Date(db.profile.weightUpdatedAt).getTime();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    return today.getTime() - updated > sixtyDaysMs;
  }, [db.profile.weight, db.profile.weightUpdatedAt, today]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: tabBarHeight + theme.spacing.lg }}>
        <View style={styles.headerRow}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            {greeting(today)}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate('History')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="View history and calendar"
              accessibilityHint="Opens the calendar timeline and progress charts"
              style={({ pressed }) => [
                styles.headerIconButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: 999,
                  opacity: pressed ? 0.6 : 1,
                  marginRight: 8,
                },
              ]}
            >
              <Calendar size={18} color={theme.colors.text} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => setShareCardOpen(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Share progress card"
              accessibilityHint="Opens shareable milestone and progress card"
              style={({ pressed }) => [
                styles.headerIconButton,
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
              onPress={openAlerts}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={
                unreadAlerts > 0
                  ? `Open smart alerts. ${unreadAlerts} unread.`
                  : 'Open smart alerts'
              }
              accessibilityHint="Shows reminders for missing data needed by Shotday"
              style={({ pressed }) => [
                styles.headerIconButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: 999,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Bell size={18} color={theme.colors.text} strokeWidth={2} />
              {unreadAlerts > 0 && (
                <View
                  style={[
                    styles.alertBadge,
                    {
                      backgroundColor: theme.colors.danger,
                      borderColor: theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={styles.alertBadgeText}>
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {showWeightNudge && (
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Has your weight changed? Tap to update it in Settings."
            accessibilityHint="Opens the Settings tab to update your weight and protein target"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.md,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                    QUICK CHECK
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.text, marginTop: 2 }]}>
                    Has your weight changed? It's been a while — your protein target depends on it.
                  </Text>
                </View>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                  Update {'\u203a'}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {showTrialBanner && (
          <Pressable
            onPress={() => navigation.navigate('Paywall')}
            accessibilityRole="button"
            accessibilityLabel={
              trialDays === 0
                ? 'Trial ends today. Tap to subscribe.'
                : `Trial ends in ${trialDays} day${trialDays === 1 ? '' : 's'}. Tap to subscribe.`
            }
            accessibilityHint="Opens the subscription screen"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.md,
                    borderColor: theme.colors.warning,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.warning }]}>
                    {trialDays === 0
                      ? 'TRIAL ENDS TODAY'
                      : `TRIAL ENDS IN ${trialDays} DAY${trialDays === 1 ? '' : 'S'}`}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                    Keep Today’s Coach, doctor reports, milestones, and smart alerts.
                  </Text>
                </View>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                  Upgrade {'\u203a'}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {entitlement === 'EXPIRED' && (
          <Pressable
            onPress={() => navigation.navigate('Paywall')}
            accessibilityRole="button"
            accessibilityLabel="Trial ended. Tap to subscribe."
            accessibilityHint="Opens the subscription screen"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.md,
                    borderColor: theme.colors.danger,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.danger }]}>
                    TRIAL ENDED
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                    Subscribe to keep your private GLP-1 coach and progress reports.
                  </Text>
                </View>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                  Subscribe {'\u203a'}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* ─── Living Biological Aura & Satiety Shield ────────── */}
        <SatietyShieldHeader
          drugName={db.profile.drug === 'OTHER' ? (db.profile.customDrugName || 'GLP-1') : db.profile.drug}
          doseLabel={db.profile.currentDoseLabel || `${db.profile.currentDoseMg} mg`}
          activeLevelMg={activeLevel.currentActiveMg}
          nominalDoseMg={db.profile.currentDoseMg}
          dayAfterShot={dayAfterShot}
          onPress={openMedicationLevels}
        />

        {/* ─── 1-Tap Quick Action Micro-Bar ───────────────────────── */}
        <QuickLogMicroBar
          onAddWaterOz={handleAddQuickWater}
          onAddProteinGrams={handleAddQuickProtein}
          onOpenSymptoms={openSymptomsLog}
        />

        {/* ─── Cycle-Aware Concierge & Ritual ─────────────────── */}
        {hasProAccess ? (
          <CycleConciergeCard concierge={cycleConcierge} onAction={onConciergeAction} />
        ) : (
          <Card
            accent
            style={{ marginBottom: theme.spacing.md }}
            onPress={() => navigation.navigate('Paywall')}
            accessibilityLabel="Cycle-Aware GLP-1 Concierge is paused. Subscribe to unlock."
            accessibilityHint="Opens the subscription screen"
          >
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
              GLP-1 CYCLE CONCIERGE
            </Text>
            <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
              Your GLP-1 concierge is paused
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
              Subscribe to unlock 7-day cycle guidance, Shot Day rituals, symptom check-ins, and titration milestones.
            </Text>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary, marginTop: 12 }]}>
              Subscribe to unlock {'\u203a'}
            </Text>
          </Card>
        )}

        {/* ─── Active medication level & half-life ────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={openMedicationLevels}
          accessibilityLabel={`Active medication level: ${activeLevel.currentActiveMg} mg. Phase: ${activeLevel.headline}. Tap to view live curve and titration simulator.`}
          accessibilityHint="Opens the medication levels and half-life curve screen"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
              ESTIMATED ACTIVE LEVEL
            </Text>
            <View
              style={[
                styles.phaseBadgeMini,
                {
                  backgroundColor:
                    activeLevel.phase === 'PEAK_CONCENTRATION'
                      ? theme.colors.primary + '20'
                      : activeLevel.phase === 'TROUGH_FOOD_NOISE'
                        ? theme.colors.warning + '20'
                        : theme.colors.surfaceMuted,
                  borderColor:
                    activeLevel.phase === 'PEAK_CONCENTRATION'
                      ? theme.colors.primary
                      : activeLevel.phase === 'TROUGH_FOOD_NOISE'
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
                      activeLevel.phase === 'PEAK_CONCENTRATION'
                        ? theme.colors.primary
                        : activeLevel.phase === 'TROUGH_FOOD_NOISE'
                          ? theme.colors.warning
                          : theme.colors.text,
                    fontSize: 10,
                  },
                ]}
              >
                {activeLevel.phase === 'PEAK_CONCENTRATION'
                  ? '⚡ Peak'
                  : activeLevel.phase === 'TROUGH_FOOD_NOISE'
                    ? '🍽️ Appetite window'
                    : activeLevel.phase === 'NO_DATA'
                      ? 'No shots'
                      : '🔄 Steady state'}
              </Text>
            </View>
          </View>

          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 6 }]}>
            {activeLevel.currentActiveMg > 0
              ? `${activeLevel.currentActiveMg} mg active in body`
              : 'Log shot to see active level'}
          </Text>

          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4, lineHeight: 18 }]}>
            {activeLevel.insight}
          </Text>

          <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary, marginTop: 10 }]}>
            View live curve & titration ›
          </Text>
        </Card>

        {/* ─── Weekly progress insight ───────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={openWeeklyProgress}
          accessibilityLabel={`Weekly progress. ${weeklyProgress.takeaway}`}
          accessibilityHint="Opens the weekly progress screen"
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            WEEKLY PROGRESS
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {weeklyProgress.takeaway}
          </Text>
          {weightMilestone.status === 'ACTIVE' && (
            <View
              style={[
                styles.milestoneBadge,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  marginTop: 10,
                },
              ]}
            >
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                WEIGHT MILESTONE
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text, marginTop: 2 }]}>
                Down {weightMilestone.totalLost} {weightMilestone.unit} since starting · {weightMilestone.detail}
              </Text>
            </View>
          )}
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary, marginTop: 12 }]}>
            View details {'\u203a'}
          </Text>
        </Card>


        {/* ─── Nutrition & Hydration Gauges ──────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => openFoodLog('PROTEIN')}
          accessibilityLabel={`Daily fuel and hydration. Protein: ${Math.round(proteinTodayG)} of ${proteinTarget} grams. Water: ${isMetric ? waterToday.ml.toLocaleString() : waterToday.oz} of ${isMetric ? targetWaterMl.toLocaleString() : targetWaterOz} ${isMetric ? 'ml' : 'oz'}. Tap to log.`}
          accessibilityHint="Opens daily nutrition and hydration logger"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
              DAILY FUEL & HYDRATION
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              Tap to log ›
            </Text>
          </View>

          {/* Protein Row */}
          <Pressable
            onPress={() => {
              if (proteinTarget > 0) openFoodLog('PROTEIN');
              else openWeightSheet();
            }}
            style={{ marginBottom: 14 }}
            accessibilityRole="button"
            accessibilityLabel={
              proteinTarget > 0
                ? `Protein today: ${Math.round(proteinTodayG)} of ${proteinTarget} grams.`
                : 'Protein log. No target set yet. Tap to set weight.'
            }
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                🥩 Protein
              </Text>
              {proteinTarget > 0 ? (
                <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
                  {Math.round(proteinTodayG)} / {proteinTarget} g
                </Text>
              ) : (
                <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
                  Set target ›
                </Text>
              )}
            </View>
            {proteinTarget > 0 ? (
              <View style={[styles.gaugeBar, { backgroundColor: theme.colors.surfaceMuted, marginTop: 6 }]}>
                <View
                  style={{
                    width: `${Math.min(100, proteinPct * 100)}%`,
                    height: '100%',
                    backgroundColor: proteinPct >= 1 ? theme.colors.success : theme.colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
            ) : (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Add weight in Settings to calculate daily target.
              </Text>
            )}
          </Pressable>

          {/* Water Row */}
          <Pressable
            onPress={() => openFoodLog('WATER')}
            accessibilityRole="button"
            accessibilityLabel={`Water today: ${isMetric ? waterToday.ml.toLocaleString() : waterToday.oz} of ${isMetric ? targetWaterMl.toLocaleString() : targetWaterOz} ${isMetric ? 'ml' : 'oz'}.`}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                💧 Water
              </Text>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
                {isMetric ? waterToday.ml.toLocaleString() : waterToday.oz} / {isMetric ? targetWaterMl.toLocaleString() : targetWaterOz} {isMetric ? 'ml' : 'oz'}
              </Text>
            </View>
            <View style={[styles.gaugeBar, { backgroundColor: theme.colors.surfaceMuted, marginTop: 6 }]}>
              <View
                style={{
                  width: `${Math.min(100, waterPct * 100)}%`,
                  height: '100%',
                  backgroundColor: waterPct >= 1 ? theme.colors.success : theme.colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
          </Pressable>
        </Card>

        {/* ─── History & charts shortcut ───────────────────────── */}
        <Pressable
          onPress={() => navigation.navigate('History')}
          accessibilityRole="button"
          accessibilityLabel="View history and progress charts"
          accessibilityHint="Opens the calendar, timeline, and charts screen"
        >
          {({ pressed }) => (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.md,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.9 : 1,
                  marginTop: theme.spacing.sm,
                  marginBottom: theme.spacing.xl,
                },
              ]}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '600' }]}>
                  View history, calendar & charts
                </Text>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary, fontWeight: '600' }]}>
                  ›
                </Text>
              </View>
            </View>
          )}
        </Pressable>

        {/* ─── Educational & Clinical Disclaimer ────────────────── */}
        <View style={styles.disclaimerBox}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center', fontSize: 10, lineHeight: 15 }]}>
            ⚕️ For educational and habit-tracking reference only. Shotday does not provide medical advice, diagnosis, or treatment. Always follow your prescribing clinician's instructions.
          </Text>
        </View>
      </ScrollView>
      <AddWeightSheet
        visible={weightSheetOpen}
        initialWeight={db.profile.weight}
        initialUnit={db.profile.weightUnit}
        onClose={() => setWeightSheetOpen(false)}
        onSave={(weight, unit, note) => {
          if (!requireProAccess()) {
            setWeightSheetOpen(false);
            return;
          }
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
      <SmartAlertsSheet
        visible={alertsOpen}
        alerts={smartAlerts}
        onClose={() => setAlertsOpen(false)}
        onAction={onAlertAction}
      />
      <ShareableProgressCard
        visible={shareCardOpen}
        db={db}
        onClose={() => setShareCardOpen(false)}
      />
      <SoftReviewPromptSheet
        visible={reviewPromptOpen}
        onLater={closeReviewPrompt}
        onReview={openReview}
      />
    </SafeAreaView>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function CoachChip({
  action,
  onPress,
}: {
  action: CoachAction;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const Icon = ACTION_ICONS[action.icon];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [
        styles.coachChip,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.full,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon size={14} color={theme.colors.primary} strokeWidth={2.2} />
      <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function MedicationRow({
  title,
  detail,
  tone = 'default',
  onPress,
  accessibilityLabel,
}: {
  title: string;
  detail: string;
  tone?: 'default' | 'warning' | 'danger';
  onPress: () => void;
  accessibilityLabel: string;
}): React.ReactElement {
  const theme = useTheme();
  const detailColor =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'warning'
        ? theme.colors.warning
        : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.medicationRow, { opacity: pressed ? 0.72 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: detailColor, marginTop: 3, lineHeight: 18 }]}>
          {detail}
        </Text>
      </View>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
        {'\u203a'}
      </Text>
    </Pressable>
  );
}

function ProgressLine({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.progressLine}>
      <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );
}

function CoachChecklistLine({ label, complete }: { label: string; complete: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.coachChecklistLine}>
      <Text style={[theme.typography.captionMedium, { color: complete ? theme.colors.success : theme.colors.textMuted }]}>
        {complete ? '✓' : '○'}
      </Text>
      <Text style={[theme.typography.caption, { color: complete ? theme.colors.text : theme.colors.textMuted, flex: 1 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  gaugeRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 8 },
  gaugeBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  topCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topCardText: {
    flex: 1,
    paddingRight: 12,
  },
  topCardRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  coachChecklist: {
    marginTop: 12,
    gap: 6,
  },
  coachChecklistLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  medicationDivider: {
    height: StyleSheet.hairlineWidth,
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  weeklyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  weeklyActionButton: {
    flex: 1,
  },
  milestoneBadge: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  phaseBadgeMini: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  disclaimerBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 16,
  },
});
