import { router, useLocalSearchParams } from "expo-router";
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const { data: memberRows } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("event_id", event_id);

    const memberCount = memberRows?.length || 1;

    const { error } = await supabase.from("expenses").insert({
      event_id,
      name,
      amount: parseFloat(amount),
      paid_by: profile?.display_name || user.email,
      split_between: memberCount,
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add Expense</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>What did you buy?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Drinks, Salmon, Pizza"
        placeholderTextColor="#A1A1AA"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>How much did it cost?</Text>
      <View style={styles.amountRow}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor="#A1A1AA"
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[
          styles.addButton,
          (!name || !amount) && styles.addButtonDisabled,
        ]}
        onPress={handleAdd}
        disabled={loading || !name || !amount}
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
    backgroundColor: "#0A0A0A",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    color: "#A78BFA",
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    color: "#FAFAFA",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
  },
  label: {
    color: "#A1A1AA",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FAFAFA",
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    marginBottom: 24,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    marginBottom: 24,
    paddingLeft: 16,
  },
  dollarSign: {
    color: "#A78BFA",
    fontSize: 20,
    fontWeight: "600",
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 20,
    color: "#FAFAFA",
    fontWeight: "500",
  },
  spacer: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  cancelButtonText: {
    color: "#A1A1AA",
    fontSize: 15,
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#1A0A0A",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F87171",
  },
});
