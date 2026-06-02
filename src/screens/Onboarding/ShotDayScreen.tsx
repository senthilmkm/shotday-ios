import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ProgressDots } from '../../components/ProgressDots';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { DayOfWeek } from '../../types/domain';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShotDay'>;

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
];

export function ShotDayScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const [day, setDay] = useState<DayOfWeek>(db.profile.shotDay ?? 'SUNDAY');

  const onContinue = (): void => {
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, shotDay: day },
    }));
    navigation.navigate('NotificationPermission');
  };

  return (
    <ScreenContainer scroll>
      <ProgressDots total={6} current={4} />
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Which day do you take it?</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Most people pick a low-stress day. We'll remind you each week.
        </Text>
      </View>

      <View style={[styles.row, { marginTop: theme.spacing.xl }]}>
        {DAYS.map((d) => (
          <View key={d.value} style={styles.cell}>
            <Chip label={d.label} selected={day === d.value} onPress={() => setDay(d.value)} large />
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Button label="Continue" fullWidth size="lg" onPress={onContinue} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '30%', flexGrow: 1 },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
