import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { configureIap } from './src/iap/iap';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { OnboardingNavigator } from './src/screens/Onboarding/OnboardingNavigator';
import { ShotdayDbProvider, useShotdayDb } from './src/hooks/useShotdayDb';
import { useNotificationSync } from './src/notifications/useNotificationSync';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Root(): React.ReactElement {
  const theme = useTheme();
  const { hydrated, db } = useShotdayDb();
  useNotificationSync();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: theme.mode === 'dark',
        colors: {
          background: theme.colors.bg,
          card: theme.colors.surface,
          text: theme.colors.text,
          primary: theme.colors.primary,
          border: theme.colors.border,
          notification: theme.colors.warning,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      {db.profile.onboardingComplete ? <AppNavigator /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}

function ThemedRoot(): React.ReactElement {
  const { db } = useShotdayDb();
  return (
    <ThemeProvider preference={db.profile.themePreference}>
      {/* ErrorBoundary lives INSIDE ThemeProvider so its fallback UI
          can use theme tokens (`useTheme()`). It still wraps every
          screen render, so any uncaught render error in onboarding,
          home, or modals lands on the friendly recovery screen
          instead of a blank app. */}
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default function App(): React.ReactElement {
  // RevenueCat one-shot configuration. The `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
  // env var is inlined at bundle time by Expo (any `EXPO_PUBLIC_*` literal
  // is replaced with its string value during build). In Expo Go and Jest
  // the var is undefined, and `configureIap` itself is a no-op when the
  // native module isn't available — so this is safe to call unconditionally.
  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    if (key) {
      void configureIap(key);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShotdayDbProvider>
          <ThemedRoot />
          <StatusBar style="auto" />
        </ShotdayDbProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
