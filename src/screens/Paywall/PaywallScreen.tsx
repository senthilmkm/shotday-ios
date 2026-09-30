import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
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
import { PRO_PAYWALL_BENEFITS } from '../../domain/proGating';
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
        unavailablePurchaseMessage(ent),
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
        'Restore requires a native build. If you are testing locally, use Settings → Dev Tools to simulate a Pro account.',
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
          : 'Your private GLP-1 coach';
  const description = paywallDescription(ent);
  const purchaseLabel = purchasing ? 'Processing…' : purchaseCtaLabel(ent);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <View style={styles.topHeaderRow}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary, flex: 1 }]}>
            {SUBSCRIPTION_TITLE.toUpperCase()}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close subscription screen"
            style={({ pressed }) => [
              styles.closeIconBtn,
              { backgroundColor: theme.colors.surface, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <X size={18} color={theme.colors.text} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={[theme.typography.hero, { color: theme.colors.text, marginTop: 4 }]}>
          {headline}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 6 }]}>
          {description}
        </Text>

        <View style={{ marginTop: 28 }}>
          {PRO_PAYWALL_BENEFITS.map((b) => (
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
              label={purchaseLabel}
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
       *   EXPIRED → "Not now — keep logging for free" returns to Home.
       *             Shot / Food / Symptoms stay available. We deliberately
       *             do NOT hide this link: trapping the user would violate
       *             App Review 3.1.2 and tank 1-star reviews. Pro extras
       *             stay behind the Home banner and Settings row.
       */}
      <Button
        label={
          ent === 'PRO'
            ? 'Done'
            : isLocked
              ? 'Not now — keep logging for free'
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

function paywallDescription(ent: string): string {
  switch (ent) {
    case 'EXPIRED':
      return 'Logging stays free. Subscribe for Cycle Concierge, doctor reports, milestones, and smart alerts.';
    case 'PRO':
      return 'Thanks. You’re helping keep Shotday private, account-free, and ad-free.';
    case 'TRIAL':
      return 'Shot, food, and symptom logging stay free. Keep coach, doctor reports, smart alerts, and milestones after your trial.';
    default:
      return `Coach, alerts, milestones, and doctor reports. ${FREE_TRIAL_LABEL} included. Logging stays free.`;
  }
}

function purchaseCtaLabel(ent: string): string {
  switch (ent) {
    case 'TRIAL':
      return 'Keep Shotday Pro';
    case 'EXPIRED':
      return 'Subscribe to Shotday Pro';
    default:
      return `Start ${FREE_TRIAL_LABEL}`;
  }
}

function unavailablePurchaseMessage(ent: string): string {
  if (ent === 'EXPIRED') {
    return 'Purchases require a native development build. If you are testing locally, use Settings → Dev Tools to simulate a Pro account.';
  }
  return 'Purchases require a native development build. In Expo Go you can still test all the features while your trial is active. Use the Settings → Dev Tools toggle to simulate a Pro account.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

