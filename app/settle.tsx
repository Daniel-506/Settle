import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { calculateSplit } from "../lib/splitCalculator";
import { supabase } from "../lib/supabase";

export default function SettleScreen() {
  const { event_id } = useLocalSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
      loadMembers();
    }, []),
  );

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("event_id", event_id);
    if (data) setExpenses(data);
  }

  async function loadMembers() {
    const { data: memberRows } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("event_id", event_id);

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = memberRows.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);

    setMembers(profiles || []);
  }

  const memberNames = members.map((m) => m.display_name || "Unknown");

  const { total, fairShare, payments } =
    expenses.length > 0 && memberNames.length > 0
      ? calculateSplit(
          expenses.map((e) => ({
            ...e,
            paidBy: e.paid_by,
            splitBetween: memberNames.length,
          })),
          memberNames,
        )
      : { total: 0, fairShare: 0, payments: [] };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settle Up</Text>

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

      <Text style={styles.sectionLabel}>Payments needed</Text>

      <FlatList
        data={payments}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.paymentText}>
                <Text style={styles.fromName}>{item.from}</Text>
                <Text style={styles.arrow}> → </Text>
                <Text style={styles.toName}>{item.to}</Text>
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
              <TouchableOpacity style={styles.payButton}>
                <Text style={styles.payButtonText}>Pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {expenses.length === 0
              ? "No expenses yet"
              : "Everyone is settled up! 🎉"}
          </Text>
        }
      />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back to Event</Text>
      </TouchableOpacity>
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
    marginBottom: 20,
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
  sectionLabel: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
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
    gap: 8,
  },
  paymentText: {
    fontSize: 15,
  },
  fromName: {
    fontWeight: "600",
    color: "#A32D2D",
  },
  arrow: {
    color: "#888",
  },
  toName: {
    fontWeight: "600",
    color: "#0F6E56",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#534AB7",
  },
  payButton: {
    backgroundColor: "#534AB7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: "#888",
    fontSize: 15,
    marginTop: 40,
  },
  backButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 20,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  backButtonText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
  },
});
