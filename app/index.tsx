import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
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
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session);
        setCurrentUserId(session.user.id);
      }
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
    unique.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
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

  async function markAsFinished(eventId) {
    const { error } = await supabase
      .from("events")
      .update({ status: "finished" })
      .eq("id", eventId);
    console.log("markAsFinished error:", error);
    loadEvents(session);
  }

  async function markAsActive(eventId) {
    await supabase
      .from("events")
      .update({ status: "active" })
      .eq("id", eventId);
    loadEvents(session);
  }

  async function deleteEvent(eventId) {
    await supabase.from("events").delete().eq("id", eventId);
    loadEvents(session);
  }

  function showEventMenu(item) {
    const isOwner = item.created_by === currentUserId;
    const isFinished = item.status === "finished";

    if (!isOwner) return;

    if (Platform.OS === "ios") {
      const options = isFinished
        ? ["Mark as Active", "Delete Event", "Cancel"]
        : ["Mark as Finished", "Delete Event", "Cancel"];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) {
            isFinished ? markAsActive(item.id) : markAsFinished(item.id);
          } else if (index === 1) {
            Alert.alert(
              "Delete Event",
              "Are you sure? This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => deleteEvent(item.id),
                },
              ],
            );
          }
        },
      );
    } else {
      Alert.alert(item.name, "What do you want to do?", [
        {
          text: isFinished ? "Mark as Active" : "Mark as Finished",
          onPress: () =>
            isFinished ? markAsActive(item.id) : markAsFinished(item.id),
        },
        {
          text: "Delete Event",
          style: "destructive",
          onPress: () =>
            Alert.alert("Delete Event", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteEvent(item.id),
              },
            ]),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const activeEvents = events.filter((e) => e.status !== "finished");
  const pastEvents = events.filter((e) => e.status === "finished");

  const renderEvent = (item, past = false) => {
    const isOwner = item.created_by === currentUserId;
    return (
      <View key={item.id} style={[styles.card, past && styles.cardPast]}>
        <TouchableOpacity
          style={styles.cardLeft}
          onPress={() => router.push(`/event/${item.id}`)}
        >
          <Text style={[styles.eventName, past && styles.eventNamePast]}>
            {item.name}
          </Text>
          <Text style={styles.eventDetail}>{item.date}</Text>
        </TouchableOpacity>
        <View style={styles.cardRight}>
          {isOwner ? (
            <TouchableOpacity
              style={styles.dotsButton}
              onPress={() => showEventMenu(item)}
            >
              <Text style={styles.dotsText}>⋮</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.chevron, past && styles.chevronPast]}>›</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.logoLabel}>Settle</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push("/profile")}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A78BFA"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>active events</Text>
              <Text style={styles.heroCount}>
                {activeEvents.length} ongoing
              </Text>
            </View>

            {activeEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active events</Text>
                <Text style={styles.emptySubtitle}>
                  Create one to start splitting
                </Text>
              </View>
            ) : (
              activeEvents.map((item) => renderEvent(item, false))
            )}

            {pastEvents.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Past Events</Text>
                {pastEvents.map((item) => renderEvent(item, true))}
              </>
            )}
          </View>
        }
        renderItem={() => null}
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
  sectionLabel: {
    color: "#A1A1AA",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 24,
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
  cardPast: {
    opacity: 0.5,
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
  chevronPast: {
    color: "#A1A1AA",
  },
  dotsButton: {
    padding: 4,
  },
  dotsText: {
    color: "#A1A1AA",
    fontSize: 20,
    fontWeight: "600",
  },
  eventName: {
    color: "#FAFAFA",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventNamePast: {
    textDecorationLine: "line-through",
    color: "#A1A1AA",
  },
  eventDetail: {
    color: "#A1A1AA",
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
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
