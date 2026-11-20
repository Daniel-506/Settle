import type { Session } from "@supabase/supabase-js";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConfirmHost, ToastHost } from "../components/ui";
import { listenForNotificationTaps, registerForPush } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import useStore from "../store/useStore";

// Screens you can be on without being signed in
const PUBLIC_SCREENS = ["login", "reset-password"];
// Links that should still work after you sign in
const LINK_SCREENS = ["join", "friend"];

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const hasProfile = useStore((s) => s.hasProfile);
  const setHasProfile = useStore((s) => s.setHasProfile);
  const setUserId = useStore((s) => s.setUserId);
  const setProfile = useStore((s) => s.setProfile);
  const pendingLink = useStore((s) => s.pendingLink);
  const setPendingLink = useStore((s) => s.setPendingLink);
  const segments = useSegments();
  const screen = segments[0] as string | undefined;
  const userId = session?.user.id;

  // Only record the session here. Calling other supabase methods inside this
  // callback can deadlock the auth client, and token refreshes fire it too.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load the profile once per signed-in user (not on every token refresh)
  useEffect(() => {
    setUserId(userId || null);
    if (!userId) {
      setHasProfile(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setHasProfile(null);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setProfile(data || null);
        setHasProfile(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setHasProfile, setProfile, setUserId]);

  // Push notifications: register this phone once you're fully set up
  useEffect(() => {
    if (userId && hasProfile) registerForPush();
  }, [userId, hasProfile]);

  useEffect(
    () => listenForNotificationTaps((url) => router.push(url)),
    [],
  );

  // Redirect only when you're on the wrong side of the sign-in wall,
  // so being on any other screen is never interrupted.
  useEffect(() => {
    if (!authReady) return;
    // The password reset screen signs you in from the email link itself
    if (screen === "reset-password") return;
    const onLogin = screen === "login";
    const onSetup = screen === "setup-profile";

    if (!userId) {
      if (screen && LINK_SCREENS.includes(screen)) {
        setPendingLink("/" + segments.join("/"));
      }
      if (!onLogin && !PUBLIC_SCREENS.includes(screen || "")) router.replace("/login");
      return;
    }
    if (hasProfile === null) return;
    if (!hasProfile) {
      if (!onSetup) router.replace("/setup-profile");
      return;
    }
    if (onLogin || onSetup) {
      if (pendingLink) {
        setPendingLink(null);
        router.replace(pendingLink);
      } else {
        router.replace("/home");
      }
    }
  }, [authReady, userId, hasProfile, screen, segments, pendingLink, setPendingLink]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="login" options={{ animation: "fade" }} />
          <Stack.Screen name="setup-profile" options={{ animation: "fade" }} />
          <Stack.Screen
            name="add-expense"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="edit-expense"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="new-event"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </View>
      <ToastHost />
      <ConfirmHost />
    </GestureHandlerRootView>
  );
}
