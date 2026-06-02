import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import {
  dayAfterShot,
  daysSinceLastShot,
  daysUntilNext,
} from '../../domain/dateMath';
import { daysUntilEligibleToBump, ladderIdForDrug, nextRung } from '../../domain/dose';
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

type Nav = NativeStackNavigationProp<AppStackParamList>;

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
  const { db } = useShotdayDb();

  const today = useMemo(() => new Date(), []);
  const daysUntilShot = daysUntilNext(db.profile.shotDay, today);
  const isShotDay = daysUntilShot === 0;

  const sinceLast = daysSinceLastShot(db.injections, today);
  const postShotDay = dayAfterShot(db.injections, today);
  const inPostShotWindow = postShotDay !== null;

  const suggested = useMemo(() => suggestNextZone(db.injections), [db.injections]);
  const last = lastUsedZone(db.injections);

  // Top-card priority: post-shot window > shot day > countdown.
  // (Post-shot window has higher priority because the side-effect log is
  // time-sensitive — once you're past 72 hrs the data quality drops.)
  type TopMode = 'POST_SHOT' | 'SHOT_DAY' | 'COUNTDOWN';
  const topMode: TopMode = inPostShotWindow
    ? 'POST_SHOT'
    : isShotDay
      ? 'SHOT_DAY'
      : 'COUNTDOWN';

  const onTopCardPress = (): void => {
    if (topMode === 'POST_SHOT') navigation.navigate('SideEffectLog');
    else navigation.navigate('BodyDiagram');
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

  // Most recent side-effect log today — used to swap the post-shot card subtitle.
  const sideEffectLoggedToday = useMemo(() => {
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    return db.sideEffects.some((s) => new Date(s.loggedAt).getTime() >= startOfDay.getTime());
  }, [db.sideEffects, today]);

  // Dose ladder mini
  const ladder = ladderIdForDrug(db.profile.drug);
  const upcomingRung = nextRung(ladder, db.profile.currentDoseMg);
  const lastRungChange = db.doseHistory[db.doseHistory.length - 1];
  const daysToBump = lastRungChange
    ? daysUntilEligibleToBump(new Date(lastRungChange.startedAt), today)
    : null;

  // Refill
  const refill = useMemo(
    () => refillStatus(db.refill, db.injections, today),
    [db.refill, db.injections, today],
  );

  // Subscription / trial
  const entitlement = computeEntitlement(db.profile, today);
  const trialDays = trialDaysRemaining(db.profile, today);
  const showTrialBanner = shouldShowTrialBanner(db.profile, today);

  // Auto-open the paywall once per session when the trial has expired.
  // We use a ref instead of state so the open-on-launch only fires once
  // per app session even if the user dismisses and re-opens Home, but
  // re-fires on a new launch where they're still EXPIRED.
  const autoPaywallShown = useRef(false);
  useEffect(() => {
    if (entitlement === 'EXPIRED' && !autoPaywallShown.current) {
      autoPaywallShown.current = true;
      // Defer to next tick so the navigator is ready before we push.
      const id = setTimeout(() => navigation.navigate('Paywall'), 50);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [entitlement, navigation]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <View style={styles.headerRow}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            {greeting(today)}
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            accessibilityHint="Opens the settings screen"
            style={({ pressed }) => [
              styles.settingsButton,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: 999,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[theme.typography.bodyMedium, { color: theme.colors.text }]}
              accessible={false}
              importantForAccessibility="no"
            >
              ⚙
            </Text>
          </Pressable>
        </View>

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
                ? 'Update how you feel'
                : 'How are you feeling? Tap to log side effects.'
              : topMode === 'SHOT_DAY'
                ? `It's shot day. Tap to log your injection. Suggested site: ${ZONE_LABEL_SHORT[suggested]}.`
                : `Next shot in ${daysUntilShot} day${daysUntilShot === 1 ? '' : 's'}. Tap to preview the body diagram.`
          }
        >
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
        </Card>

        {/* ─── Protein gauge ──────────────────────────────────── */}
        <Card
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => navigation.navigate('FoodLog')}
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

        {/* ─── Recent injections heatmap ──────────────────────── */}
        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>
            LAST 8 INJECTIONS
          </Text>
          {db.injections.length === 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
              No injections logged yet. Tap the card above on shot day.
            </Text>
          ) : (
            <View style={[styles.dotRow, { marginTop: 12 }]}>
              {db.injections
                .slice(0, 8)
                .reverse()
                .map((inj) => (
                  <View
                    key={inj.id}
                    style={[
                      styles.dot,
                      { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ]}
                  />
                ))}
            </View>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingsButton: {
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
  dotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: 8,
    marginBottom: 8,
  },
});
