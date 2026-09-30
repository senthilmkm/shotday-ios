import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ProtectedFeature } from '../components/ProtectedFeature';
import { useTheme } from '../theme/ThemeProvider';
import { DoctorReportScreen } from '../screens/DoctorReport/DoctorReportScreen';
import { DoseLadderScreen } from '../screens/Dose/DoseLadderScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { MedicationLevelScreen } from '../screens/MedicationLevel/MedicationLevelScreen';
import { PaywallScreen } from '../screens/Paywall/PaywallScreen';
import { RefillScreen } from '../screens/Refill/RefillScreen';
import { WeeklyProgressScreen } from '../screens/WeeklyProgress/WeeklyProgressScreen';
import { MainTabs, type MainTabsParamList } from './MainTabs';

/**
 * Top-level app stack.
 *
 * `MainTabs` is the root and contains the 5 bottom tabs: Home, Shot, Food,
 * Symptoms, Settings. The remaining screens (DoseLadder, Refill, Paywall, MedicationLevels)
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
  WeeklyProgress: undefined;
  DoctorReport: undefined;
  Paywall: undefined;
  History: undefined;
  MedicationLevels: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

type Nav = NativeStackNavigationProp<AppStackParamList>;

function ProtectedMedicationLevelScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  return (
    <ProtectedFeature
      title="Unlock estimated medication levels"
      body="Subscribe for GLP-1 level curves, peak/trough timing, and titration tools. Shot logging stays free."
      onClose={() => navigation.goBack()}
    >
      <MedicationLevelScreen />
    </ProtectedFeature>
  );
}

function ProtectedDoctorReportScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  return (
    <ProtectedFeature
      title="Unlock doctor-ready reports"
      body="Subscribe to generate a shareable GLP-1 summary. Shot, food, and symptom logging stay free."
      onClose={() => navigation.goBack()}
    >
      <DoctorReportScreen />
    </ProtectedFeature>
  );
}

function ProtectedWeeklyProgressScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  return (
    <ProtectedFeature
      title="Unlock weekly milestones"
      body="Subscribe for progress score, weight milestones, and weekly rhythm. Shot, food, and symptom logging stay free."
      onClose={() => navigation.goBack()}
    >
      <WeeklyProgressScreen />
    </ProtectedFeature>
  );
}

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
        name="MedicationLevels"
        component={ProtectedMedicationLevelScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
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
        name="DoctorReport"
        component={ProtectedDoctorReportScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="WeeklyProgress"
        component={ProtectedWeeklyProgressScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
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
