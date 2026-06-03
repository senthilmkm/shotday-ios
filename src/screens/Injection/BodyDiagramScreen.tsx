import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { DateTimePickerSheet } from '../../components/DateTimePickerSheet';
import { checkDoseSafety, type DoseSafety } from '../../domain/doseSafety';
import { hotZones, lastUsedZone, suggestNextZone } from '../../domain/rotation';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { Injection, InjectionZone } from '../../types/domain';
import { BodyDiagramSvg } from './BodyDiagramSvg';

const ZONE_LABEL: Record<InjectionZone, string> = {
  BELLY_UL: 'Upper-left belly',
  BELLY_UR: 'Upper-right belly',
  BELLY_LL: 'Lower-left belly',
  BELLY_LR: 'Lower-right belly',
  THIGH_L: 'Left thigh',
  THIGH_R: 'Right thigh',
  ARM_L: 'Left arm',
  ARM_R: 'Right arm',
  OTHER: 'Other site',
};

interface BodyDiagramScreenProps {
  /** Optional callback so the home screen can dismiss the modal after logging. */
  onLogged?: () => void;
}

/** How far back can we let users backdate a forgotten log? */
const MAX_BACKDATE_DAYS = 14;

/**
 * Body diagram + injection logger.
 *
 * Layout: SafeAreaView (top edge only — tab bar handles bottom). The body
 * diagram + legend are scrollable in case of very small phones, but the
 * "You selected …" + "Log injection" footer is **pinned above the tab
 * bar** so it's always visible without scrolling. This is the highest-
 * traffic action in the app and the user explicitly asked for it not
 * to be buried.
 *
 * SVG dimensions are computed from screen *height* (not width) so the
 * 1:2-aspect figure fits inside the visible area on most phones.
 *
 * Backdating: the user can tap "Logged earlier?" to record a shot they
 * forgot to log at the time. Without this, a forgotten Sunday log
 * shifts the post-shot window, side-effect days, adherence ring, and
 * refill count by a full day — all of which corrupt downstream data.
 */
