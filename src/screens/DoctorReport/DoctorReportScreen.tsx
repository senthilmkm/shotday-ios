import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { buildDoctorReport, buildDoctorReportText } from '../../domain/doctorReport';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList, 'DoctorReport'>;

const INCLUDED = [
  'Current drug + dose',
  'Injection history',
  'Missed / late shots',
  'Side effects by week',
  'Weight trend',
  'Protein trend',
  'Refill history',
];

export function DoctorReportScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db } = useShotdayDb();
  const [notes, setNotes] = useState('');

  const report = useMemo(() => buildDoctorReport(db, new Date(), notes), [db, notes]);
  const proteinHits = report.proteinTrend.days.filter((day) => day.hitTarget === true).length;

  const onShare = async (): Promise<void> => {
    try {
      Haptics.selectionAsync().catch(() => {});
      const freshReport = buildDoctorReport(db, new Date(), notes);
      await Share.share({
        title: 'Shotday Doctor Report',
        message: buildDoctorReportText(freshReport),
      });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            Doctor report
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            Add notes, then share a clean GLP-1 progress summary.
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close doctor report"
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
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            REPORT INCLUDES
          </Text>
          <View style={{ marginTop: 10 }}>
            {INCLUDED.map((item) => (
              <Text key={item} style={[theme.typography.caption, { color: theme.colors.text, marginTop: 4 }]}>
                ✓ {item}
              </Text>
            ))}
          </View>
        </Card>

        <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginBottom: 8 }]}>
          NOTES FOR YOUR DOCTOR
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="Add questions, symptoms, concerns, or dose changes you want to discuss."
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel="Notes for your doctor"
          style={[
            styles.notesInput,
            theme.typography.body,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        />

        <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginTop: 24, marginBottom: 8 }]}>
          QUICK PREVIEW
        </Text>
        <Card>
          <PreviewRow
            label="Medication"
            value={`${report.currentMedication.drug || 'Not set'} · ${report.currentMedication.doseLabel || 'Dose not set'}`}
          />
          <PreviewRow label="Injections" value={`${report.injectionHistory.length} in last 90 days`} />
          <PreviewRow
            label="Missed / late"
            value={
              report.missedLateShots.length === 0
                ? 'None detected'
                : `${report.missedLateShots.length} item${report.missedLateShots.length === 1 ? '' : 's'}`
            }
          />
          <PreviewRow
            label="Symptoms"
            value={
              report.sideEffectsByWeek.length === 0
                ? 'No check-ins yet'
                : `${report.sideEffectsByWeek.length} week${report.sideEffectsByWeek.length === 1 ? '' : 's'} summarized`
            }
          />
          <PreviewRow
            label="Weight"
            value={
              report.weightTrend.change === null
                ? 'Add 2 weights to show trend'
                : `${report.weightTrend.change > 0 ? '+' : ''}${report.weightTrend.change} ${report.weightTrend.unit}`
            }
          />
          <PreviewRow
            label="Protein"
            value={
              report.proteinTrend.targetG === null
                ? 'Weight needed for target'
                : `${proteinHits} of ${report.proteinTrend.days.length} days hit target`
            }
          />
          <PreviewRow label="Refills" value={`${report.refillHistory.length} event${report.refillHistory.length === 1 ? '' : 's'}`} last />
        </Card>

        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 16, lineHeight: 18 }]}>
          Shotday is a tracking tool, not medical advice. Review this report with your prescriber before making medication changes.
        </Text>
      </ScrollView>

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
        <Button
          label="Share doctor report"
          fullWidth
          size="lg"
          onPress={onShare}
        />
      </View>
    </SafeAreaView>
  );
}

function PreviewRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.previewRow,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[theme.typography.captionMedium, { color: theme.colors.text, flex: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );
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
  notesInput: {
    minHeight: 132,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
