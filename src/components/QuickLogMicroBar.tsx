import { Droplet, HeartPulse, Plus, Utensils } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

interface QuickLogMicroBarProps {
  onAddWaterOz: (oz: number) => void;
  onAddProteinGrams: (grams: number) => void;
  onOpenSymptoms: () => void;
}

export function QuickLogMicroBar({
  onAddWaterOz,
  onAddProteinGrams,
  onOpenSymptoms,
}: QuickLogMicroBarProps): React.ReactElement {
  const theme = useTheme();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1800);
  };

  const handleWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onAddWaterOz(8);
    triggerToast('+8 oz water logged! 💧');
  };

  const handleProtein = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onAddProteinGrams(25);
    triggerToast('+25g protein logged! 🥩');
  };

  const handleSymptoms = () => {
    Haptics.selectionAsync().catch(() => {});
    onOpenSymptoms();
  };

  return (
    <View style={styles.wrapper}>
      {toastMessage && (
        <View style={[styles.toastPill, { backgroundColor: theme.colors.primary }]}>
          <Text style={[theme.typography.captionMedium, { color: '#FFFFFF', fontSize: 11 }]}>
            {toastMessage}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        {/* Quick Water Button */}
        <Pressable
          onPress={handleWater}
          accessibilityRole="button"
          accessibilityLabel="Quick log 8 ounces of water"
          style={({ pressed }) => [
            styles.microBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Droplet size={14} color="#06B6D4" strokeWidth={2.5} />
          <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 5, fontSize: 11 }]}>
            +8 oz Water
          </Text>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Quick Protein Button */}
        <Pressable
          onPress={handleProtein}
          accessibilityRole="button"
          accessibilityLabel="Quick log 25 grams of protein"
          style={({ pressed }) => [
            styles.microBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Utensils size={14} color="#10B981" strokeWidth={2.5} />
          <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 5, fontSize: 11 }]}>
            +25g Protein
          </Text>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Quick Symptoms Check-in */}
        <Pressable
          onPress={handleSymptoms}
          accessibilityRole="button"
          accessibilityLabel="Open 30 second symptom check-in"
          style={({ pressed }) => [
            styles.microBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <HeartPulse size={14} color="#EC4899" strokeWidth={2.5} />
          <Text style={[theme.typography.captionMedium, { color: theme.colors.text, marginLeft: 5, fontSize: 11 }]}>
            Check-in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    position: 'relative',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  microBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  divider: {
    width: 1,
    height: 18,
  },
  toastPill: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
