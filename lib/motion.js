// One calm set of animations for the whole app: short fades and slides with
// a smooth ease-out. No springs, no bounce, no staggered cascades.
import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
} from "react-native-reanimated";

export const EASE = Easing.out(Easing.cubic);

// Content appearing
export const enter = FadeIn.duration(180);
// Content leaving
export const exit = FadeOut.duration(120);
// Items moving when the list around them changes
export const layoutShift = LinearTransition.duration(180).easing(EASE);
// Bottom sheets sliding up
export const sheetIn = SlideInDown.duration(260).easing(EASE);

// Buttons and cards dip very slightly while pressed
export const PRESS = { scale: 0.98, inMs: 90, outMs: 140 };
