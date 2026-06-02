import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area-aware page wrapper used by every full screen. */
export function ScreenContainer({ children, scroll = false, contentStyle }: ScreenContainerProps): React.ReactElement {
  const theme = useTheme();

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { padding: theme.spacing.lg }, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { padding: theme.spacing.lg }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
