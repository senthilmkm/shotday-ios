// Single navigation ref the notification handler can use to deep-link
// from tapped local notifications without dragging React context into
// non-React code.
//
// Usage:
//   <NavigationContainer ref={navigationRef}>...</NavigationContainer>
//   navigateFromNotification('SHOT_REMINDER');

import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

/**
 * Route the user to the appropriate destination for a tapped
 * notification. Defensive about navigation readiness — if the
 * container isn't mounted yet (e.g. cold launch racing the listener)
 * we silently skip; the user lands on Home which is the safe default.
 */
export function navigateFromNotification(category: string): void {
  if (!navigationRef.isReady()) return;
  switch (category) {
    case 'SHOT_REMINDER':
      // The Shot tab already pins the "Log injection" CTA; no need
      // to push anything else.
      navigationRef.navigate('MainTabs', { screen: 'Shot' });
      return;
    case 'SIDE_EFFECT_PROMPT':
      navigationRef.navigate('MainTabs', { screen: 'Symptoms' });
      return;
    case 'REFILL_NUDGE':
      navigationRef.navigate('Refill');
      return;
    default:
      navigationRef.navigate('MainTabs', { screen: 'Home' });
  }
}
