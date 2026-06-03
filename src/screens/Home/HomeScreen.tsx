import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { History } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdherenceRing } from '../../components/AdherenceRing';
import { Card } from '../../components/Card';
import { adherenceCount, recentWeeklyAdherence } from '../../domain/adherence';
import {
  dayAfterShot,
  daysSinceLastShot,
  daysUntilNext,
} from '../../domain/dateMath';
import { daysUntilEligibleToBump, nextRung } from '../../domain/dose';
import {
  computeEntitlement,
  shouldShowTrialBanner,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { totalProteinForDay } from '../../domain/food';
import { proteinProgress, proteinTargetGrams } from '../../domain/protein';
import { refillStatus } from '../../domain/refill';
import { lastUsedZone, suggestNextZone } from '../../domain/rotation';
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

const ZONE_LABEL_SHORT: Record<string, string> = {
  BELLY_UL: 'Upper-left belly',
  BELLY_UR: 'Upper-right belly',
  BELLY_LL: 'Lower-left belly',
  BELLY_LR: 'Lower-right belly',
  THIGH_L: 'Left thigh',
  THIGH_R: 'Right thigh',
  ARM_L: 'Left arm',
  ARM_R: 'Right arm',
  OTHER: 'Other',
};

export function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const tabBarHeight = useBottomTabBarHeight();
  const { db } = useShotdayDb();

  const today = useMemo(() => new Date(), []);
  const daysUntilShot = daysUntilNext(db.profile.shotDay, today);
  const isShotDay = daysUntilShot === 0;

  const sinceLast = daysSinceLastShot(db.injections, today);
  const postShotDay = dayAfterShot(db.injections, today);
  const inPostShotWindow = postShotDay !== null;
  // True when shot day === today AND the user has already logged a
  // shot today. Without this we would slide back into SHOT_DAY mode
  // and re-invite the user to "log your injection", then route them
  // into the BLOCK_REPLACE alert. The `sinceLast === 0` test catches
  // both same-calendar-day logs and shots logged on shot day itself.
  const loggedToday = sinceLast === 0;

  const suggested = useMemo(() => suggestNextZone(db.injections), [db.injections]);
  const last = lastUsedZone(db.injections);

  // Most recent shot's timestamp — used by SHOT_DAY_LOGGED to render
  // "Shot logged at 9:14 AM" in the top card.
  const lastShotTimeLabel = useMemo(() => {
    if (db.injections.length === 0) return '';
    let latest = db.injections[0]!;
    for (const i of db.injections) {
      if (new Date(i.takenAt).getTime() > new Date(latest.takenAt).getTime()) latest = i;
    }
    return new Date(latest.takenAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [db.injections]);

  // Top-card priority:
  //   POST_SHOT          → in the 1..7 day side-effect window
  //   SHOT_DAY_LOGGED    → today is shot day AND a shot was already logged today
  //   SHOT_DAY           → today is shot day, no shot yet
  //   COUNTDOWN          → days until the next shot
  type TopMode = 'POST_SHOT' | 'SHOT_DAY_LOGGED' | 'SHOT_DAY' | 'COUNTDOWN';
  const topMode: TopMode = inPostShotWindow
    ? 'POST_SHOT'
    : isShotDay && loggedToday
      ? 'SHOT_DAY_LOGGED'
      : isShotDay
        ? 'SHOT_DAY'
        : 'COUNTDOWN';

  const onTopCardPress = (): void => {
    if (topMode === 'POST_SHOT') navigation.navigate('Symptoms');
    else if (topMode === 'SHOT_DAY_LOGGED') navigation.navigate('History');
    else navigation.navigate('Shot');
  };

  // Adherence ring: how many of the last 8 weekly windows had a shot
  // logged? The current (in-progress) week shows hollow until logged.
  const ADHERENCE_WEEKS = 8;
  const adherence = useMemo(
    () => recentWeeklyAdherence(db.injections, db.profile.shotDay, today, ADHERENCE_WEEKS),
    [db.injections, db.profile.shotDay, today],
  );
  const adherenceHits = adherenceCount(adherence);

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

  // Most recent side-effect log today — used to swap the post-shot card subtitle.
  const sideEffectLoggedToday = useMemo(() => {
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    return db.sideEffects.some((s) => new Date(s.loggedAt).getTime() >= startOfDay.getTime());
  }, [db.sideEffects, today]);

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
          <Pressable
            onPress={() => navigation.navigate('History')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Open history"
            accessibilityHint="Shows everything you have logged"
            style={({ pressed }) => [
              styles.historyButton,
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

        {/* ─── Top priority card ──────────────────────────────── */}
        <Card
          accent
          style={{ marginBottom: theme.spacing.md }}
          onPress={onTopCardPress}
          accessibilityLabel={
            topMode === 'POST_SHOT'
              ? sideEffectLoggedToday
                ? `Update how you feel. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`
                : `How are you feeling? Tap to log side effects. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`
              : topMode === 'SHOT_DAY_LOGGED'
                ? `Shot logged today at ${lastShotTimeLabel}. Tap to view history. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`
                : topMode === 'SHOT_DAY'
                  ? `It's shot day. Tap to log your injection. Suggested site: ${ZONE_LABEL_SHORT[suggested]}. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`
                  : `Next shot in ${daysUntilShot} day${daysUntilShot === 1 ? '' : 's'}. Adherence: ${adherenceHits} of last ${ADHERENCE_WEEKS} weeks.`
          }
        >
          <View style={styles.topCardRow}>
            <View style={styles.topCardText}>
              {topMode === 'POST_SHOT' ? (
                <>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.warning }]}>
                    {sinceLast === 0
                      ? 'EARLIER TODAY'
                      : sinceLast === 1
                        ? 'YESTERDAY'
                        : `${sinceLast} DAYS AGO`}
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                    {sideEffectLoggedToday ? 'Update how you feel' : 'How are you feeling?'}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                    {sideEffectLoggedToday
                      ? 'Tap to add to today\u2019s log.'
                      : 'A 20-second check-in helps you spot patterns.'}
                  </Text>
                </>
              ) : topMode === 'SHOT_DAY_LOGGED' ? (
                <>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.success }]}>
                    LOGGED TODAY
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                    Shot recorded at {lastShotTimeLabel}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                    See you next {labelDay(db.profile.shotDay)}. Tap for history.
                  </Text>
                </>
              ) : topMode === 'SHOT_DAY' ? (
                <>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
                    IT'S SHOT DAY
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                    Tap to log your injection.
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                    Suggested: {ZONE_LABEL_SHORT[suggested]}
                    {last && `   ·   Last week: ${ZONE_LABEL_SHORT[last]}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
                    NEXT SHOT
                  </Text>
                  <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                    {daysUntilShot === 1 ? 'Tomorrow' : `In ${daysUntilShot} days`}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                    Suggested site: {ZONE_LABEL_SHORT[suggested]}
                  </Text>
                </>
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

        {/* ─── Protein gauge ──────────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => navigation.navigate('Food')}
          accessibilityLabel={
            proteinTarget > 0
              ? `Protein today: ${Math.round(proteinTodayG)} of ${proteinTarget} grams. Tap to log.`
              : 'Protein log. No target set yet — add your weight in Settings to compute one.'
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
                Open Settings → Weight + Protein Target to start tracking.
              </Text>
            </>
          )}
        </Card>

        {/* ─── Dose ladder mini ───────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => navigation.navigate('DoseLadder')}
          accessibilityLabel={`Dose ladder. Current dose: ${db.profile.currentDoseLabel || 'not set'}.`}
          accessibilityHint="Opens the dose ladder screen"
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            DOSE LADDER
          </Text>
          <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
            {db.profile.currentDoseLabel || 'Not set'}
          </Text>
          {!db.profile.currentDoseMg ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
              Tap to set your starting dose.
            </Text>
          ) : upcomingRung && daysToBump !== null ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
              Next bump {'\u2192'} {upcomingRung.label}{' '}
              {daysToBump === 0 ? '(eligible now)' : `in ${daysToBump} day${daysToBump === 1 ? '' : 's'}`}
            </Text>
          ) : (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
              At top of ladder. Talk to your doctor about maintenance.
            </Text>
          )}
        </Card>

        {/* ─── Refill ─────────────────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => navigation.navigate('Refill')}
          accent={refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY'}
          accessibilityLabel={
            refill.unconfigured
              ? 'Set up refill tracking'
              : `Refill: ${refill.dosesRemaining} of ${refill.dosesPerPen} doses left. Status: ${refill.alertLevel.toLowerCase()}.`
          }
          accessibilityHint="Opens the refill screen"
        >
          <Text
            style={[
              theme.typography.captionMedium,
              {
                color:
                  refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY'
                    ? theme.colors.danger
                    : refill.alertLevel === 'INFO'
                      ? theme.colors.warning
                      : theme.colors.textMuted,
              },
            ]}
          >
            REFILL
          </Text>
          {refill.unconfigured ? (
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 4 }]}>
              Set up refill tracking →
            </Text>
          ) : (
            <>
              <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 4 }]}>
                {refill.dosesRemaining} of {refill.dosesPerPen} dose
                {refill.dosesPerPen === 1 ? '' : 's'} left
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color:
                      refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY'
                        ? theme.colors.danger
                        : theme.colors.textMuted,
                    marginTop: 6,
                  },
                ]}
              >
                {refill.alertLevel === 'EMPTY'
                  ? 'Empty — refill before your next shot.'
                  : refill.alertLevel === 'URGENT'
                    ? refill.refillRequested
                      ? 'Refill requested. Pick up soon.'
                      : 'Tap to request a refill.'
                    : refill.alertLevel === 'INFO'
                      ? 'Heads up — running low.'
                      : 'You\u2019re stocked.'}
              </Text>
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function labelDay(day: string): string {
  const map: Record<string, string> = {
    SUNDAY: 'Sunday',
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
  };
  return map[day] ?? 'shot day';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
});
