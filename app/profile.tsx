import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  const [saved, setSaved] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
    }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  }

  async function uploadAvatar(uri) {
    setUploadingAvatar(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const fileName = `${user.id}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      Alert.alert("Upload failed", uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(fileName);

    const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

    await supabase
      .from("profiles")
      .update({ avatar_url: urlWithCacheBust })
      .eq("id", user.id);
    setAvatarUrl(urlWithCacheBust);
    setUploadingAvatar(false);
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
    setSaved("paypal");
    setTimeout(() => setSaved(null), 2000);
  }

  function startEdit(field) {
    setEditing(field);
    setEditValue(
      field === "display_name"
        ? profile?.display_name || ""
        : field === "username"
          ? profile?.username || ""
          : field === "email"
            ? profile?.email || ""
            : "",
    );
  }

  async function saveEdit() {
    if (!editValue.trim()) return;
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (editing === "display_name") {
      await supabase
        .from("profiles")
        .update({ display_name: editValue.trim() })
        .eq("id", user.id);
    } else if (editing === "username") {
      const clean = editValue.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const { data: existing } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", clean)
        .neq("id", user.id)
        .single();
      if (existing) {
        Alert.alert("Username taken", "Please choose a different username.");
        setLoading(false);
        return;
      }
      await supabase
        .from("profiles")
        .update({ username: clean })
        .eq("id", user.id);
    } else if (editing === "email") {
      const { error } = await supabase.auth.updateUser({
        email: editValue.trim(),
      });
      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }
      await supabase
        .from("profiles")
        .update({ email: editValue.trim() })
        .eq("id", user.id);
    }

    await loadProfile();
    setEditing(null);
    setEditValue("");
    setLoading(false);
    setSaved(editing);
    setTimeout(() => setSaved(null), 2000);
  }

  async function handleChangePassword() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } else {
      Alert.alert("Email sent", `Password reset email sent to ${user.email}`);
    }
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

  const renderEditableField = (field, label, value, accentColor) => {
    const isEditing = editing === field;
    const isSaved = saved === field;
    return (
      <View
        style={[
          styles.card,
          accentColor === "cyan" ? styles.cardCyan : styles.cardPink,
        ]}
      >
        <View
          style={[
            styles.cardAccent,
            accentColor === "cyan" ? styles.accentCyan : styles.accentPink,
          ]}
        />
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{label}</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => startEdit(field)}>
                <Text style={styles.editButton}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {isEditing ? (
            <>
              <TextInput
                style={styles.editInput}
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
                autoCapitalize={field === "email" ? "none" : "words"}
                keyboardType={field === "email" ? "email-address" : "default"}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={() => {
                    setEditing(null);
                    setEditValue("");
                  }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveEditButton}
                  onPress={saveEdit}
                  disabled={loading}
                >
                  <Text style={styles.saveEditText}>
                    {loading ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.cardValue}>
              {isSaved
                ? "✓ Saved"
                : (field === "username" ? `@${value}` : value) || "—"}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
            <View style={styles.avatarRing}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditText}>
                {uploadingAvatar ? "..." : "✎"}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.displayName}>{profile?.display_name || "—"}</Text>
          <View style={styles.usernameBadge}>
            <Text style={styles.usernameText}>@{profile?.username || "—"}</Text>
          </View>
        </View>

        {renderEditableField(
          "display_name",
          "Display Name",
          profile?.display_name,
          "cyan",
        )}
        {renderEditableField("username", "Username", profile?.username, "pink")}
        {renderEditableField(
          "email",
          "Email · used for e-Transfer payments",
          profile?.email,
          "cyan",
        )}

        <View style={[styles.card, styles.cardPink]}>
          <View style={[styles.cardAccent, styles.accentPink]} />
          <View style={styles.cardInner}>
            <Text style={styles.cardLabel}>PayPal Username</Text>
            <TextInput
              style={styles.editInput}
              placeholder="your paypal username"
              placeholderTextColor="#8B8B8B"
              value={paypal}
              onChangeText={setPaypal}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.saveEditButton}
              onPress={savePayPal}
              disabled={loading}
            >
              <Text style={styles.saveEditText}>
                {saved === "paypal"
                  ? "Saved ✓"
                  : loading
                    ? "Saving..."
                    : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.changePasswordButton}
          onPress={handleChangePassword}
        >
          <Text style={styles.changePasswordText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  avatarWrapper: { position: "relative", marginBottom: 12 },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#00F5D4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
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
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#00F5D4",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditText: { color: "#0A0A0A", fontSize: 12, fontWeight: "700" },
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
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    flexDirection: "row",
    overflow: "hidden",
  },
  cardCyan: { backgroundColor: "#161616", borderColor: "#00F5D4" },
  cardPink: { backgroundColor: "#161616", borderColor: "#F15BB5" },
  cardAccent: { width: 3 },
  accentCyan: { backgroundColor: "#00F5D4" },
  accentPink: { backgroundColor: "#F15BB5" },
  cardInner: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardLabel: {
    color: "#8B8B8B",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  editButton: { color: "#00F5D4", fontSize: 13, fontWeight: "600" },
  cardValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  editInput: {
    color: "#FFFFFF",
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    paddingVertical: 8,
    marginBottom: 12,
  },
  editActions: { flexDirection: "row", gap: 8 },
  cancelEditButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#262626",
    alignItems: "center",
  },
  cancelEditText: { color: "#8B8B8B", fontSize: 13, fontWeight: "600" },
  saveEditButton: {
    flex: 1,
    backgroundColor: "#00F5D4",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  saveEditText: { color: "#0A0A0A", fontSize: 13, fontWeight: "700" },
  changePasswordButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#00F5D4",
    marginBottom: 12,
  },
  changePasswordText: { color: "#00F5D4", fontSize: 15, fontWeight: "600" },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
  },
  logoutButtonText: { color: "#F15BB5", fontSize: 16, fontWeight: "600" },
});
