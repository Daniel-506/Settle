import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HexLogo from "../components/HexLogo";
import { Button, PressableScale, Segmented, TextField, notify } from "../components/ui";
import {
  appleSignInAvailable,
  completeSignInFromUrl,
  signInWithApple,
  signInWithGoogle,
} from "../lib/oauth";
import { supabase } from "../lib/supabase";
import { colors, font, radius } from "../lib/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(null); // "email" | "apple" | "google"
  const [error, setError] = useState("");
  const [appleOk, setAppleOk] = useState(false);

  useEffect(() => {
    appleSignInAvailable().then(setAppleOk);
  }, []);

  // Coming back from Google sign-in in a browser (web)
  useEffect(() => {
    if (url && /access_token|code=/.test(url)) {
      completeSignInFromUrl(url).catch((e) => setError(e.message));
    }
  }, [url]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading("email");
    setError("");
    if (mode === "login") {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) {
        setError(
          /invalid|credentials/i.test(e.message)
            ? "Wrong email or password. Check them or create an account."
            : e.message,
        );
      }
    } else {
      if (password.length < 6) {
        setLoading(null);
        setError("Use at least 6 characters for your password.");
        return;
      }
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: Linking.createURL("/login") },
      });
      if (e) setError(e.message);
      else if (!data.session) {
        notify("Check your email", `Tap the link we sent to ${email.trim()} to confirm your account, then log in.`);
        setMode("login");
      }
    }
    setLoading(null);
  };

  const social = async (provider) => {
    setLoading(provider);
    setError("");
    try {
      if (provider === "apple") await signInWithApple();
      else await signInWithGoogle();
    } catch (e) {
      setError(e.message || "Sign-in didn't work. Try again.");
    } finally {
      setLoading(null);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }
    // Without redirectTo, Supabase sends people to its default Site URL
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL("/reset-password"),
    });
    if (e) setError(e.message);
    else notify("Check your email", `We sent a password reset link to ${email.trim()}.`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.springify().damping(16)} style={styles.brand}>
          <HexLogo size={64} />
          <Text style={[font.hero, { color: colors.text, marginTop: 14 }]}>Settle</Text>
          <Text style={[font.body, { color: colors.textSecondary, marginTop: 4 }]}>
            Split costs with friends. Settle up in a tap.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify().damping(18)}>
          <View style={{ gap: 10, marginBottom: 22 }}>
            {appleOk && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.md}
                style={{ height: 52 }}
                onPress={() => social("apple")}
              />
            )}
            <PressableScale onPress={() => social("google")} hapticOnPress="light" style={styles.google} accessibilityLabel="Continue with Google">
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={[font.body, { color: colors.text, fontWeight: "700" }]}>
                {loading === "google" ? "Opening Google…" : "Continue with Google"}
              </Text>
            </PressableScale>
          </View>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={[font.small, { color: colors.textMuted }]}>or use email</Text>
            <View style={styles.orLine} />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError("");
              }}
              options={[
                { value: "login", label: "Log in" },
                { value: "signup", label: "Create account" },
              ]}
            />
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "password"}
            onSubmitEditing={submit}
          />

          {error ? (
            <Animated.View entering={FadeIn} style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.pink} />
              <Text style={[font.small, { color: colors.pink, flex: 1 }]}>{error}</Text>
            </Animated.View>
          ) : null}

          <Button
            title={mode === "login" ? "Log in" : "Create account"}
            loading={loading === "email"}
            haptic="medium"
            onPress={submit}
          />
          {mode === "login" && (
            <PressableScale onPress={forgot} style={{ alignItems: "center", paddingVertical: 14 }}>
              <Text style={[font.small, { color: colors.textSecondary, fontWeight: "600" }]}>Forgot password?</Text>
            </PressableScale>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    marginBottom: 36,
  },
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: radius.md,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.pinkBorder,
  },
});
