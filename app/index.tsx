import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents(session);
    setRefreshing(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log("session:", session?.user?.email);
    });
  }, []);

  async function loadEvents(currentSession = session) {
    if (!currentSession) return;

    const { data: memberRows, error: memberError } = await supabase
      .from("event_members")
      .select("event_id")
      .eq("user_id", currentSession.user.id);

    console.log("memberRows for", currentSession.user.email, ":", memberRows);
    console.log("memberError:", memberError);

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

    console.log("events found:", unique.length);
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
        () => {
          loadEvents(session);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          loadEvents(session);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Split 💸</Text>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Text style={styles.profileButton}>Profile</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Your events</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              console.log("item:", item);
              router.push(`/event/${item.id}`);
            }}
          >
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventDetail}>{item.date}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.newButton}
        onPress={() => router.push("/new-event")}
      >
        <Text style={styles.newButtonText}>+ New Event</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => supabase.auth.signOut()}>
        <Text style={{ color: "red", textAlign: "center", marginBottom: 10 }}>
          Log Out
        </Text>
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
    fontSize: 40,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  eventName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventDetail: {
    fontSize: 13,
    color: "#888",
    marginBottom: 8,
  },
  newButton: {
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 20,
  },
  newButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  profileButton: {
    fontSize: 15,
    color: "#534AB7",
    fontWeight: "500",
  },
});
