import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  HeartPulse,
  Info,
  Pill,
  Scale,
  Sparkles,
  Syringe,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from './Card';
import type { ConciergeAction, CycleConcierge, CycleForecastDay } from '../domain/cycleConcierge';
import { useTheme } from '../theme/ThemeProvider';

interface CycleConciergeCardProps {
  concierge: CycleConcierge;
  onAction: (action: ConciergeAction) => void;
}

const ACTION_ICONS: Record<ConciergeAction['type'], LucideIcon> = {
  SHOT: Syringe,
  WEIGHT: Scale,
  SYMPTOMS: HeartPulse,
  FOOD: Utensils,
  DOSE: Pill,
  REFILL: Pill,
  WEEKLY_PROGRESS: FileText,
  DOCTOR_REPORT: FileText,
  MEDICATION_LEVELS: Activity,
};

export function CycleConciergeCard({
  concierge,
  onAction,
}: CycleConciergeCardProps): React.ReactElement {
  const theme = useTheme();
  const [selectedForecastDay, setSelectedForecastDay] = useState<CycleForecastDay | null>(null);

  const badgeBg =
    concierge.badgeType === 'success'
      ? theme.colors.success + '18'
      : concierge.badgeType === 'warning'
        ? theme.colors.warning + '18'
        : concierge.badgeType === 'info'
          ? theme.colors.primary + '18'
          : theme.colors.primary + '20';

  const badgeColor =
    concierge.badgeType === 'success'
      ? theme.colors.success
      : concierge.badgeType === 'warning'
        ? theme.colors.warning
        : theme.colors.primary;

  const PrimaryIcon = ACTION_ICONS[concierge.primaryAction.type] ?? Sparkles;
  const activeDay = concierge.forecast.find((f) => f.isToday) ?? concierge.forecast[0];
  const displayedDay = selectedForecastDay ?? activeDay;

  return (
    <Card
      style={[
        styles.card,
        {
          borderColor:
            concierge.badgeType === 'warning'
              ? theme.colors.warning + '60'
              : concierge.badgeType === 'success'
                ? theme.colors.success + '40'
                : theme.colors.border,
        },
      ]}
      accessibilityLabel={`${concierge.badgeLabel}. ${concierge.headline}. ${concierge.insight}`}
    >
      {/* ─── Top Badge ───────────────────────────────────── */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeBg,
              borderColor: badgeColor + '40',
            },
          ]}
        >
          <Text style={[theme.typography.captionMedium, { color: badgeColor, fontSize: 11 }]}>
            {concierge.badgeLabel}
          </Text>
        </View>
      </View>

      {/* ─── Headline & Insight ───────────────────────────── */}
      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: 10 }]}>
        {concierge.headline}
      </Text>

      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textMuted, marginTop: 6, lineHeight: 21 },
        ]}
      >
        {concierge.insight}
      </Text>

      {/* ─── 7-Day Cycle Forecast Strip ──────────────────── */}
      {concierge.forecast && concierge.forecast.length === 7 && (
        <View style={[styles.forecastContainer, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
          <View style={styles.forecastHeader}>
            <Text style={[theme.typography.captionMedium, { color: theme.colors.text, fontSize: 11 }]}>
              7-Day GLP-1 Cycle Forecast
            </Text>
            {displayedDay && (
              <Text style={[theme.typography.caption, { color: theme.colors.primary, fontSize: 11, fontWeight: '600' }]}>
                {displayedDay.foodNoiseLabel}
              </Text>
            )}
          </View>

          {/* 7-Day Interactive Pills */}
          <View style={styles.forecastPillsRow}>
            {concierge.forecast.map((fDay) => {
              const isSelected = displayedDay?.dayNumber === fDay.dayNumber;
              const isToday = fDay.isToday;

              return (
                <Pressable
                  key={fDay.dayNumber}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedForecastDay(fDay);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${fDay.dayNumber}: ${fDay.name}, ${fDay.foodNoiseLabel}`}
                  style={({ pressed }) => [
                    styles.dayPill,
                    {
                      backgroundColor: isToday
                        ? theme.colors.primary
                        : isSelected
                          ? theme.colors.primary + '20'
                          : theme.colors.surface,
                      borderColor: isToday
                        ? theme.colors.primary
                        : isSelected
                          ? theme.colors.primary
                          : theme.colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayPillNumber,
                      { color: isToday ? '#FFFFFF' : isSelected ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    D{fDay.dayNumber}
                  </Text>
                  <Text
                    style={[
                      styles.dayPillNoise,
                      { color: isToday ? '#FFFFFFcc' : theme.colors.textMuted },
                    ]}
                  >
                    {fDay.foodNoise === 'SILENT' ? '🤫' : fDay.foodNoise === 'VERY_LOW' ? '⚡' : fDay.foodNoise === 'MODERATE' ? '🌊' : '🍽️'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Selected Day Tip Box */}
          {displayedDay && (
            <View style={styles.forecastTipRow}>
              <Info size={13} color={theme.colors.primary} style={{ marginTop: 2 }} />
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 6, flex: 1, fontSize: 11, lineHeight: 16 }]}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  {displayedDay.name} ({displayedDay.phaseTitle}):{' '}
                </Text>
                {displayedDay.tip}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ─── 3-Step Ritual Checklist (Shot Day Only) ─────── */}
      {concierge.ritualSteps && concierge.ritualSteps.length > 0 && (
        <View
          style={[
            styles.ritualBox,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          {concierge.ritualSteps.map((step, idx) => (
            <View key={idx} style={styles.ritualLine}>
              <CheckCircle2 size={15} color={theme.colors.primary} strokeWidth={2.5} />
              <Text
                style={[
                  theme.typography.captionMedium,
                  { color: theme.colors.text, marginLeft: 8, flex: 1 },
                ]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Primary CTA Button ──────────────────────────── */}
      <Pressable
        onPress={() => onAction(concierge.primaryAction)}
        accessibilityRole="button"
        accessibilityLabel={concierge.primaryAction.label}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor:
              concierge.badgeType === 'warning' ? theme.colors.warning : theme.colors.primary,
            borderRadius: theme.radii.md,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <PrimaryIcon size={17} color="#FFFFFF" strokeWidth={2.2} />
        <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
          {concierge.primaryAction.label}
        </Text>
        <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginLeft: 'auto' }} />
      </Pressable>

      {/* ─── Secondary Action Link ───────────────────────── */}
      {concierge.secondaryAction && (
        <Pressable
          onPress={() => onAction(concierge.secondaryAction!)}
          accessibilityRole="button"
          accessibilityLabel={concierge.secondaryAction.label}
          style={({ pressed }) => [
            styles.secondaryLink,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            {concierge.secondaryAction.label} ›
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  forecastContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  forecastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forecastPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayPillNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayPillNoise: {
    fontSize: 12,
    marginTop: 2,
  },
  forecastTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#88888830',
  },
  ritualBox: {
    padding: 12,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  ritualLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
});

