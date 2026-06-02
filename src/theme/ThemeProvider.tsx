import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference } from '../types/domain';
import { darkTheme, lightTheme, type Theme } from './theme';

interface ThemeContextValue {
  theme: Theme;
  /** User's choice — light/dark/auto. Use this for the Settings toggle UI. */
  preference: ThemePreference;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  preference: 'AUTO',
});

interface ThemeProviderProps {
  preference: ThemePreference;
  children: React.ReactNode;
}

export function ThemeProvider({ preference, children }: ThemeProviderProps): React.ReactElement {
  const systemScheme = useColorScheme();

  const theme = useMemo(() => {
    if (preference === 'LIGHT') return lightTheme;
    if (preference === 'DARK') return darkTheme;
    return systemScheme === 'dark' ? darkTheme : lightTheme;
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, preference }), [theme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemePreference(): ThemePreference {
  return useContext(ThemeContext).preference;
}
