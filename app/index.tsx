import { router } from "expo-router";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

const events = [
  {
    id: "1",
    name: "Sushi Night 🍣",
    date: "May 18, 2026",
    members: 4,
    total: 119.0,
  },
  {
    id: "2",
    name: "Movie Night 🎬",
    date: "May 10, 2026",
    members: 3,
    total: 45.5,
  },
  {
    id: "3",
    name: "BBQ Weekend 🔥",
    date: "May 3, 2026",
    members: 6,
    total: 230.0,
  },
];

export default function HomeScreen() {
  useEffect(() => {
    async function test() {
      const { data, error } = await supabase.from("events").select("*");
      console.log("data:", data);
      console.log("error:", error);
    }
    test();
  }, []);
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
            onPress={() => router.push("/event")}
          >
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventDetail}>
              {item.date} · {item.members} people
            </Text>
            <Text style={styles.eventTotal}>${item.total.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.newButton}>
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
  eventTotal: {
    fontSize: 16,
    fontWeight: "500",
    color: "#534AB7",
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
