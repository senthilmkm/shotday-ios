import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  HeartPulse,
  Pill,
  Scale,
  Sparkles,
  Syringe,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import type { ConciergeAction, CycleConcierge } from '../domain/cycleConcierge';
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
      accessibilityRole="summary"
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
