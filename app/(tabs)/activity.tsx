import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Card,
  EmptyState,
  IconTile,
  PressableScale,
  SectionLabel,
  SkeletonRows,
} from "../../components/ui";
import { describeActivity, getLastSeen, loadActivity, markActivitySeen } from "../../lib/activity";
import { dayLabel, timeAgo, toDateKey } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { colors, font, money } from "../../lib/theme";
import useStore from "../../store/useStore";

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const setUnreadActivity = useStore((s) => s.setUnreadActivity);
  const [data, setData] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    setData(await loadActivity());
  }, []);

  // Opening the tab marks everything as seen (new items stay highlighted this visit)
  useFocusEffect(
    useCallback(() => {
      getLastSeen().then(setLastSeen);
      load();
      markActivitySeen();
      setUnreadActivity(0);
    }, [load, setUnreadActivity]),
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`activity-${userId}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(load, 300);
      })
      .subscribe();
    return () => {
      clearTimeout(timer.current);
      channel.unsubscribe();
    };
  }, [userId, load]);

  const groups = [];
  (data?.items || []).forEach((a) => {
    const label = dayLabel(toDateKey(a.created_at));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}
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
        <Text style={[font.title, { color: colors.text, marginBottom: 16 }]}>Activity</Text>

        {!data ? (
          <SkeletonRows count={5} />
        ) : !data.ready ? (
          <EmptyState
            icon="notifications"
            colorKey="blue"
            title="Activity is almost ready"
            body="It turns on after the latest database update is run in Supabase."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="notifications"
            colorKey="blue"
            title="Nothing yet"
            body="When friends add expenses or pay you back, it shows up here."
          />
        ) : (
          groups.map((g) => (
            <Animated.View key={g.label} layout={LinearTransition.springify()}>
              <SectionLabel style={{ marginTop: 6 }}>{g.label}</SectionLabel>
              <Card style={{ paddingVertical: 2, marginBottom: 14 }}>
                {g.items.map((a, i) => {
                  const d = describeActivity(a, userId, data.profiles, data.events);
                  const actor = data.profiles[a.actor_id];
                  const isNew = lastSeen && a.created_at > lastSeen && a.actor_id !== userId;
                  return (
                    <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 10) * 30).springify().damping(18)}>
                      <PressableScale
                        onPress={() => d.href && router.push(d.href)}
                        scaleTo={0.98}
                        style={[styles.row, i < g.items.length - 1 && styles.rowBorder]}
                      >
                        <View>
                          <Avatar id={a.actor_id} name={actor?.display_name} uri={actor?.avatar_url} size={40} />
                          <View style={styles.typeBadge}>
                            <IconTile icon={d.icon} colorKey={d.colorKey} size={18} />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[font.body, { color: colors.text, fontWeight: isNew ? "700" : "500" }]}>
                            {d.text}
                          </Text>
                          <Text style={[font.small, { color: colors.textSecondary }]}>
                            {[d.detail, timeAgo(a.created_at)].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        {d.amount ? (
                          <Text
                            style={[
                              font.h3,
                              money,
                              { color: d.tone === "mint" ? colors.mint : d.tone === "pink" ? colors.pink : colors.text },
                            ]}
                          >
                            {d.amount}
                          </Text>
                        ) : null}
                        {isNew && <View style={styles.dot} />}
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  typeBadge: {
    position: "absolute",
    right: -8,
    bottom: -6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
});
