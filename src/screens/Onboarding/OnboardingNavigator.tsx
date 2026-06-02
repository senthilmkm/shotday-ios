import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { DoseScreen } from './DoseScreen';
import { DrugScreen } from './DrugScreen';
import { NotificationPermissionScreen } from './NotificationPermissionScreen';
import { ShotDayScreen } from './ShotDayScreen';
import { WeightScreen } from './WeightScreen';
import { WelcomeScreen } from './WelcomeScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Drug: undefined;
  Dose: undefined;
  Weight: undefined;
  ShotDay: undefined;
  NotificationPermission: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator(): React.ReactElement {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Drug" component={DrugScreen} />
      <Stack.Screen name="Dose" component={DoseScreen} />
      <Stack.Screen name="Weight" component={WeightScreen} />
      <Stack.Screen name="ShotDay" component={ShotDayScreen} />
      <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
    </Stack.Navigator>
  );
}
