// Color tokens, typography, spacing, radii, shadows.
// Light + dark variants share a single key set so consumers never branch.
//
// Design philosophy: medical-grade calm. Dark teal for "shot day" so the
// app feels professional rather than gym-bro neon. Generous spacing,
// SF-style typography, soft shadows.

export const palette = {
  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  grey50: '#F8FAFC',
  grey100: '#F1F5F9',
  grey200: '#E2E8F0',
  grey300: '#CBD5E1',
  grey400: '#94A3B8',
  grey500: '#64748B',
  grey700: '#334155',
  grey800: '#1E293B',
  grey900: '#0F172A',

  // Brand teal — medical, calm, not over-saturated.
  teal500: '#0E9F8E',
  teal600: '#0B8276',
  teal100: '#CCEEEA',
  teal900: '#053C36',

  // Semantic
  amber500: '#F59E0B',
  red500: '#EF4444',
  green500: '#10B981',
} as const;

export interface ThemeColors {
  /** Page background. */
  bg: string;
  /** Card / surface background. */
  surface: string;
  /** Subtle muted surface (e.g. dim card behind primary card). */
  surfaceMuted: string;
  /** Primary brand color (tealable). */
  primary: string;
  /** Text on primary surface (white in both modes since teal is dark enough). */
  onPrimary: string;
  /** Primary text. */
  text: string;
  /** Secondary / muted text. */
  textMuted: string;
  /** Hairline divider. */
  border: string;
  /** Used for warning callouts (refill, side-effect alerts). */
  warning: string;
  /** Used for success states. */
  success: string;
  /** Used for danger / heavy side-effect callouts. */
  danger: string;
  /** Used for the body-diagram suggested-next pulsing ring. */
  highlight: string;
  /** Greyed-out injection zones (last week's site). */
  zoneStale: string;
}

export type ThemeMode = 'light' | 'dark';

export const lightColors: ThemeColors = {
  bg: palette.grey50,
  surface: palette.white,
  surfaceMuted: palette.grey100,
  primary: palette.teal500,
  onPrimary: palette.white,
  text: palette.grey900,
  textMuted: palette.grey500,
  border: palette.grey200,
  warning: palette.amber500,
  success: palette.green500,
  danger: palette.red500,
  highlight: palette.teal500,
  zoneStale: palette.grey300,
};

export const darkColors: ThemeColors = {
  bg: palette.grey900,
  surface: palette.grey800,
  surfaceMuted: palette.grey700,
  primary: palette.teal500,
  onPrimary: palette.white,
  text: palette.grey50,
  textMuted: palette.grey400,
  border: palette.grey700,
  warning: palette.amber500,
  success: palette.green500,
  danger: palette.red500,
  highlight: palette.teal500,
  zoneStale: palette.grey700,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  // Sizes are RN-flat (no em); we rely on system font for that native feel.
  hero: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  title: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
} as const;

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  radii,
  typography,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  radii,
  typography,
};
