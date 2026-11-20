import { Ionicons } from "@expo/vector-icons";
import { setStringAsync } from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Header,
  PressableScale,
  Segmented,
  SectionLabel,
  SkeletonRows,
  confirm,
  notify,
  toast,
} from "../components/ui";
import { loadEventData, nameFor } from "../lib/eventData";
import { formatMoney } from "../lib/format";
import { calculateSplit } from "../lib/splitCalculator";
import { supabase } from "../lib/supabase";
import { colors, font, money, radius } from "../lib/theme";
import useStore from "../store/useStore";
import { enter, exit, layoutShift } from "../lib/motion";

export default function SettleScreen() {
  const { event_id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const [eventName, setEventName] = useState("");
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settled, setSettled] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("mine");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const [{ data: ev }, data] = await Promise.all([
      supabase.from("events").select("name").eq("id", event_id).maybeSingle(),
      loadEventData(event_id),
    ]);
    setEventName(ev?.name || "");
    setMembers(data.members);
    setExpenses(data.expenses);
    setSettled(data.payments);
    setLoaded(true);
  }, [event_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live updates when someone else pays or edits
  useEffect(() => {
    const reload = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 300);
    };
    const channel = supabase.channel(`settle-${event_id}-${Date.now()}`);
    ["payments", "expenses"].forEach((table) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `event_id=eq.${event_id}` },
        reload,
      ),
    );
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      channel.unsubscribe();
    };
  }, [event_id, load]);

  // Name for anyone, including a payer who has since left the event
  const nameOf = (id) => {
    const fallback =
      expenses.find((e) => e.paidById === id)?.paid_by ||
      settled.find((p) => p.fromId === id)?.from_name ||
      settled.find((p) => p.toId === id)?.to_name ||
      "Unknown";
    return nameFor(id, members, fallback);
  };
  const person = (id) => members.find((m) => m.id === id) || { id, display_name: nameOf(id) };

  const record = async (t, receivedByMe = false) => {
    if (busy) return;
    if (receivedByMe) {
      const ok = await confirm({
        title: "Mark as received?",
        message: `Confirm ${nameOf(t.fromId)} paid you ${formatMoney(t.amount)}.`,
        confirmText: "Got it",
      });
      if (!ok) return;
    }
    setBusy(true);
    const { error } = await supabase.from("payments").insert({
      event_id,
      from_id: t.fromId,
      to_id: t.toId,
      // name copies are still read by older app builds
      from_name: nameOf(t.fromId),
      to_name: nameOf(t.toId),
      amount: t.amount,
      status: "paid",
    });
    setBusy(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast(receivedByMe ? "Marked as received" : "Marked as paid");
    load();
  };

  const undo = async (p) => {
    if (busy) return;
    setBusy(true);
    // Only this one payment, not every payment between these two people
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    setBusy(false);
    if (error) toast(error.message, "error");
    else toast("Payment undone", "info");
    load();
  };

  const payPal = (t) => {
    const r = members.find((m) => m.id === t.toId);
    if (!r?.paypal_username) {
      notify("No PayPal yet", `${nameOf(t.toId)} hasn't added a PayPal username.`);
      return;
    }
    Linking.openURL(
      `https://paypal.me/${encodeURIComponent(r.paypal_username)}/${t.amount.toFixed(2)}CAD`,
    );
  };

  const eTransfer = async (t) => {
    const r = members.find((m) => m.id === t.toId);
    if (!r?.email) {
      notify("No email yet", `${nameOf(t.toId)} hasn't added an email.`);
      return;
    }
    await setStringAsync(r.email);
    toast(`${r.email} copied for e-Transfer`);
  };

  const memberIds = members.map((m) => m.id);
  const { total, transfers, balanceById } = calculateSplit(expenses, memberIds, settled);
  const mine = balanceById[userId] || 0;
  const iOwe = transfers.filter((t) => t.fromId === userId);
  const owedToMe = transfers.filter((t) => t.toId === userId);
  const mySettled = settled.filter((p) => p.fromId === userId || p.toId === userId);

  const transferCard = (t, i) => {
    const isMyDebt = t.fromId === userId;
    const toMe = t.toId === userId;
    return (
      <Animated.View
        key={`${t.fromId}-${t.toId}`}
        entering={enter}
        exiting={exit}
        layout={layoutShift}
      >
        <Card tone={isMyDebt ? "pink" : toMe ? "mint" : undefined} style={styles.transfer}>
          <View style={styles.people}>
            <Avatar id={t.fromId} name={nameOf(t.fromId)} uri={person(t.fromId).avatar_url} size={40} />
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
            <Avatar id={t.toId} name={nameOf(t.toId)} uri={person(t.toId).avatar_url} size={40} />
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={[font.body, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                {isMyDebt ? nameOf(t.toId) : toMe ? nameOf(t.fromId) : `${nameOf(t.fromId)} → ${nameOf(t.toId)}`}
              </Text>
              <Text style={[font.small, { color: colors.textSecondary }]}>
                {isMyDebt ? "you owe them" : toMe ? "owes you" : "to settle"}
              </Text>
            </View>
            <Text
              style={[
                font.h2,
                money,
                { color: isMyDebt ? colors.pink : toMe ? colors.mint : colors.text },
              ]}
            >
              {formatMoney(t.amount)}
            </Text>
          </View>
          {isMyDebt && (
            <View style={styles.actions}>
              <Button title="e-Transfer" size="sm" variant="secondary" icon="mail-outline" style={{ flex: 1 }} onPress={() => eTransfer(t)} />
              <Button title="PayPal" size="sm" variant="secondary" icon="logo-paypal" style={{ flex: 1 }} onPress={() => payPal(t)} />
              <Button title="Paid" size="sm" variant="light" icon="checkmark" style={{ flex: 1 }} haptic="success" onPress={() => record(t)} />
            </View>
          )}
          {toMe && (
            <View style={styles.actions}>
              <Button title="Got it" size="sm" variant="primary" icon="checkmark" style={{ flex: 1 }} onPress={() => record(t, true)} />
            </View>
          )}
        </Card>
      </Animated.View>
    );
  };

  const settledRow = (p, i, list) => (
    <Animated.View
      key={String(p.id)}
      entering={enter}
      layout={layoutShift}
      style={[styles.settledRow, i < list.length - 1 && styles.rowBorder]}
    >
      <View style={styles.tick}>
        <Ionicons name="checkmark" size={14} color={colors.mint} />
      </View>
      <Text style={[font.body, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
        {p.fromId === userId ? "You" : nameOf(p.fromId)} paid {p.toId === userId ? "you" : nameOf(p.toId)}
      </Text>
      <Text style={[font.body, money, { color: colors.textSecondary }]}>{formatMoney(p.amount)}</Text>
      {(p.fromId === userId || p.toId === userId) && (
        <PressableScale onPress={() => undo(p)} hitSlop={8}>
          <Text style={[font.small, { color: colors.pink, fontWeight: "700" }]}>Undo</Text>
        </PressableScale>
      )}
    </Animated.View>
  );

  const list = tab === "mine" ? [...iOwe, ...owedToMe] : transfers;
  const history = tab === "mine" ? mySettled : settled;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      <Header title="Settle up" subtitle={eventName} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter}>
          <Card style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={[font.label, { color: colors.textSecondary }]}>
                {mine > 0.004 ? "You're owed" : mine < -0.004 ? "You owe" : "You"}
              </Text>
              <Text
                style={[
                  font.title,
                  money,
                  { color: mine > 0.004 ? colors.mint : mine < -0.004 ? colors.pink : colors.text },
                ]}
              >
                {Math.abs(mine) < 0.005 ? "Settled" : formatMoney(mine)}
              </Text>
            </View>
            <View style={styles.vr} />
            <View style={{ flex: 1 }}>
              <Text style={[font.label, { color: colors.textSecondary }]}>Event total</Text>
              <Text style={[font.title, money, { color: colors.text }]}>{formatMoney(total)}</Text>
            </View>
          </Card>
        </Animated.View>

        <View style={{ marginVertical: 18 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "mine", label: "Mine" },
              { value: "all", label: `Everyone · ${transfers.length}` },
            ]}
          />
        </View>

        {!loaded ? (
          <SkeletonRows count={3} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="checkmark-done"
            colorKey="mint"
            title={expenses.length === 0 ? "Nothing to settle yet" : tab === "mine" ? "You're all settled up" : "Everyone is settled up"}
            body={expenses.length === 0 ? "Add some expenses first." : "Nice. Nobody owes anything right now."}
          />
        ) : (
          <View style={{ gap: 10 }}>{list.map(transferCard)}</View>
        )}

        {history.length > 0 && (
          <>
            <SectionLabel style={{ marginTop: 24 }}>Settled</SectionLabel>
            <Card style={{ paddingVertical: 2 }}>{history.map(settledRow)}</Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    padding: 18,
    borderRadius: radius.xl,
  },
  vr: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  transfer: {
    gap: 14,
  },
  people: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  settledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mintSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
