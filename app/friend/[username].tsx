import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, EmptyState, Header, Skeleton, toast } from "../../components/ui";
import { loadFriends, sendFriendRequest } from "../../lib/friends";
import { supabase } from "../../lib/supabase";
import { colors, font } from "../../lib/theme";
import useStore from "../../store/useStore";
import { enter } from "../../lib/motion";

// Opened from a friend invite link: settle://friend/danny
export default function FriendLinkScreen() {
  const { username } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const [person, setPerson] = useState(undefined);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!username || !userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", String(username).toLowerCase())
        .maybeSingle();
      setPerson(data || null);
      if (data) {
        const friends = await loadFriends(userId);
        setStatus(data.id === userId ? "self" : friends.statusById[data.id] || null);
      }
    })();
  }, [username, userId]);

  const add = async () => {
    setBusy(true);
    try {
      const result = await sendFriendRequest(person?.id);
      setStatus(result === "friends" ? "friends" : "outgoing");
      toast(result === "friends" ? `You and ${person?.display_name} are now friends` : "Friend request sent");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      <Header title="" onBack={() => router.replace("/friends")} />
      <View style={{ paddingHorizontal: 24, paddingTop: 30, alignItems: "center" }}>
        {person === undefined ? (
          <Skeleton width={110} height={110} radius={55} />
        ) : person === null ? (
          <EmptyState icon="person" colorKey="pink" title="No one found" body={`There's no Settle user called @${username}.`} />
        ) : (
          <>
            <Animated.View entering={enter}>
              <Avatar id={person.id} name={person.display_name} uri={person.avatar_url} size={110} ring={colors.mint} />
            </Animated.View>
            <Animated.View entering={enter} style={{ alignItems: "center", marginTop: 16, marginBottom: 26 }}>
              <Text style={[font.title, { color: colors.text }]}>{person.display_name}</Text>
              <Text style={[font.body, { color: colors.textSecondary }]}>@{person.username}</Text>
            </Animated.View>
            {status === "self" ? (
              <Text style={[font.body, { color: colors.textSecondary }]}>That&apos;s you.</Text>
            ) : status === "friends" ? (
              <Button title="You're friends" icon="checkmark" variant="mintSoft" style={{ alignSelf: "stretch" }} onPress={() => router.replace("/friends")} />
            ) : status === "outgoing" ? (
              <Button title="Request sent" variant="secondary" style={{ alignSelf: "stretch" }} onPress={() => router.replace("/friends")} />
            ) : (
              <Button
                title={status === "incoming" ? "Accept friend request" : "Add friend"}
                icon="person-add-outline"
                loading={busy}
                style={{ alignSelf: "stretch" }}
                onPress={add}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}
