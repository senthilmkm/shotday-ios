import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ProgressDots } from '../../components/ProgressDots';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { DrugFamily } from '../../types/domain';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Drug'>;

const DRUG_OPTIONS: { value: DrugFamily; label: string }[] = [
  { value: 'OZEMPIC', label: 'Ozempic' },
  { value: 'WEGOVY', label: 'Wegovy' },
  { value: 'MOUNJARO', label: 'Mounjaro' },
  { value: 'ZEPBOUND', label: 'Zepbound' },
  { value: 'OTHER', label: 'Something else' },
];

export function DrugScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();
  const { db, updateDb } = useShotdayDb();
  const [selected, setSelected] = useState<DrugFamily>(db.profile.drug ?? 'OZEMPIC');
  const [customName, setCustomName] = useState(db.profile.customDrugName ?? '');

  const canContinue = selected !== 'OTHER' || customName.trim().length > 0;

  const onContinue = (): void => {
    updateDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        drug: selected,
        customDrugName: selected === 'OTHER' ? customName.trim() : undefined,
      },
    }));
    navigation.navigate('Dose');
  };

  return (
    <ScreenContainer scroll>
      <ProgressDots total={6} current={1} />
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>What are you taking?</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Don't see yours? Tap "Something else".
        </Text>
      </View>

      <View style={[styles.chipRow, { marginTop: theme.spacing.xl }]}>
        {DRUG_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={selected === opt.value}
            onPress={() => setSelected(opt.value)}
            large
          />
        ))}
      </View>

      {selected === 'OTHER' && (
        <View style={{ marginTop: theme.spacing.xl }}>
          <Text
            style={[
              theme.typography.captionMedium,
              { color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
            ]}
          >
            Drug name
          </Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Compounded semaglutide"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Drug name"
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Button label="Continue" fullWidth size="lg" disabled={!canContinue} onPress={onContinue} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
