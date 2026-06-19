import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  FileText,
  HeartPulse,
  History,
  Pill,
  Scale,
  Settings,
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
import { SoftReviewPromptSheet } from '../../components/SoftReviewPromptSheet';
import { SmartAlertsSheet } from '../../components/SmartAlertsSheet';
import { adherenceCount, recentWeeklyAdherence } from '../../domain/adherence';
import { daysUntilEligibleToBump, nextRung } from '../../domain/dose';
import {
  computeEntitlement,
  shouldShowTrialBanner,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { buildCsv, buildJson } from '../../domain/export';
import { totalProteinForDay } from '../../domain/food';
import { proteinProgress, proteinTargetGrams } from '../../domain/protein';
import { buildProgressChecklist, type ProgressChecklistNextAction } from '../../domain/progressChecklist';
import { refillStatus } from '../../domain/refill';
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
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [reviewPromptShownThisSession, setReviewPromptShownThisSession] = useState(false);

  const [today, setToday] = useState(() => new Date());

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
  const progressChecklist = useMemo(
    () => buildProgressChecklist(db, today),
    [db, today],
  );
  const smartAlerts = useMemo(
    () => buildSmartAlerts(db, today),
    [db, today],
  );
  const unreadAlerts = unreadSmartAlertCount(smartAlerts);

  const onChecklistContinue = (action: ProgressChecklistNextAction): void => {
    switch (action) {
      case 'DOSE':
        navigation.navigate('DoseLadder');
        return;
      case 'SHOT':
        navigation.navigate('Shot');
        return;
      case 'WEIGHT':
        setWeightSheetOpen(true);
        return;
      case 'SYMPTOMS':
        navigation.navigate('Symptoms');
        return;
      case 'DONE':
        navigation.navigate('WeeklyProgress');
    }
  };

  const openAlerts = (): void => {
    setAlertsOpen(true);
    if (smartAlerts.length === 0 || unreadAlerts === 0) return;
    updateDb((prev) => ({
      ...prev,
      smartAlerts: markSmartAlertsSeen(prev.smartAlerts, smartAlerts, new Date()),
    }));
  };

  const onAlertAction = (action: SmartAlertAction): void => {
    setAlertsOpen(false);
    updateDb((prev) => ({
      ...prev,
      smartAlerts: markSmartAlertsSeen(prev.smartAlerts, smartAlerts, new Date()),
    }));
    switch (action) {
      case 'DOSE':
        navigation.navigate('DoseLadder');
        return;
      case 'SHOT':
        navigation.navigate('Shot');
        return;
      case 'WEIGHT':
        setWeightSheetOpen(true);
        return;
      case 'SYMPTOMS':
        navigation.navigate('Symptoms');
        return;
      case 'FOOD':
        navigation.navigate('Food');
        return;
      case 'REFILL':
        navigation.navigate('Refill');
        return;
      case 'WEEKLY_PROGRESS':
        navigation.navigate('WeeklyProgress');
        return;
      case 'DOCTOR_REPORT':
        navigation.navigate('DoctorReport');
        return;
      case 'SETTINGS_EXPORT':
        openExportDialog();
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
            <Pressable
              onPress={() => navigation.navigate('History')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Open history"
              accessibilityHint="Shows everything you have logged"
              style={({ pressed }) => [
                styles.headerIconButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: 999,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <History size={18} color={theme.colors.text} strokeWidth={2} />
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
                    Subscribe now to keep your timeline.
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
                    Subscribe to keep tracking.
                  </Text>
                </View>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                  Subscribe {'\u203a'}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* ─── Today’s coach ──────────────────────────────────── */}
        <Card
          accent
          style={{ marginBottom: theme.spacing.md }}
          accessibilityLabel={`${coach.eyebrow}. ${coach.title}. ${coach.detail}. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`}
        >
          <View style={styles.topCardRow}>
            <View style={styles.topCardText}>
              <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                {coach.eyebrow}
              </Text>
              <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                {coach.title}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
                {coach.detail}
              </Text>
              {coach.actions.length > 0 && (
                <View style={styles.coachActions}>
                  {coach.actions.map((action) => (
                    <CoachChip
                      key={`${action.type}-${action.label}`}
                      action={action}
                      onPress={() => onAlertAction(action.type)}
                    />
                  ))}
                </View>
              )}
            </View>
            <View style={styles.topCardRing}>
              <AdherenceRing adherence={adherence} size={64} thickness={9} />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, marginTop: 4, fontSize: 10 },
                ]}
              >
                Last {ADHERENCE_WEEKS} wks
              </Text>
            </View>
          </View>
        </Card>

        {!progressChecklist.complete && (
          <Card style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
              START HERE
            </Text>
            <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
              {progressChecklist.headline}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
              {progressChecklist.completedCount} of {progressChecklist.totalCount} complete. {progressChecklist.body}
            </Text>
            <View style={{ marginTop: 12 }}>
              {progressChecklist.items.map((item) => (
                <ChecklistLine key={item.id} label={item.label} completed={item.completed} />
              ))}
            </View>
            <Button
              label="Continue"
              fullWidth
              onPress={() => onChecklistContinue(progressChecklist.nextAction)}
              style={{ marginTop: 14 }}
            />
          </Card>
        )}

        {/* ─── Weekly progress insight ───────────────────────── */}
        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            WEEKLY PROGRESS
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {weeklyProgress.takeaway}
          </Text>
          <View style={{ marginTop: 12 }}>
            <ProgressLine label="Shot" value={weeklyProgress.shot.label} />
            <ProgressLine label="Protein" value={weeklyProgress.protein.label} />
            <ProgressLine label="Symptoms" value={weeklyProgress.symptoms.label} />
            <ProgressLine label="Weight" value={weeklyProgress.weight.label} />
          </View>
          {weightMilestone.status === 'ACTIVE' && (
            <View
              style={[
                styles.milestoneBadge,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
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
          {weeklyProgress.weight.needsAnotherWeight && (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 12, lineHeight: 18 }]}>
              Add one weight when you can to keep your trend and doctor report accurate.
            </Text>
          )}
          <View style={styles.weeklyActions}>
            {weeklyProgress.weight.needsAnotherWeight && (
              <Button
                label="Add weight"
                onPress={() => setWeightSheetOpen(true)}
                style={styles.weeklyActionButton}
              />
            )}
            <Button
              label="View details"
              variant={weeklyProgress.weight.needsAnotherWeight ? 'secondary' : 'primary'}
              onPress={() => navigation.navigate('WeeklyProgress')}
              style={styles.weeklyActionButton}
            />
          </View>
        </Card>

        {/* ─── Doctor report ───────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => navigation.navigate('DoctorReport')}
          accessibilityLabel="Doctor visit report. Create and share a GLP-1 progress summary."
          accessibilityHint="Opens the doctor report screen"
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            DOCTOR VISIT REPORT
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            Create a shareable progress summary
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
            Includes shots, symptoms, weight, protein, refills, and notes for your visit.
          </Text>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary, marginTop: 12 }]}>
            Create report {'\u203a'}
          </Text>
        </Card>

        {/* ─── Protein gauge ──────────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => {
            if (proteinTarget > 0) navigation.navigate('Food');
            else setWeightSheetOpen(true);
          }}
          accessibilityLabel={
            proteinTarget > 0
              ? `Protein today: ${Math.round(proteinTodayG)} of ${proteinTarget} grams. Tap to log.`
              : 'Protein log. No target set yet. Tap to add weight and compute one.'
          }
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            PROTEIN TODAY
          </Text>
          {proteinTarget > 0 ? (
            <>
              <View style={styles.gaugeRow}>
                <Text style={[theme.typography.hero, { color: theme.colors.text }]}>
                  {Math.round(proteinTodayG)}
                </Text>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textMuted, marginLeft: 6, marginBottom: 6 },
                  ]}
                >
                  / {proteinTarget} g
                </Text>
              </View>
              <View style={[styles.gaugeBar, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={{
                    width: `${Math.min(100, proteinPct * 100)}%`,
                    height: '100%',
                    backgroundColor: proteinPct >= 1 ? theme.colors.success : theme.colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
                Tap to log a quick add.
              </Text>
            </>
          ) : (
            <>
              <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                Add your weight to set a target
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                Tap here to add weight and calculate your daily protein target.
              </Text>
            </>
          )}
        </Card>

        {/* ─── Medication ─────────────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          accent={refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY'}
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            MEDICATION
          </Text>
          <MedicationRow
            title={`Dose: ${db.profile.currentDoseLabel || 'Not set'}`}
            detail={
              !db.profile.currentDoseMg
                ? 'Set your starting dose.'
                : upcomingRung && daysToBump !== null
                  ? `Next: ${upcomingRung.label} ${daysToBump === 0 ? 'eligible now' : `in ${daysToBump} day${daysToBump === 1 ? '' : 's'}`}`
                  : 'At top of ladder. Discuss maintenance with your doctor.'
            }
            onPress={() => navigation.navigate('DoseLadder')}
            accessibilityLabel={`Dose. Current dose: ${db.profile.currentDoseLabel || 'not set'}.`}
          />
          <View style={[styles.medicationDivider, { backgroundColor: theme.colors.border }]} />
          <MedicationRow
            title={
              refill.unconfigured
                ? 'Refill: not set'
                : `Refill: ${refill.dosesRemaining}/${refill.dosesPerPen} dose${refill.dosesPerPen === 1 ? '' : 's'} left`
            }
            detail={
              refill.unconfigured
                ? 'Set up refill tracking.'
                : refill.alertLevel === 'EMPTY'
                  ? 'Empty. Refill before your next shot.'
                  : refill.alertLevel === 'URGENT'
                    ? refill.refillRequested
                      ? 'Requested. Mark picked up when ready.'
                      : 'Running low. Review refill.'
                    : refill.alertLevel === 'INFO'
                      ? 'Heads up. Running low.'
                      : 'You’re stocked.'
            }
            tone={
              refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY'
                ? 'danger'
                : refill.alertLevel === 'INFO'
                  ? 'warning'
                  : 'default'
            }
            onPress={() => navigation.navigate('Refill')}
            accessibilityLabel={
              refill.unconfigured
                ? 'Refill not set. Opens refill tracking.'
                : `Refill ${refill.dosesRemaining} of ${refill.dosesPerPen} doses left.`
            }
          />
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
      <SmartAlertsSheet
        visible={alertsOpen}
        alerts={smartAlerts}
        onClose={() => setAlertsOpen(false)}
        onAction={onAlertAction}
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

function ChecklistLine({ label, completed }: { label: string; completed: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.checklistLine}>
      <Text style={[theme.typography.captionMedium, { color: completed ? theme.colors.success : theme.colors.textMuted }]}>
        {completed ? '✓' : '□'}
      </Text>
      <Text style={[theme.typography.caption, { color: completed ? theme.colors.text : theme.colors.textMuted, flex: 1 }]}>
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
  checklistLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
});
