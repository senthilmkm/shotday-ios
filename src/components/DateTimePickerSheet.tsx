import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

interface BaseProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Initial date that the picker opens at. */
  initialDate: Date;
  /** Called when the user taps Done with the chosen value. */
  onConfirm: (value: Date) => void;
  /** Optional max date — for "Last filled" we don't allow future dates. */
  maximumDate?: Date;
  /** Optional min date. */
  minimumDate?: Date;
}

interface TimeProps extends BaseProps {
  mode: 'time';
}

interface DateProps extends BaseProps {
  mode: 'date';
}

interface DateTimeProps extends BaseProps {
  mode: 'datetime';
}

type Props = TimeProps | DateProps | DateTimeProps;

/**
 * iOS-native time / date picker rendered inside a bottom sheet so we
 * can show a sticky "Done" button. iOS 14+ shows the modern compact
 * picker by default — we force the wheel/spinner display because the
 * compact one doesn't fit nicely inside a sheet without the parent
 * managing its own modal.
 */
export function DateTimePickerSheet(props: Props): React.ReactElement {
  const theme = useTheme();
  const { visible, onClose, title, initialDate, onConfirm, mode, maximumDate, minimumDate } = props;
  const [draft, setDraft] = useState<Date>(initialDate);

  React.useEffect(() => {
    if (visible) setDraft(initialDate);
  }, [visible, initialDate]);

  const handleChange = (_e: DateTimePickerEvent, next?: Date): void => {
    if (next) setDraft(next);
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${title}`}
      />
      <View style={styles.anchor}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              paddingBottom: theme.spacing['2xl'],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.heading,
              { color: theme.colors.text, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
            ]}
          >
            {title}
          </Text>

          <DateTimePicker
            value={draft}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            themeVariant={theme.colors.bg === '#000' ? 'dark' : undefined}
            style={styles.picker}
          />

          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <Button
              label="Done"
              fullWidth
              size="lg"
              onPress={() => {
                onConfirm(draft);
                onClose();
              }}
            />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={onClose}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  anchor: { justifyContent: 'flex-end' },
  sheet: { paddingTop: 8 },
  picker: { alignSelf: 'stretch' },
});
