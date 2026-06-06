import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
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
  const [eventMemberCounts, setEventMemberCounts] = useState({});

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

    // Load member counts for each event
    if (unique.length > 0) {
      const counts = {};
      await Promise.all(
        unique.map(async (event) => {
          const { data: members } = await supabase
            .from("event_members")
            .select("user_id")
            .eq("event_id", event.id);
          counts[event.id] = members?.length || 0;
        }),
      );
      setEventMemberCounts(counts);
    }
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
    await supabase
      .from("events")
      .update({ status: "finished" })
      .eq("id", eventId);
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
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0)
            isFinished ? markAsActive(item.id) : markAsFinished(item.id);
          else if (index === 1)
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
    const memberCount = eventMemberCounts[item.id] || 0;
    return (
      <View key={item.id} style={[styles.card, past && styles.cardPast]}>
        <View style={[styles.cardAccent, past && styles.cardAccentPast]} />
        <TouchableOpacity
          style={styles.cardLeft}
          onPress={() => router.push(`/event/${item.id}`)}
        >
          <Text style={[styles.eventName, past && styles.eventNamePast]}>
            {item.name}
          </Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventDetail}>{item.date}</Text>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>{memberCount} people</Text>
            </View>
          </View>
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
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logoImage}
          />
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
            tintColor="#00F5D4"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroLabel}>active events</Text>
                  <Text style={styles.heroCount}>
                    {activeEvents.length} ongoing
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>SETTLE</Text>
                </View>
              </View>
              <Text style={styles.heroTagline}>Settle the bill simply.</Text>
            </View>

            {activeEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⚡</Text>
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
  container: { flex: 1, backgroundColor: "#0A0A0A", paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 32,
    height: 32,
    backgroundColor: "#00F5D4",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#0A0A0A", fontSize: 20, fontWeight: "900" },
  logoLabel: { color: "#FFFFFF", fontSize: 20, fontWeight: "600" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#161616",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F15BB5",
  },
  avatarText: { color: "#F15BB5", fontSize: 13, fontWeight: "600" },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heroLabel: {
    color: "#8B8B8B",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroCount: { color: "#00F5D4", fontSize: 28, fontWeight: "700" },
  heroBadge: {
    backgroundColor: "#0A2A24",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#00F5D4",
  },
  heroBadgeText: {
    color: "#00F5D4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroTagline: { color: "#8B8B8B", fontSize: 13 },
  sectionLabel: {
    color: "#8B8B8B",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 24,
  },
  card: {
    backgroundColor: "#161616",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#262626",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardPast: { opacity: 0.5 },
  cardAccent: { width: 3, alignSelf: "stretch", backgroundColor: "#00F5D4" },
  cardAccentPast: { backgroundColor: "#8B8B8B" },
  cardLeft: { flex: 1, padding: 16 },
  cardRight: { paddingRight: 16 },
  chevron: { color: "#00F5D4", fontSize: 22, fontWeight: "300" },
  chevronPast: { color: "#8B8B8B" },
  dotsButton: { padding: 4 },
  dotsText: { color: "#8B8B8B", fontSize: 20, fontWeight: "600" },
  eventName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  eventNamePast: { textDecorationLine: "line-through", color: "#8B8B8B" },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventDetail: { color: "#8B8B8B", fontSize: 12 },
  memberBadge: {
    backgroundColor: "#2A0A1A",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  memberBadgeText: { color: "#F15BB5", fontSize: 11, fontWeight: "600" },
  emptySubtitle: { color: "#8B8B8B", fontSize: 13 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#0A0A0A",
    borderTopWidth: 0.5,
    borderTopColor: "#161616",
  },
  heroCard: {
    backgroundColor: "#161616",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#00F5D4",
  },
  emptyState: { alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  newButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  logoImage: { width: 36, height: 36, borderRadius: 8 },
  newButtonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
});
