import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  AvatarStack,
  Button,
  Card,
  EmptyState,
  IconTile,
  PressableScale,
  SectionLabel,
  Skeleton,
  SkeletonRows,
} from "../../components/ui";
import EventActions from "../../components/EventActions";
import { formatMoney } from "../../lib/format";
import { loadOverview } from "../../lib/overview";
import { supabase } from "../../lib/supabase";
import { colorForId, colors, font, money, radius } from "../../lib/theme";
import useStore from "../../store/useStore";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const profile = useStore((s) => s.profile);
  const friendRequests = useStore((s) => s.friendRequests);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [menuEvent, setMenuEvent] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setData(await loadOverview(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live updates (batched so a burst of changes is one reload)
  useEffect(() => {
    if (!userId) return;
    const reload = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    const channel = supabase.channel(`home-${userId}-${Date.now()}`);
    ["events", "event_members", "expenses", "payments"].forEach((table) =>
      channel.on("postgres_changes", { event: "*", schema: "public", table }, reload),
    );
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      channel.unsubscribe();
    };
  }, [userId, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const events = data?.events || [];
  const active = events.filter((e) => e.status !== "finished");
  const past = events.filter((e) => e.status === "finished");
  const net = (data?.totals.owed || 0) - (data?.totals.owe || 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mint} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.topRow}>
          <View>
            <Text style={[font.small, { color: colors.textSecondary }]}>{greeting()}</Text>
            <Text style={[font.title, { color: colors.text }]}>
              {profile?.display_name?.split(" ")[0] || "Hey"}
            </Text>
          </View>
          <PressableScale onPress={() => router.navigate("/account")} accessibilityLabel="Your profile">
            <Avatar id={userId} name={profile?.display_name} uri={profile?.avatar_url} size={44} />
          </PressableScale>
        </View>

        {/* Overall balance */}
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <Card style={styles.balanceCard}>
            <Text style={[font.label, { color: colors.textSecondary }]}>Overall</Text>
            {data ? (
              <Text
                style={[
                  font.hero,
                  money,
                  {
                    color: net > 0.004 ? colors.mint : net < -0.004 ? colors.pink : colors.text,
                    marginTop: 4,
                  },
                ]}
              >
                {Math.abs(net) < 0.005 ? "All settled" : formatMoney(net, { sign: true })}
              </Text>
            ) : (
              <Skeleton width={160} height={38} style={{ marginTop: 6 }} />
            )}
            <View style={styles.balanceSplit}>
              <View style={{ flex: 1 }}>
                <Text style={[font.small, { color: colors.textSecondary }]}>You&apos;re owed</Text>
                <Text style={[font.h2, money, { color: colors.mint }]}>
                  {formatMoney(data?.totals.owed || 0)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1 }}>
                <Text style={[font.small, { color: colors.textSecondary }]}>You owe</Text>
                <Text style={[font.h2, money, { color: colors.pink }]}>
                  {formatMoney(data?.totals.owe || 0)}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Friend requests */}
        {friendRequests > 0 && (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Card onPress={() => router.navigate("/friends")} style={styles.requestBanner}>
              <IconTile icon="people" colorKey="purple" size={36} />
              <Text style={[font.body, { color: colors.text, flex: 1, fontWeight: "600" }]}>
                {friendRequests} friend request{friendRequests === 1 ? "" : "s"}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </Animated.View>
        )}

        {/* Events */}
        <SectionLabel style={{ marginTop: 22 }}>Active events</SectionLabel>
        {!data ? (
          <SkeletonRows count={3} />
        ) : active.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="Start your first event"
            body="Make an event for a trip, a dinner or your apartment, then add what everyone spent."
            action={<Button title="New event" icon="add" onPress={() => router.push("/new-event")} />}
          />
        ) : (
          active.map((e, i) => (
            <EventCard
              key={e.id}
              event={e}
              index={i}
              onLongPress={() => e.created_by === userId && setMenuEvent(e)}
            />
          ))
        )}

        {past.length > 0 && (
          <>
            <PressableScale onPress={() => setShowPast(!showPast)} style={styles.pastToggle}>
              <Text style={[font.label, { color: colors.textSecondary }]}>
                Past events · {past.length}
              </Text>
              <Ionicons
                name={showPast ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </PressableScale>
            {showPast &&
              past.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={i}
                  past
                  onLongPress={() => e.created_by === userId && setMenuEvent(e)}
                />
              ))}
          </>
        )}
      </ScrollView>

      <EventActions
        event={menuEvent}
        visible={!!menuEvent}
        onClose={() => setMenuEvent(null)}
        onChanged={load}
      />
    </View>
  );
}

function EventCard({ event, index, past, onLongPress }: any) {
  const b = event.myBalance;
  const settled = Math.abs(b) < 0.005;
  const colorKey = event.color || colorForId(String(event.id)).key;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).springify().damping(18)}
      layout={LinearTransition.springify()}
      style={{ marginBottom: 10, opacity: past ? 0.6 : 1 }}
    >
      <Card
        onPress={() => router.push(`/event/${event.id}`)}
        onLongPress={onLongPress}
        style={styles.eventCard}
      >
        <IconTile icon={event.icon || "receipt"} colorKey={colorKey} size={44} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[font.h3, { color: colors.text }]} numberOfLines={1}>
            {event.name}
          </Text>
          <AvatarStack people={event.members} size={22} />
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[font.caption, { color: colors.textSecondary }]}>
            {settled ? (event.expenseCount ? "settled" : "no expenses") : b > 0 ? "you're owed" : "you owe"}
          </Text>
          {!settled && (
            <Text style={[font.h3, money, { color: b > 0 ? colors.mint : colors.pink }]}>
              {formatMoney(b)}
            </Text>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  balanceCard: {
    padding: 18,
    borderRadius: radius.xl,
  },
  balanceSplit: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pastToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 10,
  },
});
