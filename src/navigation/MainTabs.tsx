import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HeartPulse, House, Settings as SettingsIcon, Syringe, Utensils } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';
import { ProtectedFeature } from '../components/ProtectedFeature';
import { BodyDiagramScreen } from '../screens/Injection/BodyDiagramScreen';
import { FoodLogScreen } from '../screens/Food/FoodLogScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SideEffectLogScreen } from '../screens/SideEffects/SideEffectLogScreen';
import { useTheme } from '../theme/ThemeProvider';

export type MainTabsParamList = {
  Home: undefined;
  Shot: undefined;
  Food: undefined;
  Symptoms: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

function ProtectedShotTab(): React.ReactElement {
  return (
    <ProtectedFeature
      title="Keep logging shots with Pro"
      body="Your trial has ended. Subscribe to keep injection tracking, rotation guidance, and progress calculations active."
    >
      <BodyDiagramScreen />
    </ProtectedFeature>
  );
}

function ProtectedFoodTab(): React.ReactElement {
  return (
    <ProtectedFeature
      title="Keep tracking protein with Pro"
      body="Subscribe to keep protein logging connected to weekly progress, doctor reports, and smart coach reminders."
    >
      <FoodLogScreen />
    </ProtectedFeature>
  );
}

function ProtectedSymptomsTab(): React.ReactElement {
  return (
    <ProtectedFeature
      title="Keep tracking symptoms with Pro"
      body="Subscribe to keep symptom logs connected to weekly insights and your doctor-ready progress report."
    >
      <SideEffectLogScreen />
    </ProtectedFeature>
  );
}

export function MainTabs(): React.ReactElement {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleHairline,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Shot"
        component={ProtectedShotTab}
        options={{
          tabBarIcon: ({ color, size }) => <Syringe color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Food"
        component={ProtectedFoodTab}
        options={{
          tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Symptoms"
        component={ProtectedSymptomsTab}
        options={{
          tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}

const StyleHairline = 0.5;
