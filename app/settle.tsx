import { setStringAsync } from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Linking,
  ScrollView,
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
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("mine");
  const [copied, setCopied] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, []),
  );

  async function loadAll() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const displayName = profile?.display_name || user.email;
    setCurrentUser(displayName);

    const { data: expenseData } = await supabase
      .from("expenses")
      .select("*")
      .eq("event_id", event_id);
    if (expenseData) setExpenses(expenseData);

    const { data: memberRows } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("event_id", event_id);

    if (memberRows && memberRows.length > 0) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, paypal_username, email")
        .in("id", userIds);
      setMembers(profiles || []);
    }

    const { data: settled } = await supabase
      .from("payments")
      .select("*")
      .eq("event_id", event_id)
      .eq("status", "paid");
    if (settled) setSettledPayments(settled);
  }

  async function markAsPaid(payment) {
    await supabase.from("payments").insert({
      event_id,
      from_name: payment.from,
      to_name: payment.to,
      amount: payment.amount,
      status: "paid",
    });
    loadAll();
  }

  async function openPayPal(payment) {
    const recipient = members.find((m) => m.display_name === payment.to);
    if (!recipient?.paypal_username) {
      alert(`${payment.to} hasn't set up PayPal yet`);
      return;
    }
    Linking.openURL(
      `https://paypal.me/${recipient.paypal_username}/${payment.amount}`,
    );
  }

  async function copyEmail(payment) {
    const recipient = members.find((m) => m.display_name === payment.to);
    if (!recipient?.email) {
      alert(`${payment.to} hasn't set up their email yet`);
      return;
    }
    await setStringAsync(recipient.email);
    setCopied(payment.to);
    setTimeout(() => setCopied(null), 2000);
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

  const iOwe = payments.filter((p) => p.from === currentUser);
  const owedToMe = payments.filter((p) => p.to === currentUser);

  const renderPaymentCard = (item) => {
    const paid = isPaid(item);
    const isMyDebt = item.from === currentUser;

    return (
      <View
        key={`${item.from}-${item.to}`}
        style={[styles.card, paid && styles.cardPaid]}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.paymentText, paid && styles.paymentTextPaid]}>
            <Text style={isMyDebt ? styles.youText : styles.fromName}>
              {isMyDebt ? "You" : item.from}
            </Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={!isMyDebt ? styles.youText : styles.toName}>
              {!isMyDebt ? "You" : item.to}
            </Text>
          </Text>
          {paid && <Text style={styles.paidLabel}>✓ Settled</Text>}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.amount, paid && styles.amountPaid]}>
            ${item.amount.toFixed(2)}
          </Text>
          {!paid && isMyDebt && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyEmail(item)}
              >
                <Text style={styles.copyButtonText}>
                  {copied === item.to ? "Copied!" : "Email"}
                </Text>
              </TouchableOpacity>
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
                <Text style={styles.payButtonText}>Paid</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderAllPayment = ({ item }) => {
    const paid = isPaid(item);
    return (
      <View style={[styles.card, paid && styles.cardPaid]}>
        <View style={styles.cardLeft}>
          <Text style={[styles.paymentText, paid && styles.paymentTextPaid]}>
            <Text style={styles.fromName}>{item.from}</Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={styles.toName}>{item.to}</Text>
          </Text>
          {paid && <Text style={styles.paidLabel}>✓ Settled</Text>}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.amount, paid && styles.amountPaid]}>
            ${item.amount.toFixed(2)}
          </Text>
          {!paid && item.from === currentUser && (
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
                <Text style={styles.payButtonText}>Paid</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

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

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "mine" && styles.activeTab]}
          onPress={() => setActiveTab("mine")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "mine" && styles.activeTabText,
            ]}
          >
            My Payments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.activeTab]}
          onPress={() => setActiveTab("all")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "all" && styles.activeTabText,
            ]}
          >
            All Payments
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "mine" ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>You owe</Text>
          {iOwe.length === 0 ? (
            <Text style={styles.empty}>You're all settled up! 🎉</Text>
          ) : (
            iOwe.map((item) => renderPaymentCard(item))
          )}
          <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
            Owed to you
          </Text>
          {owedToMe.length === 0 ? (
            <Text style={styles.empty}>No one owes you right now</Text>
          ) : (
            owedToMe.map((item) => renderPaymentCard(item))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderAllPayment}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {expenses.length === 0
                ? "No expenses yet"
                : "Everyone is settled up! 🎉"}
            </Text>
          }
        />
      )}
    </View>
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
    marginBottom: 16,
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
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  summaryLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryAmount: {
    color: "#A78BFA",
    fontSize: 24,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "#A78BFA",
  },
  tabText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "500",
  },
  activeTabText: {
    color: "#0A0A0A",
    fontWeight: "700",
  },
  sectionHeader: {
    color: "#A1A1AA",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardPaid: {
    backgroundColor: "#0A1A12",
    borderColor: "#34D399",
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
    color: "#F87171",
  },
  toName: {
    fontWeight: "600",
    color: "#34D399",
  },
  youText: {
    fontWeight: "600",
    color: "#A78BFA",
  },
  arrow: {
    color: "#A1A1AA",
  },
  paidLabel: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  amount: {
    color: "#A78BFA",
    fontSize: 16,
    fontWeight: "600",
  },
  amountPaid: {
    color: "#A1A1AA",
    textDecorationLine: "line-through",
  },
  copyButton: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: "#3A3A3A",
  },
  copyButtonText: {
    color: "#FAFAFA",
    fontSize: 11,
    fontWeight: "600",
  },
  paypalButton: {
    backgroundColor: "#0070BA",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  paypalButtonText: {
    color: "#FAFAFA",
    fontSize: 11,
    fontWeight: "600",
  },
  payButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  payButtonText: {
    color: "#0A0A0A",
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {
    color: "#A1A1AA",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 20,
  },
});
