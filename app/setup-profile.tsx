import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, TextField } from "../components/ui";
import { SUGGESTED_NAME_KEY } from "../lib/oauth";
import { supabase } from "../lib/supabase";
import { colors, font, radius } from "../lib/theme";
import useStore from "../store/useStore";

export default function SetupProfileScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const setHasProfile = useStore((s) => s.setHasProfile);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Prefill the name from Apple/Google sign-in when we have it
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata || {};
      const suggested =
        (await AsyncStorage.getItem(SUGGESTED_NAME_KEY)) || meta.full_name || meta.name || "";
      if (suggested) {
        setDisplayName((v) => v || suggested);
        setUsername(
          (v) => v || suggested.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16),
        );
      }
    })();
  }, []);

  const save = async () => {
    if (!displayName.trim() || !username) {
      setError("Add a name and a username.");
      return;
    }
    setLoading(true);
    setError("");
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) {
      setLoading(false);
      setError("That username is taken. Try another one.");
      return;
    }

    const meta = user.user_metadata || {};
    const { error: e } = await supabase.from("profiles").insert({
      id: user.id,
      username,
      display_name: displayName.trim(),
      email: user.email,
      avatar_url: meta.avatar_url || meta.picture || null,
    });
    setLoading(false);
    if (e) {
      setError(e.code === "23505" ? "That username is taken. Try another one." : e.message);
      return;
    }
    await AsyncStorage.removeItem(SUGGESTED_NAME_KEY);
    await refreshProfile();
    // The root layout sees this and takes you to the home screen
    setHasProfile(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 50, paddingHorizontal: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: "center", marginBottom: 18 }}>
          <Avatar id={userId} name={displayName || "?"} size={88} ring={colors.mint} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(100)} style={[font.title, { color: colors.text, textAlign: "center" }]}>
          Set up your profile
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(150)}
          style={[font.body, { color: colors.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 28 }]}
        >
          This is how friends find you on Settle.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(200).springify().damping(18)}>
          <TextField label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="Danny" autoFocus />
          <TextField
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect={false}
            prefix="@"
          />
          <Text style={[font.small, { color: colors.textMuted, marginTop: -8, marginBottom: 20 }]}>
            Lowercase letters, numbers and underscores
          </Text>
          {error ? (
            <Animated.View entering={FadeIn} style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.pink} />
              <Text style={[font.small, { color: colors.pink, flex: 1 }]}>{error}</Text>
            </Animated.View>
          ) : null}
          <Button title="Continue" icon="arrow-forward" loading={loading} haptic="success" onPress={save} />
        </Animated.View>
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
    marginBottom: 14,
    borderRadius: radius.md,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.pinkBorder,
  },
});
