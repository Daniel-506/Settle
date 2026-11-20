import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const TOKEN_KEY = "settle.push.token";
const DISABLED_KEY = "settle.push.disabled";
const supported = Platform.OS !== "web";

if (supported) {
  // Show banners even while the app is open
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// "granted" | "denied" | "undetermined" | "off" (turned off in Settle) | "unsupported"
export async function notificationStatus() {
  if (!supported) return "unsupported";
  try {
    if ((await AsyncStorage.getItem(DISABLED_KEY)) === "1") return "off";
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return "unsupported";
  }
}

// The in-app switch on the Profile tab
export async function setPushDisabled(disabled) {
  try {
    if (disabled) await AsyncStorage.setItem(DISABLED_KEY, "1");
    else await AsyncStorage.removeItem(DISABLED_KEY);
  } catch {}
}

// Asks for permission (once) and saves this phone's push token for the
// signed-in user. Safe to call on every launch.
export async function registerForPush({ ask = true } = {}) {
  if (!supported || !Device.isDevice) return null;
  try {
    if ((await AsyncStorage.getItem(DISABLED_KEY)) === "1") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Settle",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc("register_push_token", {
      p_token: token,
      p_platform: Platform.OS,
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    // e.g. running in Expo Go on Android, which no longer supports push
    console.warn("Push registration skipped:", e?.message);
    return null;
  }
}

// Call before signing out so the old account stops getting this phone's alerts
export async function unregisterPush() {
  if (!supported) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await supabase.rpc("unregister_push_token", { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// Tapping a notification opens the screen it's about (data.url)
export function listenForNotificationTaps(open) {
  if (!supported) return () => {};
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const url = response?.notification.request.content.data?.url;
      if (url) open(url);
    })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (url) open(url);
  });
  return () => sub.remove();
}
