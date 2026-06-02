import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { lastUsedZone, suggestNextZone } from '../../domain/rotation';
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

export function BodyDiagramScreen({ onLogged }: BodyDiagramScreenProps): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const [pendingZone, setPendingZone] = useState<InjectionZone | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const svgWidth = Math.min(screenWidth - 32, 320);
  const svgHeight = svgWidth * 2;

  const last = useMemo(() => lastUsedZone(db.injections), [db.injections]);
  const suggested = useMemo(() => suggestNextZone(db.injections), [db.injections]);

  const zoneStates = useMemo(() => {
    const map: Partial<Record<InjectionZone, { fill: string; stroke: string; pulsing?: boolean }>> = {};
    if (last) {
      map[last] = { fill: theme.colors.zoneStale, stroke: theme.colors.textMuted };
    }
    if (pendingZone) {
      map[pendingZone] = { fill: theme.colors.primary, stroke: theme.colors.primary };
    } else {
      // Suggested-next pulsing ring (only when not actively selected).
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

  const onLog = (): void => {
    if (!pendingZone) return;
    const newInjection: Injection = {
      id: `inj-${Date.now()}`,
      takenAt: new Date().toISOString(),
      zone: pendingZone,
      doseMg: db.profile.currentDoseMg,
    };
    updateDb((prev) => ({
      ...prev,
      injections: [newInjection, ...prev.injections],
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Logged', `${ZONE_LABEL[pendingZone]} — see you next week.`);
    setPendingZone(null);
    onLogged?.();
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Where today?</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Pulsing ring = suggested next site. Greyed = last week.
        </Text>
      </View>

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

      <View style={[styles.selection, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md }]}>
        <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted }]}>You selected</Text>
        <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 2 }]}>
          {pendingZone ? ZONE_LABEL[pendingZone] : '—'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Log injection" fullWidth size="lg" disabled={!pendingZone} onPress={onLog} />
      </View>
    </ScreenContainer>
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

const styles = StyleSheet.create({
  header: { marginBottom: 8 },
  svgWrap: { alignItems: 'center', marginVertical: 8 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  selection: { padding: 14 },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
