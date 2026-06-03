import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HeartPulse, House, Settings as SettingsIcon, Syringe, Utensils } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';
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
        component={BodyDiagramScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Syringe color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Food"
        component={FoodLogScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Symptoms"
        component={SideEffectLogScreen}
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
