import {
  Download,
  FileText,
  HeartPulse,
  Pill,
  Scale,
  Settings,
  Syringe,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SmartAlert, SmartAlertAction, SmartAlertIcon } from '../domain/smartAlerts';
import { useTheme } from '../theme/ThemeProvider';

interface SmartAlertsSheetProps {
  visible: boolean;
  alerts: SmartAlert[];
  onClose: () => void;
  onAction: (action: SmartAlertAction) => void;
}

const ICONS: Record<SmartAlertIcon, LucideIcon> = {
  settings: Settings,
  syringe: Syringe,
  scale: Scale,
  heart: HeartPulse,
  utensils: Utensils,
  pill: Pill,
  file: FileText,
  download: Download,
};

export function SmartAlertsSheet({
  visible,
  alerts,
  onClose,
  onAction,
}: SmartAlertsSheetProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close alerts"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.title, { color: theme.colors.text }]}>
                Smart alerts
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Helpful prompts for accurate progress and doctor reports.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close smart alerts"
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <X size={18} color={theme.colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            {alerts.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.lg,
                  },
                ]}
              >
                <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
                  No alerts right now
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
                  Shotday has the basics it needs for this cycle.
                </Text>
              </View>
            ) : (
              alerts.map((alert) => (
                <View
                  key={alert.id}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: alert.read ? theme.colors.border : theme.colors.primary,
                      borderRadius: theme.radii.lg,
                    },
                  ]}
                >
                  <View style={styles.alertTitleRow}>
                    <Text style={[theme.typography.heading, { color: theme.colors.text, flex: 1 }]}>
                      {alert.title}
                    </Text>
                    {!alert.read && (
                      <View
                        style={[
                          styles.unreadDot,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
                    {alert.detail}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.text, marginTop: 8, lineHeight: 18 }]}>
                    {alert.why}
                  </Text>
                  {alert.action && (
                    <ActionChip
                      icon={alert.action.icon}
                      label={alert.action.label}
                      onPress={() => onAction(alert.action!.type)}
                    />
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: SmartAlertIcon;
  label: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const Icon = ICONS[icon];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionChip,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.full,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon size={14} color={theme.colors.primary} strokeWidth={2.2} />
      <Text style={[theme.typography.captionMedium, { color: theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  sheet: {
    maxHeight: '86%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyCard: {
    borderWidth: 1,
    padding: 16,
  },
  alertCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  actionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 12,
  },
});
