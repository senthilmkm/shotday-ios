import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { QuickSetupScreen } from './QuickSetupScreen';
import { WelcomeScreen } from './WelcomeScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  QuickSetup: undefined;
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
      <Stack.Screen name="QuickSetup" component={QuickSetupScreen} />
    </Stack.Navigator>
  );
}
