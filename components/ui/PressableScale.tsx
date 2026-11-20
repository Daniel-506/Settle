import * as Haptics from "expo-haptics";
import { Platform, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

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

// A Pressable that springs down slightly while you press it.
export default function PressableScale({
  children,
  style,
  onPress,
  scaleTo = 0.97,
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
        scale.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
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
