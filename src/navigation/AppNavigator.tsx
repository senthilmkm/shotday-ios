import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { BodyDiagramScreen } from '../screens/Injection/BodyDiagramScreen';
import { DoseLadderScreen } from '../screens/Dose/DoseLadderScreen';
import { FoodLogScreen } from '../screens/Food/FoodLogScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { PaywallScreen } from '../screens/Paywall/PaywallScreen';
import { RefillScreen } from '../screens/Refill/RefillScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SideEffectLogScreen } from '../screens/SideEffects/SideEffectLogScreen';

export type AppStackParamList = {
  Home: undefined;
  BodyDiagram: undefined;
  SideEffectLog: undefined;
  FoodLog: undefined;
  DoseLadder: undefined;
  Refill: undefined;
  Settings: undefined;
  Paywall: undefined;
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
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BodyDiagram"
        component={BodyDiagramScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="SideEffectLog"
        component={SideEffectLogScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="FoodLog"
        component={FoodLogScreen}
        options={{
          presentation: 'modal',
          headerTitle: '',
          animation: 'slide_from_bottom',
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
        name="Settings"
        component={SettingsScreen}
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
    </Stack.Navigator>
  );
}
