import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ProgressDots } from '../../components/ProgressDots';
import { ScreenContainer } from '../../components/ScreenContainer';
import { rungsForDrug } from '../../domain/dose';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Dose'>;

export function DoseScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const drug = db.profile.drug;
  const rungs = rungsForDrug(drug);
  const isCustom = rungs.length === 0;

  const [selectedMg, setSelectedMg] = useState<number>(db.profile.currentDoseMg ?? 0);
  const [selectedLabel, setSelectedLabel] = useState<string>(db.profile.currentDoseLabel ?? '');
  const [customMg, setCustomMg] = useState<string>(
    db.profile.currentDoseMg ? String(db.profile.currentDoseMg) : '',
  );

  const onSelectRung = (mg: number, label: string): void => {
    setSelectedMg(mg);
    setSelectedLabel(label);
  };

  const onSkip = (): void => {
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, currentDoseMg: 0, currentDoseLabel: '' },
    }));
    navigation.navigate('Weight');
  };

  const customMgNum = parseFloat(customMg);
  const customValid = !isCustom || (Number.isFinite(customMgNum) && customMgNum > 0);
  const canContinue = isCustom ? customValid : selectedMg > 0;

  const onContinue = (): void => {
    const mg = isCustom ? customMgNum : selectedMg;
    const label = isCustom ? `${customMgNum} mg` : selectedLabel;
    updateDb((prev) => ({
      ...prev,
      profile: { ...prev.profile, currentDoseMg: mg, currentDoseLabel: label },
      doseHistory: [
        ...prev.doseHistory,
        {
          id: `dose-${Date.now()}`,
          startedAt: new Date().toISOString(),
          label,
          mg,
        },
      ],
    }));
    navigation.navigate('Weight');
  };

  return (
    <ScreenContainer scroll>
      <ProgressDots total={6} current={2} />
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>What dose are you on?</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          {isCustom
            ? 'Enter your current dose in milligrams.'
            : 'Pick the dose you take each week. You can change this later.'}
        </Text>
      </View>

      {isCustom ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <TextInput
            value={customMg}
            onChangeText={setCustomMg}
            placeholder="e.g. 0.5"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel="Current dose in milligrams"
            style={[
              styles.input,
              theme.typography.title,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
          />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
            milligrams (mg)
          </Text>
        </View>
      ) : (
        <View style={[styles.chipRow, { marginTop: theme.spacing.xl }]}>
          {rungs.map((r) => (
            <Chip
              key={r.label}
              label={r.label}
              selected={selectedMg === r.mg}
              onPress={() => onSelectRung(r.mg, r.label)}
              large
            />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Button
          label="I don't know — skip for now"
          variant="ghost"
          fullWidth
          haptic={false}
          onPress={onSkip}
        />
        <Button
          label="Continue"
          fullWidth
          size="lg"
          disabled={!canContinue}
          onPress={onContinue}
          style={{ marginTop: theme.spacing.sm }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 18,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
