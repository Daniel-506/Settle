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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (
        error.message.toLowerCase().includes("invalid") ||
        error.message.toLowerCase().includes("credentials")
      ) {
        setError(
          "No account found with those details. Please check your info or create an account.",
        );
      } else {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Please enter your email and password to create an account.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setError(error.message);
    } else {
      setError("");
      alert(`Password reset email sent to ${email}`);
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
        <Text style={styles.logoLabel}>Settle</Text>
      </View>

      <Text style={styles.tagline}>Settle the bill simply.</Text>

      <View style={styles.tagRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>⚡ Split bills</Text>
        </View>
        <View style={styles.tagPink}>
          <Text style={styles.tagTextPink}>💸 Track debts</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>✓ Settle up</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@email.com"
        placeholderTextColor="#8B8B8B"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="password"
        placeholderTextColor="#8B8B8B"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.loginButtonText}>
          {loading ? "Loading..." : "Log In"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.forgotButton}
        onPress={handleForgotPassword}
      >
        <Text style={styles.forgotButtonText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signupButton}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.signupButtonText}>
          {loading ? "Loading..." : "Create Account"}
        </Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
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
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  logoMark: {
    width: 44,
    height: 44,
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#0A0A0A", fontSize: 28, fontWeight: "900" },
  logoLabel: { color: "#FFFFFF", fontSize: 32, fontWeight: "700" },
  tagline: { color: "#8B8B8B", fontSize: 16, marginBottom: 20 },
  tagRow: { flexDirection: "row", gap: 8, marginBottom: 32, flexWrap: "wrap" },
  tag: {
    backgroundColor: "#0A2A24",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: "#00F5D4",
  },
  tagText: { color: "#00F5D4", fontSize: 12, fontWeight: "600" },
  tagPink: {
    backgroundColor: "#2A0A1A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  tagTextPink: { color: "#F15BB5", fontSize: 12, fontWeight: "600" },
  spacer: { flex: 1 },
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
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  loginButtonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
  signupButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
    marginBottom: 20,
  },
  signupButtonText: { color: "#F15BB5", fontSize: 16, fontWeight: "600" },
  error: {
    color: "#F15BB5",
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#2A0A1A",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  forgotButton: { alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  forgotButtonText: { color: "#8B8B8B", fontSize: 14 },
});
