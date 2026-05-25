import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function NewEventScreen() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (text) => {
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

      if (data) setSearchResults(data);
    };
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

    if (data) setSearchResults(data);
  };

  const addMember = (profile) => {
    if (members.find((m) => m.id === profile.id)) return;
    setMembers([...members, profile]);
    setMemberSearch("");
    setSearchResults([]);
  };

  const removeMember = (id) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  const handleCreate = async () => {
    if (!name) return;
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Create the event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        name,
        date: new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      setError(eventError.message);
      setLoading(false);
      return;
    }

    // Add creator as member
    await supabase.from("event_members").insert({
      event_id: event.id,
      user_id: user.id,
      status: "active",
    });

    // Add other members
    for (const member of members) {
      await supabase.from("event_members").insert({
        event_id: event.id,
        user_id: member.id,
        status: "active",
      });
    }

    router.replace("/");
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {step === 1 ? (
        <>
          <Text style={styles.title}>New Event</Text>
          <Text style={styles.subtitle}>What are you splitting today?</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Event name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sushi Night, BBQ, Road Trip"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (!name) return;
              setStep(2);
            }}
          >
            <Text style={styles.primaryButtonText}>Next →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Add Members</Text>
          <Text style={styles.subtitle}>Who's splitting with you?</Text>

          <Text style={styles.label}>Search by username</Text>
          <TextInput
            style={styles.input}
            placeholder="@username"
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
                  onPress={() => addMember(profile)}
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

          {members.length > 0 && (
            <>
              <Text style={styles.label}>Members added</Text>
              {members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{member.display_name}</Text>
                  <TouchableOpacity onPress={() => removeMember(member.id)}>
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Creating..." : "Create Event"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setStep(1)}
          >
            <Text style={styles.cancelButtonText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginBottom: 24,
  },
  searchResults: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
    marginBottom: 24,
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
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EEEDFE",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#534AB7",
  },
  removeButton: {
    fontSize: 13,
    color: "#A32D2D",
  },
  primaryButton: {
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 16,
  },
  error: {
    color: "#A32D2D",
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#FAEAEA",
    borderRadius: 8,
  },
});
