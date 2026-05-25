import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Linking,
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
  const [settledPayments, setSettledPayments] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
      loadMembers();
      loadSettledPayments();
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
      .select("id, username, display_name, paypal_username")
      .in("id", userIds);

    setMembers(profiles || []);
  }

  async function loadSettledPayments() {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("event_id", event_id)
      .eq("status", "paid");
    if (data) setSettledPayments(data);
  }

  async function markAsPaid(payment) {
    await supabase.from("payments").insert({
      event_id,
      from_name: payment.from,
      to_name: payment.to,
      amount: payment.amount,
      status: "paid",
    });
    loadSettledPayments();
  }

  async function openPayPal(payment) {
    const recipient = members.find((m) => m.display_name === payment.to);
    if (!recipient?.paypal_username) {
      alert(`${payment.to} hasn't set up PayPal yet`);
      return;
    }
    const url = `https://paypal.me/${recipient.paypal_username}/${payment.amount}`;
    Linking.openURL(url);
  }

  function isPaid(payment) {
    return settledPayments.some(
      (sp) =>
        sp.from_name === payment.from &&
        sp.to_name === payment.to &&
        Math.abs(sp.amount - payment.amount) < 0.01,
    );
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
        renderItem={({ item }) => {
          const paid = isPaid(item);
          return (
            <View style={[styles.card, paid && styles.cardPaid]}>
              <View style={styles.cardLeft}>
                <Text
                  style={[styles.paymentText, paid && styles.paymentTextPaid]}
                >
                  <Text style={[styles.fromName, paid && styles.paidName]}>
                    {item.from}
                  </Text>
                  <Text style={styles.arrow}> → </Text>
                  <Text style={[styles.toName, paid && styles.paidName]}>
                    {item.to}
                  </Text>
                </Text>
                {paid && <Text style={styles.paidLabel}>✓ Settled</Text>}
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.amount, paid && styles.amountPaid]}>
                  ${item.amount.toFixed(2)}
                </Text>
                {!paid && (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.paypalButton}
                      onPress={() => openPayPal(item)}
                    >
                      <Text style={styles.paypalButtonText}>PayPal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => markAsPaid(item)}
                    >
                      <Text style={styles.payButtonText}>Mark Paid</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
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
  cardPaid: {
    backgroundColor: "#E1F5EE",
    borderColor: "#0F6E56",
    opacity: 0.7,
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 6,
  },
  paymentText: {
    fontSize: 15,
  },
  paymentTextPaid: {
    textDecorationLine: "line-through",
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
  paidName: {
    color: "#888",
  },
  paidLabel: {
    fontSize: 11,
    color: "#0F6E56",
    fontWeight: "600",
    marginTop: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#534AB7",
  },
  amountPaid: {
    color: "#888",
    textDecorationLine: "line-through",
  },
  payButton: {
    backgroundColor: "#534AB7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  paypalButton: {
    backgroundColor: "#0070BA",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paypalButtonText: {
    color: "#fff",
    fontSize: 12,
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
