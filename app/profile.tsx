import { router } from "expo-router";
import { useEffect, useState } from "react";
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

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [paypal, setPaypal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) {
      setProfile(data);
      setPaypal(data.paypal_username || "");
    }
  }

  async function savePayPal() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("profiles")
      .update({ paypal_username: paypal })
      .eq("id", user.id);
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.avatarSection}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.displayName}>{profile?.display_name || "—"}</Text>
        <View style={styles.usernameBadge}>
          <Text style={styles.usernameText}>@{profile?.username || "—"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardAccent} />
        <View style={styles.cardInner}>
          <Text style={styles.cardLabel}>Email</Text>
          <Text style={styles.cardValue}>{profile?.email || "—"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardAccentPink} />
        <View style={styles.cardInner}>
          <Text style={styles.cardLabel}>PayPal username</Text>
          <TextInput
            style={styles.input}
            placeholder="your paypal username"
            placeholderTextColor="#8B8B8B"
            value={paypal}
            onChangeText={setPaypal}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={savePayPal}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {saved ? "Saved ✓" : loading ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: { marginBottom: 24 },
  backText: { color: "#00F5D4", fontSize: 15, fontWeight: "500" },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#00F5D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2A0A1A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
  },
  avatarText: { color: "#F15BB5", fontSize: 24, fontWeight: "700" },
  displayName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  usernameBadge: {
    backgroundColor: "#0A2A24",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: "#00F5D4",
  },
  usernameText: { color: "#00F5D4", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "#161616",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#262626",
    flexDirection: "row",
    overflow: "hidden",
  },
  cardAccent: { width: 3, backgroundColor: "#00F5D4" },
  cardAccentPink: { width: 3, backgroundColor: "#F15BB5" },
  cardInner: { flex: 1, padding: 16 },
  cardLabel: {
    color: "#8B8B8B",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  cardValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  input: { color: "#FFFFFF", fontSize: 15, paddingVertical: 4 },
  saveButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonText: { color: "#0A0A0A", fontSize: 14, fontWeight: "700" },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
    marginTop: 8,
  },
  logoutButtonText: { color: "#F15BB5", fontSize: 16, fontWeight: "600" },
});
