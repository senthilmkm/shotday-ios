import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { clearDb, type KeyValueStore } from '../storage/storage';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

const asyncStorageStore: KeyValueStore = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global error boundary. Catches uncaught render errors anywhere in the
 * tree and shows a friendly recovery screen with two options:
 *   - Try again (re-render)
 *   - Reset all data (last-resort if a corrupt state caused the crash)
 *
 * Apple App Review explicitly rejects apps that show a blank/white screen
 * after a crash. This component is the safety net.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[shotday] uncaught render error', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  resetAllData = async (): Promise<void> => {
    try {
      await clearDb(asyncStorageStore);
    } catch {
      // Even if the wipe failed, still reset the boundary so the user can try again.
    }
    this.reset();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback error={this.state.error} onRetry={this.reset} onReset={this.resetAllData} />;
    }
    return this.props.children;
  }
}

interface FallbackProps {
  error: Error | null;
  onRetry: () => void;
  onReset: () => void;
}

function ErrorBoundaryFallback({ error, onRetry, onReset }: FallbackProps): React.ReactElement {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.container}
    >
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>Something went wrong</Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textMuted, marginTop: 12, lineHeight: 22 },
        ]}
      >
        Shotday hit an unexpected error. Your data is safe on your device. You can try again — if the
        error keeps coming back, resetting your data will fix it (this wipes onboarding, injections,
        side effects, foods, dose history, and refill data).
      </Text>

      {__DEV__ && error && (
        <View
          style={[
            styles.debugBox,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text style={[theme.typography.captionMedium, { color: theme.colors.danger }]}>
            DEV: {error.name}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text, marginTop: 4 },
            ]}
            selectable
          >
            {error.message}
          </Text>
        </View>
      )}

      <Button label="Try again" fullWidth size="lg" onPress={onRetry} style={{ marginTop: 24 }} />
      <Button
        label="Reset all data"
        variant="ghost"
        fullWidth
        haptic={false}
        onPress={onReset}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 80,
  },
  debugBox: {
    marginTop: 24,
    padding: 14,
  },
});
