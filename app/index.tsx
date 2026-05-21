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

  useEffect(() => {
    // First get the session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log("session:", session?.user?.email);
    });
  }, []);

  useEffect(() => {
    // Only fetch events once we have a session
    if (!session) return;

    async function loadEvents() {
      const { data, error } = await supabase.from("events").select("*");
      console.log("data:", data);
      console.log("error:", error);
      if (data) setEvents(data);
    }

    loadEvents();
  }, [session]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Split 💸</Text>
      <Text style={styles.subtitle}>Your events</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
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
});
