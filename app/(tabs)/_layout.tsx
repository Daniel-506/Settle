import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import JoinEventSheet from "../../components/JoinEventSheet";
import {
  ActionSheet,
  CountBadge,
  PressableScale,
  haptic,
} from "../../components/ui";
import { countUnread } from "../../lib/activity";
import { loadFriends } from "../../lib/friends";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import useStore from "../../store/useStore";

const TABS = [
  { name: "home", icon: "home", label: "Home" },
  { name: "friends", icon: "people", label: "Friends", badge: "friendRequests" },
  { name: "__plus__" },
  { name: "activity", icon: "notifications", label: "Activity", badge: "unreadActivity" },
  { name: "account", icon: "person", label: "Profile" },
];

export default function TabsLayout() {
  const userId = useStore((s) => s.userId);
  const setFriendRequests = useStore((s) => s.setFriendRequests);
  const setUnreadActivity = useStore((s) => s.setUnreadActivity);

  // Keep the tab badges up to date
  const refreshBadges = useCallback(async () => {
    if (!userId) return;
    const [friends, unread] = await Promise.all([loadFriends(userId), countUnread(userId)]);
    setFriendRequests(friends.incoming.length);
    setUnreadActivity(unread);
  }, [userId, setFriendRequests, setUnreadActivity]);

  useEffect(() => {
    refreshBadges();
    if (!userId) return;
    const channel = supabase
      .channel(`badges-${userId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refreshBadges)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, refreshBadges)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [userId, refreshBadges]);

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  // (separate selectors: zustand v5 re-renders forever on new objects)
  const friendRequests = useStore((s) => s.friendRequests);
  const unreadActivity = useStore((s) => s.unreadActivity);
  const counts = { friendRequests, unreadActivity };
  const [menuOpen, setMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const current = state.routes[state.index]?.name;

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {TABS.map((tab) => {
          if (tab.name === "__plus__") {
            return <PlusButton key="plus" onPress={() => setMenuOpen(true)} />;
          }
          return (
            <TabItem
              key={tab.name}
              tab={tab}
              active={current === tab.name}
              badge={tab.badge ? counts[tab.badge] : 0}
              onPress={() => {
                haptic("select");
                navigation.navigate(tab.name);
              }}
            />
          );
        })}
      </View>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Create"
        actions={[
          { label: "New event", icon: "add-circle-outline", onPress: () => router.push("/new-event") },
          { label: "Join with a code", icon: "enter-outline", onPress: () => setJoinOpen(true) },
          { label: "Add a friend", icon: "person-add-outline", onPress: () => navigation.navigate("friends") },
        ]}
      />
      <JoinEventSheet visible={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}

function TabItem({ tab, active, badge, onPress }: any) {
  const color = active ? colors.mint : colors.textMuted;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      <View>
        <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={23} color={color} />
        <CountBadge count={badge} />
      </View>
      <Text style={[styles.label, { color }]}>{tab.label}</Text>
    </PressableScale>
  );
}

function PlusButton({ onPress }: any) {
  return (
    <View style={styles.tab}>
      <PressableScale
        onPress={onPress}
        hapticOnPress="medium"
        accessibilityRole="button"
        accessibilityLabel="Create"
        style={styles.plus}
      >
        <Ionicons name="add" size={30} color={colors.onMint} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  plus: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.bg,
  },
});
