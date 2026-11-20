import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Button,
  Card,
  PressableScale,
  SectionLabel,
  Sheet,
  TextField,
  confirm,
  notify,
  toast,
} from "../../components/ui";
import { notificationStatus, registerForPush, setPushDisabled, unregisterPush } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";
import { colors, font } from "../../lib/theme";
import useStore from "../../store/useStore";

const FIELDS = {
  display_name: { label: "Display name", placeholder: "Danny" },
  username: { label: "Username", placeholder: "yourname" },
  email: { label: "Email", placeholder: "you@email.com" },
  paypal_username: { label: "PayPal username", placeholder: "your PayPal.me name" },
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const profile = useStore((s) => s.profile);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [push, setPush] = useState("undetermined");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      notificationStatus().then(setPush);
    }, [refreshProfile]),
  );

  const startEdit = (field) => {
    setEditing(field);
    setValue(profile?.[field] || "");
  };

  const saveEdit = async () => {
    const v = value.trim();
    setSaving(true);
    try {
      if (editing === "display_name") {
        if (!v) throw new Error("Your name can't be empty.");
        const { error } = await supabase.from("profiles").update({ display_name: v }).eq("id", userId);
        if (error) throw error;
        // Everything is linked by user ID; this only refreshes the name copies
        // older app builds read. Scoped to YOUR rows only.
        await supabase.from("expenses").update({ paid_by: v }).eq("paid_by_id", userId);
        await supabase.from("payments").update({ from_name: v }).eq("from_id", userId);
        await supabase.from("payments").update({ to_name: v }).eq("to_id", userId);
      } else if (editing === "username") {
        const clean = v.toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (!clean) throw new Error("Use letters, numbers or underscores.");
        const { error } = await supabase.from("profiles").update({ username: clean }).eq("id", userId);
        if (error) throw new Error(error.code === "23505" ? "That username is taken." : error.message);
      } else if (editing === "email") {
        const { error } = await supabase.auth.updateUser({ email: v });
        if (error) throw error;
        await supabase.from("profiles").update({ email: v }).eq("id", userId);
        notify("Check your inbox", `We sent a confirmation link to ${v}. Your login email changes once you tap it.`);
      } else if (editing === "paypal_username") {
        const { error } = await supabase
          .from("profiles")
          .update({ paypal_username: v.replace(/^@/, "").replace(/^paypal\.me\//i, "") })
          .eq("id", userId);
        if (error) throw error;
      }
      await refreshProfile();
      toast("Saved");
      setEditing(null);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      notify("Photos access needed", "Allow access to your photos to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const buffer = await response.arrayBuffer();
      const fileName = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await supabase.from("profiles").update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq("id", userId);
      await refreshProfile();
      toast("Photo updated");
    } catch (e) {
      toast(e.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const togglePush = async (on) => {
    if (on) {
      if (push === "denied") {
        notify("Notifications are off", "Turn them on for Settle in your phone's Settings.");
        Linking.openSettings();
        return;
      }
      await setPushDisabled(false);
      const token = await registerForPush({ ask: true });
      setPush(token ? "granted" : await notificationStatus());
    } else {
      await setPushDisabled(true);
      await unregisterPush();
      setPush("off");
      toast("Notifications off for this phone", "info");
    }
  };

  const changePassword = async () => {
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: Linking.createURL("/reset-password"),
    });
    if (error) toast("Something went wrong. Try again.", "error");
    else notify("Email sent", `Open the link sent to ${data.user.email} to choose a new password.`);
  };

  const logOut = async () => {
    const ok = await confirm({ title: "Log out?", confirmText: "Log out" });
    if (!ok) return;
    await unregisterPush();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const { error: pwError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deleteInput,
    });
    if (pwError) {
      setDeleting(false);
      toast("Incorrect password", "error");
      return;
    }
    await unregisterPush();
    await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);
    const { error } = await supabase.rpc("delete_user");
    setDeleting(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setDeleteOpen(false);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const pushOn = push === "granted";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[font.title, { color: colors.text }]}>Profile</Text>

        <Animated.View entering={ZoomIn.springify().damping(15)} style={styles.hero}>
          <PressableScale onPress={pickAvatar} scaleTo={0.94} accessibilityLabel="Change profile photo">
            <Avatar id={userId} name={profile?.display_name} uri={profile?.avatar_url} size={96} ring={colors.mint} />
            <View style={styles.cameraBadge}>
              <Ionicons name={uploading ? "hourglass-outline" : "camera"} size={15} color={colors.onMint} />
            </View>
          </PressableScale>
          <Text style={[font.h2, { color: colors.text, marginTop: 12 }]}>{profile?.display_name || " "}</Text>
          <Text style={[font.small, { color: colors.textSecondary }]}>@{profile?.username}</Text>
        </Animated.View>

        <SectionLabel>Account</SectionLabel>
        <Card style={{ paddingVertical: 2 }}>
          {Object.keys(FIELDS).map((field, i, all) => (
            <Animated.View key={field} entering={FadeInDown.delay(i * 40)}>
              <PressableScale
                onPress={() => startEdit(field)}
                scaleTo={0.98}
                style={[styles.row, i < all.length - 1 && styles.rowBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[font.small, { color: colors.textSecondary }]}>{FIELDS[field].label}</Text>
                  <Text style={[font.body, { color: profile?.[field] ? colors.text : colors.textMuted, fontWeight: "600" }]}>
                    {profile?.[field] ? (field === "username" ? `@${profile[field]}` : profile[field]) : "Not set"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </PressableScale>
            </Animated.View>
          ))}
        </Card>
        <Text style={[font.small, { color: colors.textMuted, marginTop: 8, marginBottom: 18 }]}>
          Friends see your email and PayPal when they settle up with you.
        </Text>

        <SectionLabel>Preferences</SectionLabel>
        <Card style={[styles.row, { paddingHorizontal: 14 }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>Push notifications</Text>
            <Text style={[font.small, { color: colors.textSecondary }]}>
              {Platform.OS === "web" ? "Available in the phone app" : "New expenses, payments and requests"}
            </Text>
          </View>
          <Switch
            value={pushOn}
            onValueChange={togglePush}
            disabled={Platform.OS === "web"}
            trackColor={{ false: colors.surfacePressed, true: colors.mint }}
            thumbColor={colors.white}
          />
        </Card>

        <View style={{ gap: 10, marginTop: 24 }}>
          <Button title="Change password" icon="key-outline" variant="secondary" onPress={changePassword} />
          <Button title="Log out" icon="log-out-outline" variant="secondary" onPress={logOut} />
          <Button
            title="Delete account"
            icon="trash-outline"
            variant="ghost"
            onPress={() => {
              setDeleteInput("");
              setDeleteOpen(true);
            }}
          />
        </View>
      </ScrollView>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? FIELDS[editing].label : ""}>
        {editing && (
          <>
            <TextField
              value={value}
              onChangeText={setValue}
              placeholder={FIELDS[editing].placeholder}
              autoFocus
              autoCapitalize={editing === "display_name" ? "words" : "none"}
              keyboardType={editing === "email" ? "email-address" : "default"}
              prefix={editing === "username" ? "@" : undefined}
              onSubmitEditing={saveEdit}
            />
            <Button title="Save" loading={saving} onPress={saveEdit} />
          </>
        )}
      </Sheet>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <Text style={[font.body, { color: colors.textSecondary, marginBottom: 16, lineHeight: 21 }]}>
          Your profile, friends and the expenses you paid for are removed. Events you made that
          still have people in them are handed to another member. This can&apos;t be undone.
        </Text>
        <TextField
          label="Password"
          value={deleteInput}
          onChangeText={setDeleteInput}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Your password"
        />
        <Button title="Delete my account" variant="danger" haptic="warning" loading={deleting} onPress={deleteAccount} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});

