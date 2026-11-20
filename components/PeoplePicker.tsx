import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { loadFriends, loadRecentPeople, searchPeople } from "../lib/friends";
import { colors, font, radius } from "../lib/theme";
import { Avatar, PressableScale, SectionLabel, TextField } from "./ui";
import { enter, layoutShift } from "../lib/motion";

// Friends + people you've split with as tap-to-add bubbles, plus username search.
// selectedIds: already picked; excludeIds: never shown (e.g. you, current members)
export default function PeoplePicker({ userId, selectedIds = [], excludeIds = [], onPick }: any) {
  const [friends, setFriends] = useState([]);
  const [recent, setRecent] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([loadFriends(userId), loadRecentPeople(userId)]).then(([f, r]) => {
      if (cancelled) return;
      setFriends(f.friends);
      const friendIds = new Set(f.friends.map((p) => p.id));
      setRecent(r.filter((p) => !friendIds.has(p.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchPeople(query, [userId, ...excludeIds]);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // excludeIds is a new array every render; its contents are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, userId, excludeIds.join(",")]);

  const hidden = new Set([userId, ...excludeIds]);
  const visibleFriends = friends.filter((p) => !hidden.has(p.id));
  const visibleRecent = recent.filter((p) => !hidden.has(p.id));

  return (
    <View>
      {visibleFriends.length > 0 && (
        <>
          <SectionLabel>Friends</SectionLabel>
          <BubbleRow people={visibleFriends} selectedIds={selectedIds} onPick={onPick} />
        </>
      )}
      {visibleRecent.length > 0 && (
        <>
          <SectionLabel>Split with before</SectionLabel>
          <BubbleRow people={visibleRecent} selectedIds={selectedIds} onPick={onPick} />
        </>
      )}
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search by username"
        autoCapitalize="none"
        autoCorrect={false}
        prefix="@"
        style={{ marginBottom: 8, marginTop: 4 }}
      />
      {results.length > 0 && (
        <Animated.View entering={enter} style={styles.results}>
          {results.map((p) => {
            const picked = selectedIds.includes(p.id);
            return (
              <PressableScale
                key={p.id}
                onPress={() => onPick(p)}
                hapticOnPress="select"
                style={styles.resultRow}
              >
                <Avatar id={p.id} name={p.display_name} uri={p.avatar_url} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>
                    {p.display_name}
                  </Text>
                  <Text style={[font.small, { color: colors.textSecondary }]}>@{p.username}</Text>
                </View>
                <Ionicons
                  name={picked ? "checkmark-circle" : "add-circle-outline"}
                  size={24}
                  color={picked ? colors.mint : colors.textSecondary}
                />
              </PressableScale>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

function BubbleRow({ people, selectedIds, onPick }: any) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingBottom: 14, paddingRight: 8 }}
    >
      {people.map((p, i) => {
        const picked = selectedIds.includes(p.id);
        return (
          <Animated.View
            key={p.id}
            entering={enter}
            layout={layoutShift}
          >
            <PressableScale
              onPress={() => onPick(p)}
              hapticOnPress="select"
              style={styles.bubble}
              accessibilityLabel={`${picked ? "Remove" : "Add"} ${p.display_name}`}
            >
              <View>
                <Avatar
                  id={p.id}
                  name={p.display_name}
                  uri={p.avatar_url}
                  size={52}
                  ring={picked ? colors.mint : undefined}
                />
                {picked && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={12} color={colors.onMint} />
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[font.caption, { color: picked ? colors.mint : colors.textSecondary, maxWidth: 64 }]}
              >
                {p.display_name?.split(" ")[0]}
              </Text>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: "center",
    gap: 6,
    width: 64,
  },
  check: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  results: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
