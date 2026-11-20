import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
  LinearTransition,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { fromDateKey, monthLabel, toDateKey, todayKey } from "../../lib/format";
import { colors, font, radius } from "../../lib/theme";
import { Button, IconButton } from "./basics";
import PressableScale, { haptic } from "./PressableScale";

// =====================================================================
// Toasts: toast("Expense added") from anywhere
// =====================================================================
const useToasts = create<any>((set) => ({
  items: [],
  push: (item) => set((s) => ({ items: [...s.items.slice(-2), item] })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

let toastId = 0;
export function toast(message, type = "success") {
  const id = ++toastId;
  haptic(type === "error" ? "warning" : type === "success" ? "success" : "light");
  useToasts.getState().push({ id, message, type });
  setTimeout(() => useToasts.getState().remove(id), 2600);
}

export function ToastHost() {
  const items = useToasts((s) => s.items);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + 8 }]}>
      {items.map((t) => (
        <Animated.View
          key={t.id}
          entering={FadeInUp.springify().damping(16)}
          exiting={FadeOutUp.duration(200)}
          layout={LinearTransition.springify()}
          style={styles.toast}
        >
          <Ionicons
            name={
              t.type === "error"
                ? "alert-circle"
                : t.type === "info"
                  ? "information-circle"
                  : "checkmark-circle"
            }
            size={20}
            color={t.type === "error" ? colors.pink : colors.mint}
          />
          <Text style={[font.body, { color: colors.text, flex: 1 }]}>{t.message}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// =====================================================================
// Confirm dialog: if (await confirm({ title, message })) { ... }
// Works on iOS, Android and web (unlike Alert.alert).
// =====================================================================
const useConfirm = create<any>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

export function confirm({
  title,
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  showCancel = true,
}: any) {
  return new Promise<boolean>((resolve) => {
    useConfirm.getState().set({
      title,
      message,
      confirmText,
      cancelText,
      destructive,
      showCancel,
      resolve,
    });
  });
}

// One-button notice
export function notify(title, message = "") {
  return confirm({ title, message, confirmText: "OK", showCancel: false });
}

export function ConfirmHost() {
  const request = useConfirm((s) => s.request);
  const close = (result) => {
    request?.resolve(result);
    useConfirm.getState().set(null);
  };
  return (
    <Modal
      visible={!!request}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}
    >
      <Pressable style={styles.dialogBackdrop} onPress={() => close(false)}>
        {request && (
          <Animated.View entering={ZoomIn.springify().damping(16)}>
            <Pressable style={styles.dialog}>
              <Text style={[font.h2, { color: colors.text, marginBottom: 8 }]}>
                {request.title}
              </Text>
              {request.message ? (
                <Text style={[font.body, { color: colors.textSecondary, lineHeight: 21 }]}>
                  {request.message}
                </Text>
              ) : null}
              <View style={styles.dialogButtons}>
                {request.showCancel && (
                  <Button
                    title={request.cancelText}
                    variant="secondary"
                    onPress={() => close(false)}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title={request.confirmText}
                  variant={request.destructive ? "danger" : "primary"}
                  haptic={request.destructive ? "warning" : "light"}
                  onPress={() => close(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

// =====================================================================
// Bottom sheet
// =====================================================================
export function Sheet({ visible, onClose, title, children, scroll }: any) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.sheetHandle} />
          {title ? (
            <View style={styles.sheetHeader}>
              <Text style={[font.h2, { color: colors.text }]}>{title}</Text>
              <IconButton icon="close" label="Close" size={34} onPress={onClose} />
            </View>
          ) : null}
          {scroll ? (
            <Animated.ScrollView
              style={{ maxHeight: 520 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </Animated.ScrollView>
          ) : (
            children
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Menu of actions in a sheet: [{ label, icon, onPress, destructive }]
export function ActionSheet({ visible, onClose, title, actions = [] }: any) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 8 }}>
        {actions.map((a) => (
          <PressableScale
            key={a.label}
            hapticOnPress="light"
            onPress={() => {
              onClose();
              setTimeout(() => a.onPress(), 250);
            }}
            style={styles.actionRow}
          >
            <View
              style={[
                styles.actionIcon,
                a.destructive && { backgroundColor: colors.pinkSoft },
              ]}
            >
              <Ionicons
                name={a.icon}
                size={19}
                color={a.destructive ? colors.pink : colors.text}
              />
            </View>
            <Text
              style={[
                font.body,
                { color: a.destructive ? colors.pink : colors.text, fontWeight: "600" },
              ]}
            >
              {a.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Sheet>
  );
}

// =====================================================================
// Calendar date picker (pure JS, same look on every platform)
// =====================================================================
export function CalendarSheet({ visible, onClose, value, onChange }: any) {
  const selected = value || todayKey();
  const start = fromDateKey(selected);
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayKey();

  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Date">
      <View style={styles.calHeader}>
        <IconButton icon="chevron-back" label="Previous month" size={34} onPress={() => move(-1)} />
        <Text style={[font.h3, { color: colors.text }]}>{monthLabel(cursor.y, cursor.m)}</Text>
        <IconButton icon="chevron-forward" label="Next month" size={34} onPress={() => move(1)} />
      </View>
      <View style={styles.calGrid}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text key={`h${i}`} style={styles.calDow}>
            {d}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.calCell} />;
          const key = toDateKey(new Date(cursor.y, cursor.m, day));
          const isSelected = key === selected;
          const isToday = key === today;
          return (
            <Pressable
              key={key}
              style={styles.calCell}
              onPress={() => {
                haptic("select");
                onChange(key);
                onClose();
              }}
            >
              <View
                style={[
                  styles.calDay,
                  isToday && { borderColor: colors.mintBorder, borderWidth: 1 },
                  isSelected && { backgroundColor: colors.mint },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.onMint : colors.text,
                    fontWeight: isSelected || isToday ? "800" : "500",
                    fontSize: 15,
                  }}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button
          title="Today"
          variant="secondary"
          size="sm"
          onPress={() => {
            onChange(today);
            onClose();
          }}
        />
        <Button
          title="Yesterday"
          variant="secondary"
          size="sm"
          onPress={() => {
            onChange(toDateKey(new Date(Date.now() - 86400000)));
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: 340,
    maxWidth: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
  },
  dialogButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calDow: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
