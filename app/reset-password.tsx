import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconTile, TextField } from "../components/ui";
import { linkParams } from "../lib/links";
import { supabase } from "../lib/supabase";
import { colors, font, radius } from "../lib/theme";
import { enter } from "../lib/motion";

const EXPIRED = "This reset link is invalid or has expired. Request a new one from the login screen.";

// The password reset email links here (settle://reset-password, or the
// Expo Go / web equivalent). Supabase puts the login tokens on the end of the
// link, e.g. ...#access_token=...&refresh_token=...&type=recovery
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = url ? linkParams(url) : {};
      if (params.error_description) {
        setError(`${params.error_description}. Request a new link from the login screen.`);
        return;
      }
      let result = null;
      if (params.access_token && params.refresh_token) {
        result = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      } else if (params.code) {
        result = await supabase.auth.exchangeCodeForSession(params.code);
      }
      if (cancelled) return;
      if (result?.error) {
        setError(EXPIRED);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) setReady(true);
      else if (url) setError(EXPIRED);
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const save = async () => {
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) setError(e.message);
    else setDone(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enter} style={{ alignItems: "center", marginBottom: 18 }}>
          <IconTile icon={done ? "checkmark-circle" : "key"} colorKey="mint" size={64} />
        </Animated.View>
        <Text style={[font.title, { color: colors.text, textAlign: "center", marginBottom: 8 }]}>
          {done ? "Password updated" : "Reset password"}
        </Text>

        {error ? (
          <Animated.View entering={enter} style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={colors.pink} />
            <Text style={[font.small, { color: colors.pink, flex: 1 }]}>{error}</Text>
          </Animated.View>
        ) : null}

        {done ? (
          <Button title="Continue" icon="arrow-forward" style={{ marginTop: 20 }} onPress={() => router.replace("/home")} />
        ) : ready ? (
          <Animated.View entering={enter}>
            <Text style={[font.body, { color: colors.textSecondary, textAlign: "center", marginBottom: 24 }]}>
              Choose a new password.
            </Text>
            <TextField label="New password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry autoFocus />
            <TextField label="Confirm password" value={confirmPw} onChangeText={setConfirmPw} placeholder="Type it again" secureTextEntry onSubmitEditing={save} />
            <Button title="Save password" loading={loading} haptic="success" onPress={save} />
          </Animated.View>
        ) : error ? null : (
          <Text style={[font.body, { color: colors.textSecondary, textAlign: "center" }]}>Checking your reset link…</Text>
        )}

        {!done && (
          <Button title="Back to login" variant="ghost" style={{ marginTop: 12 }} onPress={() => router.replace("/login")} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.pinkBorder,
  },
});
