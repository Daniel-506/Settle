import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { calculateSplit } from "../../lib/splitCalculator";
import { supabase } from "../../lib/supabase";

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const bottomSheetRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
      loadExpenses();
      loadMembers();
    }, []),
  );

  useEffect(() => {
    const channel = supabase
      .channel(`event-${id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `event_id=eq.${id}`,
        },
        () => loadExpenses(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_members",
          filter: `event_id=eq.${id}`,
        },
        () => loadMembers(),
      )
      .subscribe();
    return () => channel.unsubscribe();
  }, [id]);

  async function loadEvent() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setEvent(data);
  }

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("event_id", id);
    if (data) setExpenses(data);
  }

  async function loadMembers() {
    const { data: memberRows } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("event_id", id);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvent();
    await loadExpenses();
    await loadMembers();
    setRefreshing(false);
  };

  const handleSearch = async (text) => {
    setMemberSearch(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .ilike("username", `%${text}%`)
      .limit(5);
    const existingIds = members.map((m) => m.id);
    setSearchResults((data || []).filter((p) => !existingIds.includes(p.id)));
  };

  const addMemberToEvent = async (profile) => {
    await supabase
      .from("event_members")
      .insert({ event_id: id, user_id: profile.id, status: "active" });
    setMemberSearch("");
    setSearchResults([]);
    loadMembers();
  };

  const removeMember = async (memberId) => {
    await supabase
      .from("event_members")
      .delete()
      .eq("event_id", id)
      .eq("user_id", memberId);
    loadMembers();
  };

  const memberNames = members.map((m) => m.display_name || "Unknown");
  const memberIdToName = {};
  members.forEach((m) => {
    memberIdToName[m.id] = m.display_name;
  });
  const currentUserName = members.find(
    (m) => m.id === currentUserId,
  )?.display_name;

  const { total, shouldPay } =
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
      : { total: 0, shouldPay: {} };

  const yourShare = currentUserName ? shouldPay[currentUserName] || 0 : 0;
  const getInitials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Events</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.membersButton}
            onPress={() => bottomSheetRef.current?.expand()}
          >
            <Text style={styles.membersButtonText}>
              Members ({members.length})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00F5D4"
            />
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>{event?.name || "Loading..."}</Text>
              <Text style={styles.subtitle}>
                {event?.date} · {members.length} people
              </Text>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, styles.summaryCardCyan]}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryAmount}>${total.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardPink]}>
                  <Text style={styles.summaryLabel}>Your share</Text>
                  <Text
                    style={[styles.summaryAmount, styles.summaryAmountPink]}
                  >
                    ${yourShare.toFixed(2)}
                  </Text>
                </View>
              </View>

              {expenses.length > 0 && (
                <Text style={styles.sectionLabel}>Expenses</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/edit-expense?id=${item.id}`)}
            >
              <View style={styles.cardAccent} />
              <View style={styles.cardLeft}>
                <Text style={styles.expenseName}>{item.name}</Text>
                <View style={styles.expenseMeta}>
                  <View style={styles.paidByTag}>
                    <Text style={styles.paidByText}>{item.paid_by}</Text>
                  </View>
                  <Text style={styles.expenseDetail}>
                    split {item.split_member_ids?.length || members.length} ways
                  </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
                <Text style={styles.perPerson}>
                  {members.length > 0
                    ? `$${(item.amount / (item.split_member_ids?.length || members.length)).toFixed(2)} each`
                    : ""}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>No expenses yet</Text>
              <Text style={styles.emptySubtitle}>Add the first one below</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
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

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={["60%", "90%"]}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Members</Text>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {getInitials(member.display_name)}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={styles.memberName}>{member.display_name}</Text>
                  {member.id === event?.created_by && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberUsername}>@{member.username}</Text>
              </View>
              {currentUserId === event?.created_by &&
                member.id !== currentUserId && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeMember(member.id)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
            </View>
          ))}
          <Text style={styles.addMemberLabel}>Add member</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor="#8B8B8B"
            value={memberSearch}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.searchResult}
                  onPress={() => addMemberToEvent(profile)}
                >
                  <Text style={styles.searchResultName}>
                    {profile.display_name}
                  </Text>
                  <Text style={styles.searchResultUsername}>
                    @{profile.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  backLink: { color: "#00F5D4", fontSize: 15, fontWeight: "500" },
  membersButton: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#F15BB5",
  },
  membersButtonText: { color: "#F15BB5", fontSize: 13, fontWeight: "600" },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#8B8B8B", fontSize: 13, marginBottom: 20 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
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
  sectionLabel: {
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
  cardAccent: { width: 3, alignSelf: "stretch", backgroundColor: "#00F5D4" },
  cardLeft: { flex: 1, padding: 14 },
  cardRight: { alignItems: "flex-end", paddingRight: 14 },
  expenseName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  expenseMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  paidByTag: {
    backgroundColor: "#2A0A1A",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  paidByText: { color: "#F15BB5", fontSize: 11, fontWeight: "600" },
  expenseDetail: { color: "#8B8B8B", fontSize: 12 },
  amount: { color: "#00F5D4", fontSize: 16, fontWeight: "600" },
  perPerson: { color: "#8B8B8B", fontSize: 11, marginTop: 2 },
  emptyState: { alignItems: "center", paddingTop: 40 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: { color: "#8B8B8B", fontSize: 13 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    padding: 20,
    backgroundColor: "#0A0A0A",
    borderTopWidth: 0.5,
    borderTopColor: "#161616",
  },
  addButton: {
    flex: 1,
    backgroundColor: "#161616",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#262626",
  },
  addButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  settleButton: {
    flex: 1,
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  settleButtonText: { color: "#0A0A0A", fontSize: 15, fontWeight: "700" },
  bottomSheetBg: {
    backgroundColor: "#161616",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetHandle: { backgroundColor: "#00F5D4", width: 40 },
  bottomSheetContent: { paddingHorizontal: 20, paddingTop: 8 },
  bottomSheetTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#262626",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A0A1A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
  },
  memberAvatarText: { color: "#F15BB5", fontSize: 14, fontWeight: "600" },
  memberInfo: { flex: 1 },
  memberName: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  memberUsername: { color: "#8B8B8B", fontSize: 12, marginTop: 2 },
  ownerBadge: {
    backgroundColor: "#0A2A24",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: "#00F5D4",
  },
  ownerBadgeText: { color: "#00F5D4", fontSize: 10, fontWeight: "600" },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  removeButtonText: { color: "#F15BB5", fontSize: 12, fontWeight: "600" },
  addMemberLabel: {
    color: "#8B8B8B",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "#262626",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#363636",
    marginBottom: 8,
  },
  searchResults: {
    backgroundColor: "#262626",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#363636",
    overflow: "hidden",
  },
  searchResult: {
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#363636",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultName: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  searchResultUsername: { color: "#F15BB5", fontSize: 13 },
});
