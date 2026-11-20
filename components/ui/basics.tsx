import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { initials } from "../../lib/format";
import { colorForId, colors, font, noOutline, paletteFor, radius } from "../../lib/theme";
import PressableScale from "./PressableScale";

// ---------- Button ----------
const BUTTON_VARIANTS = {
  primary: { bg: colors.mint, fg: colors.onMint, border: colors.mint },
  light: { bg: colors.white, fg: colors.onWhite, border: colors.white },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
  ghost: { bg: "transparent", fg: colors.textSecondary, border: "transparent" },
  danger: { bg: colors.pinkSoft, fg: colors.pink, border: colors.pinkBorder },
  mintSoft: { bg: colors.mintSoft, fg: colors.mint, border: colors.mintBorder },
};

export function Button({
  title,
  icon,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  haptic = "light",
}: any) {
  const v = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const small = size === "sm";
  return (
    <PressableScale
      onPress={loading || disabled ? undefined : onPress}
      hapticOnPress={loading || disabled ? undefined : haptic}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: small ? 8 : 15,
          paddingHorizontal: small ? 12 : 18,
          borderRadius: small ? radius.sm : radius.md,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} />
          ) : null}
          {title ? (
            <Text
              style={{
                color: v.fg,
                fontSize: small ? 13 : 16,
                fontWeight: "700",
              }}
            >
              {title}
            </Text>
          ) : null}
        </>
      )}
    </PressableScale>
  );
}

// ---------- Icon button (round) ----------
export function IconButton({ icon, onPress, label, size = 40, tint }: any) {
  return (
    <PressableScale
      onPress={onPress}
      hapticOnPress="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={tint || colors.text} />
    </PressableScale>
  );
}

// ---------- Card ----------
export function Card({ children, style, tone, onPress, ...rest }: any) {
  const toneStyle =
    tone === "mint"
      ? { backgroundColor: colors.mintSoft, borderColor: colors.mintBorder }
      : tone === "pink"
        ? { backgroundColor: colors.pinkSoft, borderColor: colors.pinkBorder }
        : null;
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        style={[styles.card, toneStyle, style]}
        {...rest}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={[styles.card, toneStyle, style]} {...rest}>
      {children}
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ id, name, uri, size = 36, ring }: any) {
  const c = colorForId(id || name || "");
  const [failed, setFailed] = useState(false);
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          ringStyle,
        ]}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.bg,
          alignItems: "center",
          justifyContent: "center",
        },
        ringStyle,
      ]}
    >
      <Text
        style={{ color: c.fg, fontSize: size * 0.38, fontWeight: "700" }}
      >
        {size < 30 ? initials(name).slice(0, 1) : initials(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({ people = [], size = 24, max = 4, ring = colors.surface }: any) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={{ flexDirection: "row", paddingLeft: size * 0.25 }}>
      {shown.map((p) => (
        <View key={p.id} style={{ marginLeft: -size * 0.25 }}>
          <Avatar
            id={p.id}
            name={p.display_name}
            uri={p.avatar_url}
            size={size}
            ring={ring}
          />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            marginLeft: -size * 0.25,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 2,
            borderColor: ring,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: size * 0.36,
              fontWeight: "700",
            }}
          >
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------- Icon tile ----------
export function IconTile({ icon = "receipt", colorKey = "mint", size = 40 }: any) {
  const c = paletteFor(colorKey);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: c.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={`${icon}-outline`} size={size * 0.5} color={c.fg} />
    </View>
  );
}

// ---------- Header ----------
export function Header({ title, onBack, right, subtitle }: any) {
  return (
    <View style={styles.header}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {onBack !== false && (
          <IconButton
            icon="chevron-back"
            label="Back"
            onPress={
              onBack ||
              (() => (router.canGoBack() ? router.back() : router.replace("/")))
            }
          />
        )}
        <View style={{ flex: 1 }}>
          {title ? (
            <Text style={[font.h2, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[font.small, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={{ flexDirection: "row", gap: 8 }}>{right}</View> : null}
    </View>
  );
}

// ---------- Section label ----------
export function SectionLabel({ children, right, style }: any) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={[font.label, { color: colors.textSecondary }]}>{children}</Text>
      {right}
    </View>
  );
}

// ---------- Text field ----------
export function TextField({ label, style, inputStyle, prefix, ...props }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {label ? (
        <Text style={[font.label, { color: colors.textSecondary, marginBottom: 8 }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.mint, backgroundColor: colors.surfaceRaised },
        ]}
      >
        {prefix ? (
          <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "600", marginRight: 4 }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.mint}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.fieldInput, noOutline, inputStyle]}
        />
      </View>
    </View>
  );
}

// ---------- Chip ----------
export function Chip({ label, icon, selected, onPress, left, colorKey }: any) {
  const c = colorKey ? paletteFor(colorKey) : null;
  return (
    <PressableScale
      onPress={onPress}
      hapticOnPress="select"
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.chip,
        selected && {
          backgroundColor: c ? c.bg : colors.mintSoft,
          borderColor: c ? c.fg : colors.mint,
        },
      ]}
    >
      {left}
      {icon ? (
        <Ionicons
          name={`${icon}-outline`}
          size={15}
          color={selected ? (c ? c.fg : colors.mint) : colors.textSecondary}
        />
      ) : null}
      <Text
        style={{
          color: selected ? (c ? c.fg : colors.mint) : colors.text,
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

// ---------- Segmented control with sliding pill ----------
export function Segmented({ options, value, onChange }: any) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width / options.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.set(withSpring(index * segment, { damping: 18, stiffness: 220 }));
  }, [index, segment, x]);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      style={styles.segmented}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
    >
      {width > 0 && (
        <Animated.View style={[styles.segmentPill, { width: segment }, pill]} />
      )}
      {options.map((o) => (
        <PressableScale
          key={o.value}
          onPress={() => onChange(o.value)}
          hapticOnPress="select"
          scaleTo={0.98}
          style={styles.segment}
        >
          <Text
            style={{
              color: o.value === value ? colors.text : colors.textSecondary,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {o.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon = "sparkles", colorKey = "mint", title, body, action }: any) {
  return (
    <Animated.View entering={FadeIn.duration(350)} style={styles.empty}>
      <IconTile icon={icon} colorKey={colorKey} size={56} />
      <Text style={[font.h3, { color: colors.text, marginTop: 14 }]}>{title}</Text>
      {body ? (
        <Text
          style={[
            font.small,
            { color: colors.textSecondary, textAlign: "center", marginTop: 6, maxWidth: 260 },
          ]}
        >
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </Animated.View>
  );
}

// ---------- Skeleton ----------
export function Skeleton({ width = "100%", height = 16, radius: r = 8, style }: any) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.surfaceRaised },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonRows({ count = 3 }: any) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <Skeleton width={40} height={40} radius={13} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={56} height={16} />
        </View>
      ))}
    </View>
  );
}

// ---------- Badge (count dot) ----------
export function CountBadge({ count }: any) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={{ color: colors.onMint, fontSize: 10, fontWeight: "800" }}>
        {count > 9 ? "9+" : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  iconButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfacePressed,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
