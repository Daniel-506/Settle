import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function SetupProfileScreen() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!username || !displayName) return;
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username.toLowerCase())
      .single();

    if (existing) {
      setError("Username already taken. Try another one.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username: username.toLowerCase(),
      display_name: displayName,
      email: user.email,
    });

    if (error) {
      setError(error.message);
    } else {
      router.replace("/");
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>S</Text>
        </View>
      </View>

      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>
        This is how friends will find you on Settle
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Danny"
        placeholderTextColor="#8B8B8B"
        value={displayName}
        onChangeText={setDisplayName}
        autoFocus
      />

      <Text style={styles.label}>Username</Text>
      <View style={styles.usernameRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={styles.usernameInput}
          placeholder="yourname"
          placeholderTextColor="#8B8B8B"
          value={username}
          onChangeText={(text) => setUsername(text.replace(/[^a-z0-9_]/g, ""))}
          autoCapitalize="none"
        />
      </View>
      <Text style={styles.hint}>
        Only lowercase letters, numbers, and underscores
      </Text>

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[
          styles.saveButton,
          (!username || !displayName) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={loading || !username || !displayName}
      >
        <Text style={styles.saveButtonText}>
          {loading ? "Saving..." : "Continue"}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  logoRow: { marginBottom: 32 },
  logoMark: {
    width: 44,
    height: 44,
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#0A0A0A", fontSize: 28, fontWeight: "900" },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#8B8B8B", fontSize: 15, marginBottom: 40 },
  label: {
    color: "#8B8B8B",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#161616",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#262626",
    marginBottom: 24,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#262626",
    marginBottom: 8,
    paddingLeft: 16,
  },
  at: { color: "#9B5DE5", fontSize: 16, fontWeight: "600" },
  usernameInput: { flex: 1, padding: 16, fontSize: 16, color: "#FFFFFF" },
  hint: { color: "#8B8B8B", fontSize: 12, marginBottom: 32 },
  spacer: { flex: 1 },
  saveButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
  error: {
    color: "#F15BB5",
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#1A0A14",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
});