export function BodyDiagramScreen({ onLogged }: BodyDiagramScreenProps): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const [pendingZone, setPendingZone] = useState<InjectionZone | null>(null);
  const [takenAt, setTakenAt] = useState<Date>(() => new Date());
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  const window = Dimensions.get('window');
  const svgHeight = Math.min(Math.max(window.height - 360, 340), 500);
  const svgWidth = svgHeight / 2;

  const last = useMemo(() => lastUsedZone(db.injections), [db.injections]);
  const suggested = useMemo(() => suggestNextZone(db.injections), [db.injections]);
  // Zones the user has hit ≥2 times in the last 4 shots — surfaced
  // as a soft warning when they tap into one. Doesn't block the log;
  // the user is the source of truth on what their tissue feels like.
  const hot = useMemo(() => hotZones(db.injections), [db.injections]);
  const isPendingHot = pendingZone !== null && hot.has(pendingZone);

  const zoneStates = useMemo(() => {
    const map: Partial<Record<InjectionZone, { fill: string; stroke: string; pulsing?: boolean }>> = {};
    if (last) {
      map[last] = { fill: theme.colors.zoneStale, stroke: theme.colors.textMuted };
    }
    if (pendingZone) {
      map[pendingZone] = { fill: theme.colors.primary, stroke: theme.colors.primary };
    } else {
      map[suggested] = {
        fill: theme.colors.surface,
        stroke: theme.colors.highlight,
        pulsing: true,
      };
    }
    return map;
  }, [last, suggested, pendingZone, theme]);

  const onZonePress = (zone: InjectionZone): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPendingZone(zone);
  };

  const isBackdated = useMemo(() => {
    const now = new Date();
    // Same calendar day AND within ~5 minutes counts as "now".
    if (sameDay(now, takenAt) && Math.abs(now.getTime() - takenAt.getTime()) < 5 * 60 * 1000) {
      return false;
    }
    return takenAt.getTime() < now.getTime() - 60 * 1000;
  }, [takenAt]);

  /**
   * Append a brand-new injection for the currently selected zone.
   * No safety checks here — callers must have run them first.
   */
  const appendInjection = (catchUp: boolean): void => {
    if (!pendingZone) return;
    const newInjection: Injection = {
      id: `inj-${Date.now()}`,
      takenAt: takenAt.toISOString(),
      zone: pendingZone,
      doseMg: db.profile.currentDoseMg,
    };
    updateDb((prev) => ({
      ...prev,
      injections: [newInjection, ...prev.injections],
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      'Logged',
      catchUp
        ? `${ZONE_LABEL[pendingZone]} on ${formatTakenAt(takenAt)}.`
        : isBackdated
          ? `${ZONE_LABEL[pendingZone]} on ${formatTakenAt(takenAt)}.`
          : `${ZONE_LABEL[pendingZone]} — see you next week.`,
    );
    setPendingZone(null);
    setTakenAt(new Date());
    onLogged?.();
  };

  /**
   * Replace an existing injection (same id) with a new one whose zone +
   * timestamp reflect the user's correction. Keeps the rest of history
   * intact. Used when the safety check returns BLOCK_REPLACE.
   */
  const replaceInjection = (existingId: string): void => {
    if (!pendingZone) return;
    const replacement: Injection = {
      id: existingId,
      takenAt: takenAt.toISOString(),
      zone: pendingZone,
      doseMg: db.profile.currentDoseMg,
    };
    updateDb((prev) => ({
      ...prev,
      injections: prev.injections.map((i) => (i.id === existingId ? replacement : i)),
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Updated', `That shot is now ${ZONE_LABEL[pendingZone]}.`);
    setPendingZone(null);
    setTakenAt(new Date());
    onLogged?.();
  };

  const onLog = (): void => {
    if (!pendingZone) return;
    const safety: DoseSafety = checkDoseSafety(db.injections, takenAt);

    if (safety.kind === 'OK') {
      appendInjection(false);
      return;
    }

    if (safety.kind === 'BLOCK_REPLACE') {
      const existingTime = new Date(safety.existing.takenAt);
      const dayLabel = sameDay(existingTime, new Date())
        ? 'today'
        : `on ${existingTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      const timeStr = existingTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      Alert.alert(
        `Already logged ${dayLabel}`,
        `You logged a ${safety.existing.doseMg} mg shot at ${timeStr}. GLP-1 medications are once-weekly — recording a second on the same day is not recommended.\n\nIf the earlier log was wrong, replace it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace earlier log',
            style: 'destructive',
            onPress: () => replaceInjection(safety.existing.id),
          },
        ],
      );
      return;
    }

    // safety.kind === 'WARN_TOO_SOON'
    const dayLabel = safety.daysAgo === 1 ? '1 day' : `${safety.daysAgo} days`;
    Alert.alert(
      'Too soon since the closest shot?',
      `Closest existing shot is ${dayLabel} away. GLP-1 medications are taken once a week.\n\nOnly continue if this is a catch-up for a missed dose, or you're correcting a wrong-day log. If unsure, talk to your prescriber.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log anyway',
          style: 'destructive',
          onPress: () => appendInjection(true),
        },
      ],
    );
  };

  const minBackdate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - MAX_BACKDATE_DAYS);
    return d;
  }, []);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }]}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Where today?</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.svgWrap}>
          <BodyDiagramSvg
            width={svgWidth}
            height={svgHeight}
            zoneStates={zoneStates}
            idleStyle={{ fill: theme.colors.surface, stroke: theme.colors.border }}
            outline={theme.colors.textMuted}
            body={theme.colors.surface}
            onZonePress={onZonePress}
          />
        </View>
        <View style={styles.legendRow}>
          <Legend color={theme.colors.highlight} label="Suggested" />
          <Legend color={theme.colors.zoneStale} label="Last week" />
          <Legend color={theme.colors.primary} label="Selected" />
        </View>
        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textMuted,
              textAlign: 'center',
              marginTop: 8,
              fontSize: 11,
            },
          ]}
        >
          The figure faces you — your right arm is on the right of the screen.
        </Text>
      </ScrollView>

      {/* Pinned footer — always visible above the tab bar. */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.bg,
            borderTopColor: theme.colors.border,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.selectionPill,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>SELECTED</Text>
          <Text
            style={[
              theme.typography.bodyMedium,
              { color: pendingZone ? theme.colors.text : theme.colors.textMuted, marginTop: 2 },
            ]}
          >
            {pendingZone ? ZONE_LABEL[pendingZone] : 'Tap a zone above'}
          </Text>
          {isPendingHot && (
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.warning,
                  marginTop: 4,
                  fontStyle: 'italic',
                },
              ]}
            >
              You've used this zone a lot lately. Consider a fresh spot to protect your tissue.
            </Text>
          )}
          <View style={styles.timeRow}>
            <Text
              style={[
                theme.typography.caption,
                { color: isBackdated ? theme.colors.warning : theme.colors.textMuted, marginTop: 2 },
              ]}
            >
              {isBackdated ? `Logging for ${formatTakenAt(takenAt)}` : `Logging for now (${formatTakenAt(takenAt)})`}
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isBackdated ? 'Change the recorded time' : 'Log a forgotten shot from earlier'}
            >
              {({ pressed }) => (
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: theme.colors.primary,
                      opacity: pressed ? 0.6 : 1,
                      marginTop: 2,
                    },
                  ]}
                >
                  {isBackdated ? 'Change' : 'Logged earlier?'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
        <Button label="Log injection" fullWidth size="lg" disabled={!pendingZone} onPress={onLog} />
      </View>

      <DateTimePickerSheet
        visible={pickerOpen}
        mode="datetime"
        title="When was this shot?"
        initialDate={takenAt}
        minimumDate={minBackdate}
        maximumDate={new Date()}
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => setTakenAt(d)}
      />
    </SafeAreaView>
  );
}

function Legend({ color, label }: { color: string; label: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: color }]} />
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 6 }]}>{label}</Text>
    </View>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTakenAt(d: Date): string {
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, now)) return `today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, yesterday)) return `yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {},
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
  svgWrap: { alignItems: 'center', marginVertical: 4 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectionPill: {},
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
});
