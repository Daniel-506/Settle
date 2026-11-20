import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatMoney } from "./format";
import { categoryFor } from "./theme";
import { supabase } from "./supabase";

const SEEN_KEY = "settle.activity.lastSeen";

export async function loadActivity(limit = 80) {
  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { items: [], profiles: {}, events: {}, ready: false };

  const items = data || [];
  const userIds = new Set();
  const eventIds = new Set();
  items.forEach((a) => {
    [a.actor_id, a.target_user_id, a.data?.from_id, a.data?.to_id, a.data?.paid_by_id]
      .filter(Boolean)
      .forEach((id) => userIds.add(id));
    if (a.event_id) eventIds.add(a.event_id);
  });
  const [profilesRes, eventsRes] = await Promise.all([
    userIds.size
      ? supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", [...userIds])
      : { data: [] },
    eventIds.size
      ? supabase.from("events").select("id, name, icon, color").in("id", [...eventIds])
      : { data: [] },
  ]);
  return {
    items,
    profiles: Object.fromEntries((profilesRes.data || []).map((p) => [p.id, p])),
    events: Object.fromEntries((eventsRes.data || []).map((e) => [e.id, e])),
    ready: true,
  };
}

// Turns an activity row into display text.
// { text, detail, icon, colorKey, amount, tone, href }
export function describeActivity(a, me, profiles, events) {
  const name = (id, capital = true) =>
    id === me
      ? capital
        ? "You"
        : "you"
      : (profiles[id]?.display_name || "Someone").split(" ")[0];
  const event = events[a.event_id];
  const eventName = event?.name || "an event";
  const href = a.event_id ? `/event/${a.event_id}` : null;
  const d = a.data || {};

  switch (a.type) {
    case "expense_added": {
      const cat = categoryFor(d.category);
      return {
        text: `${name(a.actor_id)} added ${d.name || "an expense"}`,
        detail: eventName,
        icon: cat.icon,
        colorKey: cat.color,
        amount: formatMoney(d.amount),
        tone: "neutral",
        href,
      };
    }
    case "payment": {
      const toMe = d.to_id === me;
      const fromMe = d.from_id === me;
      return {
        text: `${name(d.from_id)} paid ${name(d.to_id, false)}`,
        detail: eventName,
        icon: "cash",
        colorKey: "mint",
        amount: formatMoney(d.amount),
        tone: toMe ? "mint" : fromMe ? "pink" : "neutral",
        href,
      };
    }
    case "member_added":
      return {
        text:
          a.target_user_id === me
            ? `${name(a.actor_id)} added you to ${eventName}`
            : `${name(a.actor_id)} added ${name(a.target_user_id, false)} to ${eventName}`,
        icon: "person-add",
        colorKey: "blue",
        href,
      };
    case "member_joined":
      return {
        text: `${name(a.actor_id)} joined ${eventName}`,
        icon: "enter",
        colorKey: "blue",
        href,
      };
    case "event_created":
      return {
        text: `${name(a.actor_id)} created ${eventName}`,
        icon: event?.icon || "sparkles",
        colorKey: event?.color || "purple",
        href,
      };
    case "friend_request":
      return {
        text:
          a.target_user_id === me
            ? `${name(a.actor_id)} sent you a friend request`
            : `You sent ${name(a.target_user_id, false)} a friend request`,
        icon: "people",
        colorKey: "purple",
        href: "/friends",
      };
    case "friend_accepted":
      return {
        text:
          a.target_user_id === me
            ? `${name(a.actor_id)} accepted your friend request`
            : `You and ${name(a.target_user_id, false)} are now friends`,
        icon: "people",
        colorKey: "mint",
        href: "/friends",
      };
    default:
      return { text: "Something happened", icon: "sparkles", colorKey: "blue", href };
  }
}

export async function getLastSeen() {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) || "1970-01-01T00:00:00Z";
  } catch {
    return "1970-01-01T00:00:00Z";
  }
}

export async function markActivitySeen() {
  try {
    await AsyncStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {}
}

// Number of things other people did since you last opened Activity
export async function countUnread(me) {
  const since = await getLastSeen();
  const { count, error } = await supabase
    .from("activity")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since)
    .neq("actor_id", me);
  return error ? 0 : count || 0;
}
