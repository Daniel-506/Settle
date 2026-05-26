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
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{profile?.display_name || "—"}</Text>
        <Text style={styles.username}>@{profile?.username || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Email</Text>
        <Text style={styles.cardValue}>{profile?.email || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>PayPal username</Text>
        <TextInput
          style={styles.input}
          placeholder="your paypal username"
          placeholderTextColor="#A1A1AA"
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
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: "#A78BFA",
    fontSize: 15,
    fontWeight: "500",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#A78BFA",
    marginBottom: 12,
  },
  avatarText: {
    color: "#A78BFA",
    fontSize: 24,
    fontWeight: "700",
  },
  displayName: {
    color: "#FAFAFA",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  username: {
    color: "#A78BFA",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  cardLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  cardValue: {
    color: "#FAFAFA",
    fontSize: 15,
    fontWeight: "500",
  },
  input: {
    color: "#FAFAFA",
    fontSize: 15,
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "700",
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#F87171",
    fontSize: 16,
    fontWeight: "500",
  },
});
