import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.replace("/");
    }

    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
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
      <Text style={styles.title}>Split 💸</Text>
      <Text style={styles.subtitle}>Hangouts without the math</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="password"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  signupButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#534AB7",
  },
  signupButtonText: {
    color: "#534AB7",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#A32D2D",
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#FAEAEA",
    borderRadius: 8,
  },
});
