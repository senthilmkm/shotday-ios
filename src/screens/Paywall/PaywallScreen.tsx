import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import {
  FREE_TRIAL_LABEL,
  MANAGE_SUBSCRIPTIONS_URL,
  PRIVACY_URL,
  SUBSCRIPTION_DISCLOSURE,
  SUBSCRIPTION_TITLE,
  TERMS_URL,
} from '../../copy/subscription';
import {
  computeEntitlement,
  trialDaysRemaining,
} from '../../domain/entitlement';
import { useShotdayDb } from '../../hooks/useShotdayDb';
import {
  fetchProducts,
  isIapAvailable,
  purchaseProduct,
  restorePurchases,
  type SubscriptionProduct,
} from '../../iap/iap';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const BENEFITS = [
  { title: 'Smart site rotation', body: 'Auto-suggest the next zone so you never repeat — protect your tissue.' },
  { title: 'Side-effect timeline', body: 'Spot patterns across doses so you and your doctor can adjust.' },
  { title: 'Protein-first eating', body: 'A daily target tuned to your weight, with one-tap logging.' },
];

export function PaywallScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { db, updateDb } = useShotdayDb();
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const ent = computeEntitlement(db.profile, new Date());
  const trialDays = trialDaysRemaining(db.profile, new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchProducts();
      if (!cancelled) {
        setProducts(list);
        // Default to yearly (better deal) if available, else monthly.
        const yearly = list.find((p) => p.period === 'YEAR');
        setSelectedId(yearly?.id ?? list[0]?.id ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPurchase = async (): Promise<void> => {
    if (!selectedId) return;
    if (!isIapAvailable()) {
      Alert.alert(
        'Subscription unavailable',
        'Purchases require a native development build. In Expo Go you can still test all the features — your trial continues. Use the Settings → Dev Tools toggle to simulate a Pro account.',
      );
      return;
    }
    setPurchasing(true);
    Haptics.selectionAsync().catch(() => {});
    const result = await purchaseProduct(selectedId);
    setPurchasing(false);
    if (result.success && result.proUntil) {
      updateDb((prev) => ({
        ...prev,
        profile: { ...prev.profile, proUntil: result.proUntil },
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Welcome to Pro', 'Thanks for supporting the app.');
      navigation.goBack();
    } else if (result.error !== 'user_cancelled') {
      Alert.alert('Purchase failed', humanizeError(result.error));
    }
  };

  const onRestore = async (): Promise<void> => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success && result.proUntil) {
      updateDb((prev) => ({
        ...prev,
        profile: { ...prev.profile, proUntil: result.proUntil },
      }));
      Alert.alert('Restored', 'Your subscription has been restored.');
      navigation.goBack();
    } else if (result.error === 'unavailable') {
      Alert.alert(
        'Unavailable here',
        'Restore requires a native build. Tap "Continue without subscribing" to keep using the app for now.',
      );
    } else {
      Alert.alert('No active subscription', 'We didn\u2019t find an active subscription on this Apple ID.');
    }
  };

  const openManageSubscriptions = (): void => {
    Linking.openURL(MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
  };

  const openTerms = (): void => {
    Linking.openURL(TERMS_URL).catch(() => {});
  };

  const openPrivacy = (): void => {
    Linking.openURL(PRIVACY_URL).catch(() => {});
  };

  const isLocked = ent === 'EXPIRED';
  const headline =
    ent === 'PRO'
      ? 'You\u2019re Pro'
      : ent === 'TRIAL'
        ? trialDays === 0
          ? 'Trial ends today'
          : `${trialDays} day${trialDays === 1 ? '' : 's'} left in your trial`
        : ent === 'EXPIRED'
          ? 'Trial ended'
          : 'Try Shotday Pro';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
          {SUBSCRIPTION_TITLE.toUpperCase()}
        </Text>
        <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 4 }]}>
          {headline}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 6 }]}>
          {ent === 'EXPIRED'
            ? 'Subscribe to keep your timeline, rotation history, and reminders.'
            : ent === 'PRO'
              ? 'Thanks \u2014 you\u2019re helping keep the app account-free and ad-free.'
              : `Unlock all 5 features for the long haul. ${FREE_TRIAL_LABEL} included.`}
        </Text>

        <View style={{ marginTop: 28 }}>
          {BENEFITS.map((b) => (
            <View
              key={b.title}
              style={[
                styles.benefit,
                { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg },
              ]}
            >
              <Text style={[theme.typography.heading, { color: theme.colors.text }]}>{b.title}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {b.body}
              </Text>
            </View>
          ))}
        </View>

        {ent !== 'PRO' && (
          <>
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.textMuted, marginTop: 32, marginBottom: 12 },
              ]}
            >
              CHOOSE A PLAN
            </Text>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              products.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedId(p.id);
                  }}
                  style={({ pressed }) => [
                    styles.planCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor:
                        selectedId === p.id ? theme.colors.primary : theme.colors.border,
                      borderRadius: theme.radii.lg,
                      borderWidth: selectedId === p.id ? 2 : 1,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
                      {p.title}
                      {p.period === 'YEAR' && (
                        <Text style={[theme.typography.captionMedium, { color: theme.colors.success }]}>
                          {'  · save ~50%'}
                        </Text>
                      )}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                      {p.period === 'YEAR' ? 'Billed annually' : 'Billed monthly'}
                    </Text>
                  </View>
                  <Text style={[theme.typography.heading, { color: theme.colors.primary }]}>
                    {p.priceString}
                  </Text>
                </Pressable>
              ))
            )}

            <Button
              label={purchasing ? 'Processing…' : 'Subscribe'}
              fullWidth
              size="lg"
              loading={purchasing}
              disabled={!selectedId || purchasing}
              onPress={onPurchase}
              style={{ marginTop: 16 }}
            />

            <Pressable onPress={onRestore} disabled={restoring} style={({ pressed }) => [{ marginTop: 16, opacity: pressed ? 0.5 : 1 }]}>
              <Text
                style={[
                  theme.typography.captionMedium,
                  { color: theme.colors.primary, textAlign: 'center' },
                ]}
              >
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
            </Pressable>

            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.textMuted,
                  marginTop: 24,
                  textAlign: 'center',
                  lineHeight: 18,
                },
              ]}
            >
              {SUBSCRIPTION_DISCLOSURE}
            </Text>

            <View style={styles.linkRow}>
              <Pressable
                onPress={openTerms}
                accessibilityRole="link"
                accessibilityLabel="Open Terms of Use in your browser"
                hitSlop={8}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
              >
                <Text
                  style={[
                    theme.typography.captionMedium,
                    { color: theme.colors.primary },
                  ]}
                >
                  Terms of Use
                </Text>
              </Pressable>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, marginHorizontal: 8 },
                ]}
              >
                ·
              </Text>
              <Pressable
                onPress={openPrivacy}
                accessibilityRole="link"
                accessibilityLabel="Open Privacy Policy in your browser"
                hitSlop={8}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
              >
                <Text
                  style={[
                    theme.typography.captionMedium,
                    { color: theme.colors.primary },
                  ]}
                >
                  Privacy Policy
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {ent === 'PRO' && (
          <Pressable onPress={openManageSubscriptions} style={({ pressed }) => [{ marginTop: 12, opacity: pressed ? 0.5 : 1 }]}>
            <Text
              style={[
                theme.typography.captionMedium,
                { color: theme.colors.primary, textAlign: 'center' },
              ]}
            >
              Manage subscription
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/*
       * Always-visible escape hatch.
       *
       *   PRO     → "Done" closes the screen.
       *   TRIAL   → "Continue without subscribing" returns to Home.
       *   EXPIRED → "Not now — keep using read-only history" returns
       *             to Home. We deliberately do NOT hide this link
       *             when the trial has expired: hiding it would
       *             trap the user, which (a) violates App Review
       *             3.1.2 ("auto-renewing subscriptions … must
       *             allow users to cancel"), and (b) tanks our
       *             1-star reviews. Read-only history + the paywall
       *             banner on Home are enough friction.
       */}
      <Button
        label={
          ent === 'PRO'
            ? 'Done'
            : isLocked
              ? 'Not now — keep using read-only history'
              : 'Continue without subscribing'
        }
        variant="ghost"
        fullWidth
        haptic={false}
        onPress={() => navigation.goBack()}
        style={{ margin: theme.spacing.lg, marginTop: 0 }}
      />
    </SafeAreaView>
  );
}

function humanizeError(err: string | null): string {
  if (!err) return 'Something went wrong.';
  if (err === 'unavailable') return 'In-app purchases are unavailable on this device.';
  if (err === 'product_not_found') return 'That plan is temporarily unavailable.';
  if (err === 'no_entitlement') return 'Purchase succeeded but the entitlement didn\u2019t activate. Try Restore.';
  return err;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  benefit: {
    padding: 16,
    marginBottom: 10,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
});
