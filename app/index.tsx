import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function HomeScreen() {
  const [events, setEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session);
    });
  }, []);

  async function loadProfile(currentSession) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", currentSession.user.id)
      .single();
    if (data) setDisplayName(data.display_name || "");
  }

  async function loadEvents(currentSession = session) {
    if (!currentSession) return;

    const { data: memberRows } = await supabase
      .from("event_members")
      .select("event_id")
      .eq("user_id", currentSession.user.id);

    const memberEventIds = (memberRows || []).map((m) => m.event_id);

    const { data: createdEvents } = await supabase
      .from("events")
      .select("*")
      .eq("created_by", currentSession.user.id);

    let memberEvents = [];
    if (memberEventIds.length > 0) {
      const { data } = await supabase
        .from("events")
        .select("*")
        .in("id", memberEventIds);
      memberEvents = data || [];
    }

    const all = [...(createdEvents || []), ...memberEvents];
    const unique = Array.from(new Map(all.map((e) => [e.id, e])).values());
    unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setEvents(unique);
  }

  useEffect(() => {
    if (!session) return;
    loadEvents(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`home-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_members" },
        () => loadEvents(session),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => loadEvents(session),
      )
      .subscribe();
    return () => channel.unsubscribe();
  }, [session]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents(session);
    setRefreshing(false);
  };

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.logoLabel}>Split</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push("/profile")}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A78BFA"
          />
        }
        ListHeaderComponent={
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>your events</Text>
            <Text style={styles.heroCount}>{events.length} active</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/event/${item.id}`)}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.eventName}>{item.name}</Text>
              <Text style={styles.eventDetail}>{item.date}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>
              Create one to start splitting
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push("/new-event")}
        >
          <Text style={styles.newButtonText}>+ New Event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 32,
    height: 32,
    backgroundColor: "#A78BFA",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#0A0A0A",
    fontSize: 20,
    fontWeight: "900",
  },
  logoLabel: {
    color: "#FAFAFA",
    fontSize: 20,
    fontWeight: "600",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#A78BFA",
  },
  avatarText: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  heroLabel: {
    color: "#A1A1AA",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroCount: {
    color: "#A78BFA",
    fontSize: 28,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    marginLeft: 8,
  },
  chevron: {
    color: "#A78BFA",
    fontSize: 22,
    fontWeight: "300",
  },
  eventName: {
    color: "#FAFAFA",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventDetail: {
    color: "#A1A1AA",
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    color: "#FAFAFA",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#0A0A0A",
    borderTopWidth: 0.5,
    borderTopColor: "#1A1A1A",
  },
  newButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  newButtonText: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "700",
  },
});
