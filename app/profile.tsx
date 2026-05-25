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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{profile?.display_name || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>@{profile?.username || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PayPal username</Text>
        <TextInput
          style={styles.input}
          placeholder="your paypal username"
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
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  label: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  input: {
    fontSize: 16,
    color: "#1A1A1A",
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: "#534AB7",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginTop: 12,
  },
  logoutButtonText: {
    color: "#A32D2D",
    fontSize: 16,
    fontWeight: "500",
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 15,
    color: "#534AB7",
    fontWeight: "500",
  },
});
