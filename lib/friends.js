import { supabase } from "./supabase";

const PROFILE_FIELDS = "id, username, display_name, avatar_url";

// { friends, incoming, outgoing, statusById, ready }
// statusById[userId] = "friends" | "incoming" | "outgoing"
export async function loadFriends(userId) {
  const { data: rows, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) {
    // Table missing = the friends SQL hasn't been run yet
    return { friends: [], incoming: [], outgoing: [], statusById: {}, ready: false };
  }
  const otherId = (r) => (r.requester_id === userId ? r.addressee_id : r.requester_id);
  const ids = [...new Set((rows || []).map(otherId))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select(PROFILE_FIELDS).in("id", ids)
    : { data: [] };
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const friends = [];
  const incoming = [];
  const outgoing = [];
  const statusById = {};
  for (const r of rows || []) {
    const person = byId[otherId(r)];
    if (!person) continue;
    const entry = { ...person, friendshipId: r.id, since: r.created_at };
    if (r.status === "accepted") {
      friends.push(entry);
      statusById[person.id] = "friends";
    } else if (r.addressee_id === userId) {
      incoming.push(entry);
      statusById[person.id] = "incoming";
    } else {
      outgoing.push(entry);
      statusById[person.id] = "outgoing";
    }
  }
  const byName = (a, b) => (a.display_name || "").localeCompare(b.display_name || "");
  friends.sort(byName);
  return { friends, incoming, outgoing, statusById, ready: true };
}

// Returns "pending" or "friends" (if they'd already asked you)
export async function sendFriendRequest(otherUserId) {
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_user: otherUserId,
  });
  if (error) throw error;
  return data;
}

export async function acceptFriend(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);
  if (error) throw error;
}

// Decline, cancel or unfriend
export async function removeFriendship(friendshipId) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

// People you've been in events with, most shared events first
export async function loadRecentPeople(userId, limit = 12) {
  const { data: mine } = await supabase
    .from("event_members")
    .select("event_id")
    .eq("user_id", userId);
  const eventIds = [...new Set((mine || []).map((r) => r.event_id))];
  if (eventIds.length === 0) return [];
  const { data: rows } = await supabase
    .from("event_members")
    .select("event_id, user_id")
    .in("event_id", eventIds);
  const counts = {};
  (rows || []).forEach((r) => {
    if (r.user_id !== userId) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
  });
  const ids = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", ids);
  return (profiles || [])
    .map((p) => ({ ...p, sharedEvents: counts[p.id] }))
    .sort((a, b) => b.sharedEvents - a.sharedEvents);
}

export async function searchPeople(text, excludeIds = []) {
  const q = text.trim().replace(/^@/, "").toLowerCase();
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .ilike("username", `%${q}%`)
    .limit(8);
  return (data || []).filter((p) => !excludeIds.includes(p.id));
}
