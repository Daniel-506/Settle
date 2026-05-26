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

    await supabase.from("event_members").insert({
      event_id: event.id,
      user_id: user.id,
      status: "active",
    });

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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>New Event</Text>
          <Text style={styles.subtitle}>What are you splitting today?</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Event name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sushi Night, BBQ, Road Trip"
            placeholderTextColor="#A1A1AA"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <View style={styles.spacer} />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !name && styles.primaryButtonDisabled,
            ]}
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
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Add Members</Text>
          <Text style={styles.subtitle}>Who's splitting with you?</Text>

          <Text style={styles.label}>Search by username</Text>
          <TextInput
            style={styles.input}
            placeholder="@username"
            placeholderTextColor="#A1A1AA"
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
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.display_name?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.display_name}</Text>
                  <TouchableOpacity onPress={() => removeMember(member.id)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={styles.spacer} />

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
    backgroundColor: "#0A0A0A",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: "#A78BFA",
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    color: "#FAFAFA",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 15,
    marginBottom: 40,
  },
  label: {
    color: "#A1A1AA",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FAFAFA",
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    marginBottom: 16,
  },
  searchResults: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    marginBottom: 20,
    overflow: "hidden",
  },
  searchResult: {
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A2A2A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultName: {
    color: "#FAFAFA",
    fontSize: 14,
    fontWeight: "500",
  },
  searchResultUsername: {
    color: "#A78BFA",
    fontSize: 13,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    gap: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#A78BFA",
  },
  memberAvatarText: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "600",
  },
  memberName: {
    color: "#FAFAFA",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  removeButton: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "600",
  },
  spacer: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  cancelButtonText: {
    color: "#A1A1AA",
    fontSize: 15,
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#1A0A0A",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F87171",
  },
});
