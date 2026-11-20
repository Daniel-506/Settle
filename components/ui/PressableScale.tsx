import * as Haptics from "expo-haptics";
import { Platform, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { EASE, PRESS } from "../../lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tiny vibration on taps. Silently does nothing on web.
export function haptic(kind = "light") {
  if (Platform.OS === "web") return;
  const done = () => {};
  if (kind === "success")
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(done);
  else if (kind === "warning")
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(done);
  else if (kind === "select") Haptics.selectionAsync().catch(done);
  else
    Haptics.impactAsync(
      kind === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(done);
}

// A Pressable that dips very slightly while you press it.
export default function PressableScale({
  children,
  style,
  onPress,
  scaleTo = PRESS.scale,
  hapticOnPress,
  disabled,
  ...rest
}: any) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={() => {
        scale.set(withTiming(scaleTo, { duration: PRESS.inMs, easing: EASE }));
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: PRESS.outMs, easing: EASE }));
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic(hapticOnPress);
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
