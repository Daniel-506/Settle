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

      <Text style={styles.tagline}>Hangouts without the math</Text>

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
  tagline: { color: "#8B8B8B", fontSize: 16, marginBottom: 40 },
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
    borderWidth: 0.5,
    borderColor: "#9B5DE5",
    marginBottom: 20,
  },
  signupButtonText: { color: "#9B5DE5", fontSize: 16, fontWeight: "600" },
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
