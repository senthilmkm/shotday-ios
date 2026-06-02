import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ProgressDots } from '../../components/ProgressDots';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import { useTheme } from '../../theme/ThemeProvider';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

export function NotificationPermissionScreen({}: Props): React.ReactElement {
  const theme = useTheme();
  const { updateDb } = useShotdayDb();
  const [busy, setBusy] = useState(false);

  const completeOnboarding = (): void => {
    updateDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        onboardingComplete: true,
        // Start the 14-day trial clock the moment the user finishes
        // onboarding. Already-set trialStartedAt is preserved (e.g. user
        // re-opened the app mid-onboarding) so resetting requires the
        // explicit Settings → Reset action.
        trialStartedAt: prev.profile.trialStartedAt ?? new Date().toISOString(),
      },
    }));
  };

  const onAllow = async (): Promise<void> => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync().catch(() => {});
    } finally {
      setBusy(false);
      completeOnboarding();
    }
  };

  const onSkip = (): void => {
    completeOnboarding();
  };

  return (
    <ScreenContainer scroll>
      <ProgressDots total={6} current={5} />
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>One last thing.</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Shotday is built around three gentle reminders.
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        {[
          { title: '9 AM on shot day', body: '"Time for your shot. Tap to log a site."' },
          { title: '8 PM the day after', body: '"Quick check — how are you feeling?"' },
          { title: '3 doses left', body: '"Refill time. Pharmacy + reminder."' },
        ].map((item) => (
          <View
            key={item.title}
            style={[
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              },
            ]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
              {item.body}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.lg, textAlign: 'center' },
        ]}
      >
        No promotional pings. Ever.
      </Text>

      <View style={styles.footer}>
        <Button label="Maybe later" variant="ghost" fullWidth haptic={false} onPress={onSkip} />
        <Button
          label="Turn on reminders"
          fullWidth
          size="lg"
          loading={busy}
          onPress={onAllow}
          style={{ marginTop: theme.spacing.sm }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'column' },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
