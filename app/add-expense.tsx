import { router, useLocalSearchParams } from "expo-router";
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

export default function AddExpenseScreen() {
  const { event_id } = useLocalSearchParams();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!name || !amount) return;
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("expenses").insert({
      event_id,
      name,
      amount: parseFloat(amount),
      paid_by: user.email,
      split_between: 4,
    });

    if (error) {
      setError(error.message);
    } else {
      router.back();
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.title}>Add Expense</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>What did you buy?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Drinks, Salmon, Pizza"
        value={name}
        onChangeText={(text) => setName(text)}
      />

      <Text style={styles.label}>How much did it cost?</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        value={amount}
        onChangeText={(text) => {
          const filtered = text.replace(/[^0-9.]/g, "");
          setAmount(filtered);
        }}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAdd}
        disabled={loading}
      >
        <Text style={styles.addButtonText}>
          {loading ? "Adding..." : "Add Expense"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
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
    marginBottom: 32,
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
  addButton: {
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 16,
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
