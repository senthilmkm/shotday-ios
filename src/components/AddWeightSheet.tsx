import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from './Button';
import { Chip } from './Chip';
import { useTheme } from '../theme/ThemeProvider';
import type { WeightUnit } from '../types/domain';

interface AddWeightSheetProps {
  visible: boolean;
  initialWeight: number;
  initialUnit: WeightUnit;
  onClose: () => void;
  onSave: (weight: number, unit: WeightUnit, note?: string) => void;
}

export function AddWeightSheet({
  visible,
  initialWeight,
  initialUnit,
  onClose,
  onSave,
}: AddWeightSheetProps): React.ReactElement {
  const theme = useTheme();
  const [weightStr, setWeightStr] = useState('');
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setWeightStr(initialWeight > 0 ? String(initialWeight) : '');
    setUnit(initialUnit);
    setNote('');
  }, [initialUnit, initialWeight, visible]);

  const handleSave = (): void => {
    const weight = parseFloat(weightStr);
    if (!Number.isFinite(weight) || weight <= 0) {
      Alert.alert('Invalid weight', 'Enter a positive number.');
      return;
    }
    onSave(weight, unit, note.trim() || undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalRoot}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close add weight"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
            },
          ]}
          accessibilityViewIsModal
        >
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            Add weight
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            Log once per shot cycle so Weekly Progress and Doctor Report can show a real trend.
          </Text>

          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginTop: 20, marginBottom: 8 }]}>
            CURRENT WEIGHT
          </Text>
          <View style={styles.weightRow}>
            <TextInput
              value={weightStr}
              onChangeText={setWeightStr}
              keyboardType="decimal-pad"
              placeholder={unit === 'LB' ? '203.5' : '92.3'}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel="Current weight"
              style={[
                styles.weightInput,
                theme.typography.hero,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
              maxLength={6}
            />
            <View style={styles.unitCol}>
              <Chip label="lb" selected={unit === 'LB'} onPress={() => setUnit('LB')} />
              <Chip label="kg" selected={unit === 'KG'} onPress={() => setUnit('KG')} />
            </View>
          </View>

          <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, marginTop: 18, marginBottom: 8 }]}>
            NOTE OPTIONAL
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Morning weight, doctor office, etc."
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Weight note"
            style={[
              styles.noteInput,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
            maxLength={80}
          />

          <Button label="Save weight" fullWidth size="lg" onPress={handleSave} style={{ marginTop: 18 }} />
          <Button label="Cancel" variant="ghost" fullWidth haptic={false} onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    padding: 20,
    paddingBottom: 28,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 76,
  },
  unitCol: {
    width: 76,
    gap: 8,
  },
  noteInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
});
