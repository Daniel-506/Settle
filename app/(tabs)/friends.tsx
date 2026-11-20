import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  PressableScale,
  SectionLabel,
  SkeletonRows,
  TextField,
  confirm,
  toast,
} from "../../components/ui";
import {
  acceptFriend,
  loadFriends,
  removeFriendship,
  searchPeople,
  sendFriendRequest,
} from "../../lib/friends";
import { friendLink } from "../../lib/links";
import { shareText } from "../../lib/share";
import { supabase } from "../../lib/supabase";
import { colors, font } from "../../lib/theme";
import useStore from "../../store/useStore";

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const profile = useStore((s) => s.profile);
  const setFriendRequests = useStore((s) => s.setFriendRequests);
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const next = await loadFriends(userId);
    setData(next);
    setFriendRequests(next.incoming.length);
  }, [userId, setFriendRequests]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`friends-${userId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [userId, load]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchPeople(query, [userId]);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, userId]);

  const act = async (id, fn, done) => {
    setBusyId(id);
    try {
      await fn();
      if (done) toast(done);
      await load();
    } catch (e) {
      toast(e.message || "Something went wrong", "error");
    } finally {
      setBusyId(null);
    }
  };

  const add = (p) =>
    act(p.id, async () => {
      const result = await sendFriendRequest(p.id);
      toast(result === "friends" ? `You and ${p.display_name} are now friends` : `Request sent to ${p.display_name}`);
    });

  const invite = () => {
    const username = profile?.username;
    shareText(
      `Add me on Settle so we can split costs easily. My username is @${username}.\n\nTap: ${friendLink(username)}`,
      "Invite copied. Paste it in a message",
    );
  };

  const status = data?.statusById || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.mint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={[font.title, { color: colors.text }]}>Friends</Text>
          <IconButton icon="share-social-outline" label="Invite friends" onPress={invite} />
        </View>

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Find people by username"
          autoCapitalize="none"
          autoCorrect={false}
          prefix="@"
        />

        {data && !data.ready && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={[font.small, { color: colors.textSecondary }]}>
              Friends turn on after the latest database update is run in Supabase.
            </Text>
          </Card>
        )}

        {/* Search results */}
        {query.trim().length >= 2 && (
          <Animated.View entering={FadeIn} style={{ marginBottom: 18 }}>
            <SectionLabel>Results</SectionLabel>
            {results.length === 0 ? (
              <Text style={[font.small, { color: colors.textSecondary }]}>
                Nobody with that username yet. Invite them instead.
              </Text>
            ) : (
              <Card style={{ paddingVertical: 2 }}>
                {results.map((p, i) => (
                  <PersonRow key={p.id} person={p} last={i === results.length - 1}>
                    {status[p.id] === "friends" ? (
                      <Text style={[font.small, { color: colors.mint, fontWeight: "700" }]}>Friends</Text>
                    ) : status[p.id] === "outgoing" ? (
                      <Text style={[font.small, { color: colors.textSecondary, fontWeight: "700" }]}>Requested</Text>
                    ) : status[p.id] === "incoming" ? (
                      <Button title="Accept" size="sm" loading={busyId === p.id} onPress={() => add(p)} />
                    ) : (
                      <Button title="Add" size="sm" icon="person-add-outline" loading={busyId === p.id} onPress={() => add(p)} />
                    )}
                  </PersonRow>
                ))}
              </Card>
            )}
          </Animated.View>
        )}

        {!data ? (
          <SkeletonRows count={4} />
        ) : (
          <>
            {data.incoming.length > 0 && (
              <Animated.View entering={FadeInDown.springify()} layout={LinearTransition.springify()}>
                <SectionLabel>Requests · {data.incoming.length}</SectionLabel>
                <Card tone="mint" style={{ paddingVertical: 2, marginBottom: 18 }}>
                  {data.incoming.map((p, i) => (
                    <PersonRow key={p.id} person={p} last={i === data.incoming.length - 1}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Button
                          title="Accept"
                          size="sm"
                          loading={busyId === p.id}
                          onPress={() => act(p.id, () => acceptFriend(p.friendshipId), `You and ${p.display_name} are now friends`)}
                        />
                        <Button
                          title="Decline"
                          size="sm"
                          variant="ghost"
                          onPress={() => act(p.id, () => removeFriendship(p.friendshipId))}
                        />
                      </View>
                    </PersonRow>
                  ))}
                </Card>
              </Animated.View>
            )}

            <SectionLabel>Your friends · {data.friends.length}</SectionLabel>
            {data.friends.length === 0 ? (
              <EmptyState
                icon="people"
                colorKey="purple"
                title="Add your friends"
                body="Friends show up as one-tap bubbles when you make an event."
                action={<Button title="Invite friends" icon="share-social-outline" onPress={invite} />}
              />
            ) : (
              <Card style={{ paddingVertical: 2 }}>
                {data.friends.map((p, i) => (
                  <Animated.View key={p.id} entering={FadeInDown.delay(i * 35)} exiting={FadeOut} layout={LinearTransition.springify()}>
                    <PersonRow person={p} last={i === data.friends.length - 1} onPress={() => setMenuFor(p)} />
                  </Animated.View>
                ))}
              </Card>
            )}

            {data.outgoing.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 18 }}>Sent</SectionLabel>
                <Card style={{ paddingVertical: 2 }}>
                  {data.outgoing.map((p, i) => (
                    <PersonRow key={p.id} person={p} last={i === data.outgoing.length - 1}>
                      <Button
                        title="Cancel"
                        size="sm"
                        variant="ghost"
                        onPress={() => act(p.id, () => removeFriendship(p.friendshipId), "Request cancelled")}
                      />
                    </PersonRow>
                  ))}
                </Card>
              </>
            )}

            <Card onPress={invite} style={styles.inviteCard}>
              <IconTile icon="share-social" colorKey="mint" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { color: colors.text, fontWeight: "700" }]}>Invite friends to Settle</Text>
                <Text style={[font.small, { color: colors.textSecondary }]}>
                  Share your link. Your username is @{profile?.username}
                </Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <ActionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.display_name}
        actions={
          menuFor
            ? [
                {
                  label: "Start an event together",
                  icon: "add-circle-outline",
                  onPress: () => router.push(`/new-event?with=${menuFor?.id}`),
                },
                {
                  label: "Remove friend",
                  icon: "person-remove-outline",
                  destructive: true,
                  onPress: async () => {
                    const ok = await confirm({
                      title: `Remove ${menuFor?.display_name}?`,
                      message: "You'll still share any events you're both in.",
                      confirmText: "Remove",
                      destructive: true,
                    });
                    if (ok) act(menuFor?.id, () => removeFriendship(menuFor?.friendshipId), "Friend removed");
                  },
                },
              ]
            : []
        }
      />
    </View>
  );
}

function PersonRow({ person, last, children, onPress }: any) {
  const content = (
    <>
      <Avatar id={person.id} name={person.display_name} uri={person.avatar_url} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: colors.text, fontWeight: "600" }]}>{person.display_name}</Text>
        <Text style={[font.small, { color: colors.textSecondary }]}>@{person.username}</Text>
      </View>
      {children}
    </>
  );
  const style = [styles.row, !last && styles.rowBorder];
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.98} style={style}>
      {content}
    </PressableScale>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
});
