import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { calculateSplit } from "../../lib/splitCalculator";
import { supabase } from "../../lib/supabase";

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [event, setEvent] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
      loadExpenses();
    }, []),
  );

  async function loadEvent() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setEvent(data);
  }

  async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("event_id", id);
    console.log("expenses:", data);
    console.log("error:", error);
    if (data) setExpenses(data);
  }

  const members = ["Jake", "You", "Maria", "Chris"];
  const { total, fairShare } =
    expenses.length > 0
      ? calculateSplit(
          expenses.map((e) => ({
            ...e,
            paidBy: e.paid_by,
            splitBetween: e.split_between,
          })),
          members,
        )
      : { total: 0, fairShare: 0 };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{event?.name || "Loading..."}</Text>
      <Text style={styles.subtitle}>{event?.date} · 4 people</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryAmount}>${total.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Each owes</Text>
          <Text style={styles.summaryAmount}>${fairShare.toFixed(2)}</Text>
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.expenseName}>{item.name}</Text>
              <Text style={styles.expenseDetail}>
                paid by {item.paid_by} · split {item.split_between} ways
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
              <Text style={styles.perPerson}>
                ${(item.amount / item.split_between).toFixed(2)} each
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/add-expense?event_id=${id}`)}
        >
          <Text style={styles.addButtonText}>+ Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settleButton}
          onPress={() => router.push(`/settle?event_id=${id}`)}
        >
          <Text style={styles.settleButtonText}>Settle Up</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#534AB7",
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  expenseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  expenseDetail: {
    fontSize: 12,
    color: "#888",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#534AB7",
  },
  perPerson: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 20,
  },
  addButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  settleButton: {
    flex: 1,
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  settleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
