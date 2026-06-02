import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  return (
    <ScreenContainer>
      <View style={styles.flex}>
        <View style={styles.hero}>
          <Text style={[theme.typography.hero, { color: theme.colors.text }]}>Shotday</Text>
          <Text
            style={[
              theme.typography.title,
              { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
            ]}
          >
            Your weekly GLP-1 companion
          </Text>
        </View>

        <View style={styles.bullets}>
          {[
            { icon: '◐', title: 'Rotate injection sites', body: 'Auto-suggest the next zone so you never repeat.' },
            { icon: '◔', title: 'Track side effects', body: 'A 20-second log on the days they hit hardest.' },
            { icon: '◑', title: 'Hit your protein target', body: 'Stop muscle loss with a one-tap food log.' },
            { icon: '◕', title: 'Never miss a refill', body: 'Smart alerts based on your remaining doses.' },
          ].map((item) => (
            <View key={item.title} style={[styles.bullet, { marginBottom: theme.spacing.lg }]}>
              <Text style={[styles.icon, { color: theme.colors.primary }]}>{item.icon}</Text>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Text style={[theme.typography.heading, { color: theme.colors.text }]}>{item.title}</Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.sm, lineHeight: 18 },
            ]}
          >
            {NOT_MEDICAL_ADVICE_LONG}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.md },
            ]}
          >
            Everything stays on your phone. No account, no cloud.
          </Text>
          <Button label="Get started" fullWidth size="lg" onPress={() => navigation.navigate('Drug')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'space-between' },
  hero: { paddingTop: 24, alignItems: 'flex-start' },
  bullets: { marginTop: 32 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { fontSize: 32, lineHeight: 32, width: 32 },
  footer: { paddingBottom: 16 },
});
