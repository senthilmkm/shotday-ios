import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ProgressDots } from '../../components/ProgressDots';
import { ScreenContainer } from '../../components/ScreenContainer';
import { proteinTargetGrams } from '../../domain/protein';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { WeightUnit } from '../../types/domain';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Weight'>;

export function WeightScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const [weightStr, setWeightStr] = useState<string>(
    db.profile.weight ? String(db.profile.weight) : '',
  );
  const [unit, setUnit] = useState<WeightUnit>(db.profile.weightUnit ?? 'LB');

  const weight = parseFloat(weightStr);
  const valid = Number.isFinite(weight) && weight > 0;

  let preview = '';
  if (valid) {
    try {
      preview = `≈ ${proteinTargetGrams(weight, unit)} g protein/day`;
    } catch {
      preview = '';
    }
  }

  const onContinue = (): void => {
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, weight, weightUnit: unit },
    }));
    navigation.navigate('ShotDay');
  };

  return (
    <ScreenContainer scroll>
      <ProgressDots total={6} current={3} />
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>What's your weight?</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          We use this only to calculate your daily protein target. It stays on your phone.
        </Text>
      </View>

      <View style={[styles.row, { marginTop: theme.spacing.xl }]}>
        <TextInput
          value={weightStr}
          onChangeText={setWeightStr}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
          accessibilityLabel="Body weight"
          style={[
            styles.input,
            theme.typography.hero,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
          maxLength={4}
        />
        <View style={{ marginLeft: theme.spacing.md }}>
          <View style={[styles.unitRow]}>
            <Chip label="lb" selected={unit === 'LB'} onPress={() => setUnit('LB')} large />
            <View style={{ width: 8 }} />
            <Chip label="kg" selected={unit === 'KG'} onPress={() => setUnit('KG')} large />
          </View>
        </View>
      </View>

      {preview ? (
        <View style={[styles.preview, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md }]}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>{preview}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
            Hitting this target keeps muscle on while you lose fat.
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label="Continue" fullWidth size="lg" disabled={!valid} onPress={onContinue} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 18,
    textAlign: 'center',
  },
  unitRow: { flexDirection: 'row' },
  preview: {
    marginTop: 24,
    padding: 16,
  },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
