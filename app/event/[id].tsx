import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { calculateSplit } from "../../lib/splitCalculator";
import { supabase } from "../../lib/supabase";

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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
        () => {
          loadExpenses();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_members",
          filter: `event_id=eq.${id}`,
        },
        () => {
          loadMembers();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
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
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("event_id", id);
    console.log("expenses:", data);
    console.log("error:", error);
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
    const filtered = (data || []).filter((p) => !existingIds.includes(p.id));
    setSearchResults(filtered);
  };

  const addMemberToEvent = async (profile) => {
    await supabase.from("event_members").insert({
      event_id: id,
      user_id: profile.id,
      status: "active",
    });

    setMemberSearch("");
    setSearchResults([]);
    setShowAddMember(false);
    loadMembers();
  };

  const memberNames = members.map((m) => m.display_name || "Unknown");

  const { total, fairShare } =
    expenses.length > 0 && memberNames.length > 0
      ? calculateSplit(
          expenses.map((e) => ({
            ...e,
            paidBy: e.paid_by,
            splitBetween: memberNames.length,
          })),
          memberNames,
        )
      : { total: 0, fairShare: 0 };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 4 }}
          >
            <Text style={styles.backLink}>← Events</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{event?.name || "Loading..."}</Text>
          <Text style={styles.subtitle}>
            {event?.date} · {members.length} people
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addMemberButton}
          onPress={() => setShowAddMember(!showAddMember)}
        >
          <Text style={styles.addMemberButtonText}>
            {showAddMember ? "Cancel" : "+ Add"}
          </Text>
        </TouchableOpacity>
      </View>

      {showAddMember && (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search by username..."
            value={memberSearch}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoFocus
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
        </View>
      )}

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
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.expenseName}>{item.name}</Text>
              <Text style={styles.expenseDetail}>
                paid by {item.paid_by} · split{" "}
                {members.length > 0 ? members.length : "?"} ways
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
              <Text style={styles.perPerson}>
                {members.length > 0
                  ? `$${(item.amount / members.length).toFixed(2)} each`
                  : ""}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  addMemberButton: {
    backgroundColor: "#534AB7",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addMemberButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginBottom: 8,
  },
  searchResults: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginBottom: 16,
    overflow: "hidden",
  },
  searchResult: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  searchResultUsername: {
    fontSize: 13,
    color: "#888",
  },

  backLink: {
    fontSize: 14,
    color: "#534AB7",
    fontWeight: "500",
  },
});
