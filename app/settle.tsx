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
    setCurrentUser(profile?.display_name || user.email);

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
    console.log("memberIdToName:", memberIdToName);
    console.log(
      "first expense split_member_ids:",
      expenses[0]?.split_member_ids,
    );
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
  async function unmarkPaid(payment) {
    console.log("unmark:", payment.from, payment.to, event_id);
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("event_id", event_id)
      .eq("from_name", payment.from)
      .eq("to_name", payment.to);
    console.log("unmark error:", error);
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
  const memberIdToName = {};
  members.forEach((m) => {
    memberIdToName[m.id] = m.display_name;
  });
  console.log(
    "calling calc with expenses:",
    expenses.map((e) => ({
      name: e.name,
      amount: e.amount,
      paidBy: e.paid_by,
      splitMembers: e.split_member_ids
        ?.map((uid) => memberIdToName[uid])
        .filter(Boolean),
    })),
  );
  const { total, payments } =
    expenses.length > 0 && memberNames.length > 0
      ? calculateSplit(
          expenses.map((e) => ({
            ...e,
            paidBy: e.paid_by,
            splitMembers: e.split_member_ids
              ? e.split_member_ids
                  .map((uid) => memberIdToName[uid])
                  .filter(Boolean)
              : memberNames,
            customSplits: e.custom_splits || {},
          })),
          memberNames,
        )
      : { total: 0, payments: [] };

  const iOwe = payments.filter((p) => p.from === currentUser);
  const owedToMe = payments.filter((p) => p.to === currentUser);

  console.log("expenses loaded:", expenses.length);
  console.log("members loaded:", memberNames);
  console.log("payments calc:", payments);

  const renderPaymentCard = (item) => {
    const paid = isPaid(item);
    const isMyDebt = item.from === currentUser;
    return (
      <View
        key={`${item.from}-${item.to}`}
        style={[styles.card, paid && styles.cardPaid]}
      >
        <View
          style={[
            styles.cardAccent,
            isMyDebt ? styles.cardAccentPink : styles.cardAccentCyan,
            paid && styles.cardAccentPaid,
          ]}
        />
        <View style={styles.cardLeft}>
          <View style={styles.paymentRow}>
            <View
              style={[
                styles.nameTag,
                isMyDebt ? styles.nameTagPink : styles.nameTagCyan,
              ]}
            >
              <Text
                style={[
                  styles.nameTagText,
                  isMyDebt ? styles.nameTagTextPink : styles.nameTagTextCyan,
                ]}
              >
                {isMyDebt ? "You" : item.from}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View
              style={[
                styles.nameTag,
                !isMyDebt ? styles.nameTagPink : styles.nameTagCyan,
              ]}
            >
              <Text
                style={[
                  styles.nameTagText,
                  !isMyDebt ? styles.nameTagTextPink : styles.nameTagTextCyan,
                ]}
              >
                {!isMyDebt ? "You" : item.to}
              </Text>
            </View>
          </View>
          {paid && (
            <View style={styles.settledRow}>
              <Text style={styles.paidLabel}>✓ Settled</Text>
              <TouchableOpacity onPress={() => unmarkPaid(item)}>
                <Text style={styles.unsettleText}>Undo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.cardRight}>
          <Text
            style={[
              styles.amount,
              paid && styles.amountPaid,
              isMyDebt ? styles.amountPink : styles.amountCyan,
            ]}
          >
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
    const isMyDebt = item.from === currentUser;
    return (
      <View style={[styles.card, paid && styles.cardPaid]}>
        <View
          style={[
            styles.cardAccent,
            isMyDebt ? styles.cardAccentPink : styles.cardAccentCyan,
            paid && styles.cardAccentPaid,
          ]}
        />
        <View style={styles.cardLeft}>
          <View style={styles.paymentRow}>
            <View style={styles.nameTagPlain}>
              <Text style={styles.nameTagPlainText}>{item.from}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.nameTagPlain}>
              <Text style={styles.nameTagPlainText}>{item.to}</Text>
            </View>
          </View>
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
        <View style={[styles.summaryCard, styles.summaryCardCyan]}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryAmount}>${total.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardPink]}>
          <Text style={styles.summaryLabel}>Payments</Text>
          <Text style={[styles.summaryAmount, styles.summaryAmountPink]}>
            {payments.length}
          </Text>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.empty}>You're all settled up!</Text>
            </View>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.empty}>
                {expenses.length === 0
                  ? "No expenses yet"
                  : "Everyone is settled up!"}
              </Text>
            </View>
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
  backButton: { marginBottom: 16 },
  backText: { color: "#00F5D4", fontSize: 15, fontWeight: "500" },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 16, borderWidth: 1 },
  summaryCardCyan: { backgroundColor: "#0A2A24", borderColor: "#00F5D4" },
  summaryCardPink: { backgroundColor: "#2A0A1A", borderColor: "#F15BB5" },
  summaryLabel: {
    color: "#8B8B8B",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryAmount: { color: "#00F5D4", fontSize: 24, fontWeight: "700" },
  summaryAmountPink: { color: "#F15BB5" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#161616",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: "#262626",
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  activeTab: { backgroundColor: "#00F5D4" },
  tabText: { color: "#8B8B8B", fontSize: 13, fontWeight: "500" },
  activeTabText: { color: "#0A0A0A", fontWeight: "700" },
  sectionHeader: {
    color: "#8B8B8B",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#161616",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#262626",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardPaid: { opacity: 0.5 },
  cardAccent: { width: 3, alignSelf: "stretch" },
  cardAccentCyan: { backgroundColor: "#00F5D4" },
  cardAccentPink: { backgroundColor: "#F15BB5" },
  cardAccentPaid: { backgroundColor: "#8B8B8B" },
  cardLeft: { flex: 1, padding: 14 },
  cardRight: { alignItems: "flex-end", paddingRight: 14, gap: 8 },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameTag: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 0.5,
  },
  nameTagCyan: { backgroundColor: "#0A2A24", borderColor: "#00F5D4" },
  nameTagPink: { backgroundColor: "#2A0A1A", borderColor: "#F15BB5" },
  nameTagText: { fontSize: 13, fontWeight: "600" },
  nameTagTextCyan: { color: "#00F5D4" },
  nameTagTextPink: { color: "#F15BB5" },
  nameTagPlain: {
    backgroundColor: "#262626",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  nameTagPlainText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  arrow: { color: "#8B8B8B", fontSize: 14 },
  paidLabel: { color: "#00F5D4", fontSize: 11, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 6 },
  amount: { fontSize: 16, fontWeight: "700" },
  amountCyan: { color: "#00F5D4" },
  amountPink: { color: "#F15BB5" },
  amountPaid: { color: "#8B8B8B", textDecorationLine: "line-through" },
  copyButton: {
    backgroundColor: "#262626",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: "#363636",
  },
  copyButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  paypalButton: {
    backgroundColor: "#2A0A1A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  paypalButtonText: { color: "#F15BB5", fontSize: 11, fontWeight: "600" },
  payButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  settledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  unsettleText: {
    color: "#8B8B8B",
    fontSize: 11,
    textDecorationLine: "underline",
    marginTop: 1,
  },
  payButtonText: { color: "#0A0A0A", fontSize: 11, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingTop: 20 },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  empty: { color: "#8B8B8B", fontSize: 14, textAlign: "center" },
});
