import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, Flame, HeartPulse, ShieldCheck, Syringe, Utensils } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { NOT_MEDICAL_ADVICE_LONG } from '../../copy/disclaimers';
import { useTheme } from '../../theme/ThemeProvider';
import type { OnboardingStackParamList } from './OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();

  const features = [
    {
      Icon: Syringe,
      iconColor: theme.colors.primary,
      title: 'Rotate injection sites',
      body: 'Smart body map suggests your next fresh spot so you avoid tissue build-up.',
    },
    {
      Icon: HeartPulse,
      iconColor: '#EC4899',
      title: '20-second symptom check-ins',
      body: 'Quickly log how you feel on the days medication peaks in your system.',
    },
    {
      Icon: Utensils,
      iconColor: '#10B981',
      title: 'Protein & hydration targets',
      body: '1-tap habit logging to protect lean muscle mass and stay energized.',
    },
    {
      Icon: Bell,
      iconColor: '#F59E0B',
      title: 'Cycle & refill smart alerts',
      body: 'Get timely reminders for your shot day and pharmacy refill windows.',
    },
  ];

  return (
    <ScreenContainer>
      <View style={styles.flex}>
        <View style={styles.hero}>
          <View style={[styles.brandPill, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}>
            <Flame size={14} color={theme.colors.primary} />
            <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, marginLeft: 6 }]}>
              SHOTDAY · GLP-1 COMPANION
            </Text>
          </View>

          <Text style={[theme.typography.hero, { color: theme.colors.text, fontSize: 32, marginTop: 12 }]}>
            Your Weekly GLP-1 Companion
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textMuted, marginTop: theme.spacing.xs, lineHeight: 22 },
            ]}
          >
            Track your injections, active medication levels, and milestones with zero guesswork.
          </Text>
        </View>

        <View style={styles.bullets}>
          {features.map((item) => (
            <View key={item.title} style={[styles.bullet, { marginBottom: theme.spacing.lg }]}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <item.Icon size={18} color={item.iconColor} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md, justifyContent: 'center' }}>
                <Text style={[theme.typography.heading, { color: theme.colors.text, fontSize: 15 }]}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textMuted, marginTop: 2, lineHeight: 18 },
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.privacyRow}>
            <ShieldCheck size={14} color={theme.colors.success} />
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginLeft: 6 },
              ]}
            >
              100% On-Device · No accounts · Total privacy
            </Text>
          </View>

          <Button
            label="Get Started (45s setup)"
            fullWidth
            size="lg"
            onPress={() => navigation.navigate('QuickSetup')}
          />

          <Text
            style={[
              theme.typography.caption,
              {
                color: theme.colors.textMuted,
                textAlign: 'center',
                marginTop: theme.spacing.md,
                lineHeight: 15,
                fontSize: 10,
              },
            ]}
          >
            {NOT_MEDICAL_ADVICE_LONG}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'space-between' },
  hero: { paddingTop: 20, alignItems: 'flex-start' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  bullets: { marginTop: 24 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingBottom: 16 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});
