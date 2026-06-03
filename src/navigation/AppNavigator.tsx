import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { DoseLadderScreen } from '../screens/Dose/DoseLadderScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { PaywallScreen } from '../screens/Paywall/PaywallScreen';
import { RefillScreen } from '../screens/Refill/RefillScreen';
import { MainTabs, type MainTabsParamList } from './MainTabs';

/**
 * Top-level app stack.
 *
 * `MainTabs` is the root and contains the 5 bottom tabs: Home, Shot, Food,
 * Symptoms, Settings. The remaining screens (DoseLadder, Refill, Paywall)
 * present as bottom-sheet modals over the tab bar — they are infrequent
 * destinations that benefit from staying out of the navigation chrome.
 *
 * Legacy aliases (`Home`, `BodyDiagram`, `SideEffectLog`, `FoodLog`) are
 * intentionally NOT exported here. Screens that need to deep-link into a
 * tab use `navigation.navigate('Shot' | 'Food' | 'Symptoms' | 'Home')` —
 * React Navigation resolves those names to the tab inside `MainTabs`.
 */
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  DoseLadder: undefined;
  Refill: undefined;
  Paywall: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator(): React.ReactElement {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DoseLadder"
        component={DoseLadderScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Refill"
        component={RefillScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}
