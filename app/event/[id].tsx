import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditEventSheet, deleteEvent, setEventStatus } from "../../components/EventActions";
import InviteSheet from "../../components/InviteSheet";
import PeoplePicker from "../../components/PeoplePicker";
import {
  ActionSheet,
  Avatar,
  AvatarStack,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  PressableScale,
  Segmented,
  SectionLabel,
  Sheet,
  SkeletonRows,
  confirm,
  notify,
  toast,
} from "../../components/ui";
import { loadEventData, nameFor } from "../../lib/eventData";
import { dayLabel, formatMoney, shortDate } from "../../lib/format";
import { calculateSplit, splitExpense } from "../../lib/splitCalculator";
import { supabase } from "../../lib/supabase";
import { categoryFor, colorForId, colors, font, money, radius } from "../../lib/theme";
import useStore from "../../store/useStore";
import { enter, layoutShift } from "../../lib/motion";

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("expenses");
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null); // "members" | "invite" | "menu" | "edit"
  const timer = useRef(null);

  const load = useCallback(async () => {
    const [{ data: ev }, data] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      loadEventData(id),
    ]);
    if (ev) setEvent(ev);
    setMembers(data.members);
    setExpenses(data.expenses);
    setPayments(data.payments);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const reload = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 300);
    };
    const channel = supabase.channel(`event-${id}-${Date.now()}`);
    ["expenses", "event_members", "payments"].forEach((table) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `event_id=eq.${id}` },
        reload,
      ),
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: `id=eq.${id}` },
      reload,
    );
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      channel.unsubscribe();
    };
  }, [id, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const memberIds = members.map((m) => m.id);
  const calc = useMemo(
    () => calculateSplit(expenses, memberIds, payments),
    // memberIds is derived from members
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, members, payments],
  );
  const myBalance = calc.balanceById[userId] || 0;
  const isOwner = event?.created_by === userId;
  const finished = event?.status === "finished";
  const colorKey = event?.color || colorForId(String(id)).key;

  // Expenses + payments, newest day first
  const timeline = useMemo(() => {
    const rows = [
      ...expenses.map((e) => ({ kind: "expense", key: `e${e.id}`, dateKey: e.dateKey, sortAt: e.created_at, item: e })),
      ...payments.map((p) => ({ kind: "payment", key: `p${p.id}`, dateKey: p.dateKey, sortAt: p.created_at, item: p })),
    ];
    rows.sort((a, b) => {
      const d = (b.dateKey || "").localeCompare(a.dateKey || "");
      return d !== 0 ? d : String(b.sortAt || "").localeCompare(String(a.sortAt || ""));
    });
    const groups = [];
    rows.forEach((r) => {
      const label = r.dateKey ? dayLabel(r.dateKey) : "Earlier";
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else groups.push({ label, rows: [r] });
    });
    return groups;
  }, [expenses, payments]);

  const removeMember = async (member) => {
    const paidFor = expenses.filter((e) => e.paidById === member.id).length;
    const sharedIn = expenses.filter((e) => (splitExpense(e, memberIds)[member.id] || 0) > 0).length;
    const inPayments = payments.some((p) => p.fromId === member.id || p.toId === member.id);
    if (paidFor > 0 || sharedIn > 0 || inPayments) {
      const reasons = [
        paidFor > 0 && `paid for ${paidFor} expense${paidFor === 1 ? "" : "s"}`,
        sharedIn > 0 && `is part of ${sharedIn} expense${sharedIn === 1 ? "" : "s"}`,
        inPayments && "has settled payments",
      ].filter(Boolean);
      notify(
        `Can't remove ${member.display_name} yet`,
        `${member.display_name} ${reasons.join(", ")} in this event. Edit or delete those first so nobody's balance changes by surprise.`,
      );
      return;
    }
    const leaving = member.id === userId;
    const ok = await confirm({
      title: leaving ? "Leave this event?" : `Remove ${member.display_name}?`,
      message: leaving ? "You can rejoin later with an invite code." : "They can be added back any time.",
      confirmText: leaving ? "Leave" : "Remove",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("event_id", id)
      .eq("user_id", member.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    if (leaving) {
      toast("You left the event");
      router.replace("/home");
    } else {
      toast(`${member.display_name} removed`);
      load();
    }
  };

  const addMember = async (person) => {
    if (memberIds.includes(person.id)) return;
    const { error } = await supabase
      .from("event_members")
      .insert({ event_id: id, user_id: person.id, status: "active" });
    if (error && error.code !== "23505") {
      toast(error.message, "error");
      return;
    }
    toast(`${person.display_name} added`);
    load();
  };

  const menuActions = [
    { label: "Invite with link or QR", icon: "qr-code-outline", onPress: () => setSheet("invite") },
    { label: "Members", icon: "people-outline", onPress: () => setSheet("members") },
    ...(isOwner
      ? [
          { label: "Edit event", icon: "create-outline", onPress: () => setSheet("edit") },
          {
            label: finished ? "Mark as active" : "Mark as finished",
            icon: finished ? "refresh-outline" : "flag-outline",
            onPress: async () => {
              if (await setEventStatus(event, finished ? "active" : "finished")) load();
            },
          },
          {
            label: "Delete event",
            icon: "trash-outline",
            destructive: true,
            onPress: async () => {
              if (await deleteEvent(event)) router.replace("/home");
            },
          },
        ]
      : [
          {
            label: "Leave event",
            icon: "exit-outline",
            destructive: true,
            onPress: () => {
              const me = members.find((m) => m.id === userId);
              if (me) removeMember(me);
            },
          },
        ]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <IconButton
          icon="chevron-back"
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <PressableScale onPress={() => setSheet("members")} style={styles.membersPill} accessibilityLabel="Members">
            <AvatarStack people={members} size={22} max={3} ring={colors.surface} />
            <Text style={[font.caption, { color: colors.text }]}>{members.length}</Text>
          </PressableScale>
          <IconButton icon="ellipsis-horizontal" label="Event options" onPress={() => setSheet("menu")} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={enter} style={styles.titleRow}>
          <IconTile icon={event?.icon || "receipt"} colorKey={colorKey} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[font.title, { color: colors.text }]} numberOfLines={2}>
              {event?.name || " "}
            </Text>
            <Text style={[font.small, { color: colors.textSecondary }]}>
              {[
                event?.created_at ? shortDate(event.created_at.slice(0, 10)) : event?.date,
                `total ${formatMoney(calc.total)}`,
                finished ? "finished" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </Animated.View>

        {/* Your balance */}
        <Animated.View entering={enter}>
          <Card
            tone={myBalance > 0.004 ? "mint" : myBalance < -0.004 ? "pink" : undefined}
            style={styles.hero}
          >
            <Text style={[font.label, { color: colors.textSecondary }]}>
              {myBalance > 0.004 ? "You're owed" : myBalance < -0.004 ? "You owe" : "Your balance"}
            </Text>
            <Text
              style={[
                font.hero,
                money,
                {
                  color: myBalance > 0.004 ? colors.mint : myBalance < -0.004 ? colors.pink : colors.text,
                  marginVertical: 6,
                },
              ]}
            >
              {Math.abs(myBalance) < 0.005 ? "All settled" : formatMoney(myBalance)}
            </Text>
            <Text style={[font.small, { color: colors.textSecondary, marginBottom: 14 }]}>
              Your share so far: {formatMoney(calc.shareById[userId] || 0)}
            </Text>
            <Button
              title="Settle up"
              icon="swap-horizontal"
              variant={myBalance < -0.004 ? "light" : "primary"}
              onPress={() => router.push(`/settle?event_id=${id}`)}
            />
          </Card>
        </Animated.View>

        <View style={{ marginVertical: 18 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "expenses", label: "Expenses" },
              { value: "balances", label: "Balances" },
            ]}
          />
        </View>

        {!loaded ? (
          <SkeletonRows count={4} />
        ) : tab === "expenses" ? (
          timeline.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No expenses yet"
              body="Add the first one and Settle works out who owes who."
            />
          ) : (
            timeline.map((group) => (
              <Animated.View key={group.label} layout={layoutShift}>
                <SectionLabel style={{ marginTop: 6 }}>{group.label}</SectionLabel>
                <Card style={{ paddingVertical: 4, marginBottom: 14 }}>
                  {group.rows.map((r, i) => (
                    <Animated.View
                      key={r.key}
                      entering={enter}
                      layout={layoutShift}
                    >
                      {r.kind === "expense" ? (
                        <ExpenseRow
                          expense={r.item}
                          members={members}
                          memberIds={memberIds}
                          userId={userId}
                          last={i === group.rows.length - 1}
                        />
                      ) : (
                        <PaymentRow
                          payment={r.item}
                          members={members}
                          userId={userId}
                          last={i === group.rows.length - 1}
                        />
                      )}
                    </Animated.View>
                  ))}
                </Card>
              </Animated.View>
            ))
          )
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {members.map((m, i) => {
              const b = calc.balanceById[m.id] || 0;
              return (
                <Animated.View
                  key={m.id}
                  entering={enter}
                  style={[styles.row, i < members.length - 1 && styles.rowBorder]}
                >
                  <Avatar id={m.id} name={m.display_name} uri={m.avatar_url} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>
                      {m.id === userId ? "You" : m.display_name}
                    </Text>
                    <Text style={[font.small, { color: colors.textSecondary }]}>
                      spent {formatMoney(calc.paidById[m.id] || 0)} · share{" "}
                      {formatMoney(calc.shareById[m.id] || 0)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[font.caption, { color: colors.textSecondary }]}>
                      {Math.abs(b) < 0.005 ? "settled" : b > 0 ? "gets back" : "owes"}
                    </Text>
                    {Math.abs(b) >= 0.005 && (
                      <Text style={[font.h3, money, { color: b > 0 ? colors.mint : colors.pink }]}>
                        {formatMoney(b)}
                      </Text>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title="Add expense"
          icon="add"
          variant="light"
          haptic="medium"
          onPress={() => router.push(`/add-expense?event_id=${id}`)}
        />
      </View>

      {/* Sheets */}
      <ActionSheet visible={sheet === "menu"} onClose={() => setSheet(null)} title={event?.name} actions={menuActions} />
      <InviteSheet visible={sheet === "invite"} onClose={() => setSheet(null)} event={event} />
      <EditEventSheet event={sheet === "edit" ? event : null} visible={sheet === "edit"} onClose={() => setSheet(null)} onSaved={load} />
      <Sheet visible={sheet === "members"} onClose={() => setSheet(null)} title={`Members · ${members.length}`} scroll>
        {members.map((m) => (
          <View key={m.id} style={[styles.row, styles.rowBorder]}>
            <Avatar id={m.id} name={m.display_name} uri={m.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>
                  {m.id === userId ? `${m.display_name} (you)` : m.display_name}
                </Text>
                {m.id === event?.created_by && (
                  <View style={styles.ownerBadge}>
                    <Text style={{ color: colors.mint, fontSize: 10, fontWeight: "800" }}>OWNER</Text>
                  </View>
                )}
              </View>
              <Text style={[font.small, { color: colors.textSecondary }]}>@{m.username}</Text>
            </View>
            {isOwner && m.id !== userId && (
              <Button title="Remove" size="sm" variant="danger" onPress={() => removeMember(m)} />
            )}
          </View>
        ))}
        <Button
          title="Invite with link or QR"
          icon="qr-code-outline"
          variant="mintSoft"
          style={{ marginVertical: 16 }}
          onPress={() => {
            setSheet(null);
            setTimeout(() => setSheet("invite"), 250);
          }}
        />
        <PeoplePicker userId={userId} excludeIds={memberIds} selectedIds={[]} onPick={addMember} />
      </Sheet>
    </View>
  );
}

function ExpenseRow({ expense, members, memberIds, userId, last }: any) {
  const cat = categoryFor(expense.category);
  const shares = splitExpense(expense, memberIds);
  const mine = (shares[userId] || 0) / 100;
  const iPaid = expense.paidById === userId;
  const payer = iPaid ? "You" : nameFor(expense.paidById, members, expense.paid_by);
  let label = "not involved";
  let value = null;
  let tone = colors.textMuted;
  if (iPaid && expense.amount - mine > 0.004) {
    label = "you lent";
    value = expense.amount - mine;
    tone = colors.mint;
  } else if (!iPaid && mine > 0.004) {
    label = "you owe";
    value = mine;
    tone = colors.pink;
  } else if (iPaid) {
    label = "just you";
  }
  return (
    <PressableScale
      onPress={() => router.push(`/edit-expense?id=${expense.id}`)}
      style={[styles.row, !last && styles.rowBorder]}
    >
      <IconTile icon={cat.icon} colorKey={cat.color} size={40} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[font.body, { color: colors.text, fontWeight: "600", flexShrink: 1 }]} numberOfLines={1}>
            {expense.name}
          </Text>
          {expense.receipt_path ? <Ionicons name="image-outline" size={14} color={colors.textMuted} /> : null}
          {expense.note ? <Ionicons name="document-text-outline" size={14} color={colors.textMuted} /> : null}
        </View>
        <Text style={[font.small, { color: colors.textSecondary }]}>
          {payer} paid {formatMoney(expense.amount)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[font.caption, { color: colors.textSecondary }]}>{label}</Text>
        {value !== null && <Text style={[font.h3, money, { color: tone }]}>{formatMoney(value)}</Text>}
      </View>
    </PressableScale>
  );
}

function PaymentRow({ payment, members, userId, last }: any) {
  const from = payment.fromId === userId ? "You" : nameFor(payment.fromId, members, payment.from_name);
  const to = payment.toId === userId ? "you" : nameFor(payment.toId, members, payment.to_name);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <IconTile icon="cash" colorKey="mint" size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>
          {from} paid {to}
        </Text>
        <Text style={[font.small, { color: colors.textSecondary }]}>Settled up</Text>
      </View>
      <Text style={[font.h3, money, { color: colors.mint }]}>{formatMoney(payment.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  membersPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
    marginBottom: 18,
  },
  hero: {
    padding: 18,
    borderRadius: radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ownerBadge: {
    backgroundColor: colors.mintSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
});
