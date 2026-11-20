import { create } from "zustand";
import { supabase } from "../lib/supabase";

// Shared app state: who's signed in, their profile, and tab badge counts.
const useStore = create((set, get) => ({
  // null = still checking, true/false once we know
  hasProfile: null,
  setHasProfile: (hasProfile) => set({ hasProfile }),

  userId: null,
  setUserId: (userId) => set({ userId }),

  profile: null,
  setProfile: (profile) => set({ profile }),
  refreshProfile: async () => {
    const userId = get().userId;
    if (!userId) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    set({ profile: data || null });
    return data;
  },

  // A join/friend link opened before signing in, handled after login
  pendingLink: null,
  setPendingLink: (pendingLink) => set({ pendingLink }),

  // Tab badges
  friendRequests: 0,
  setFriendRequests: (friendRequests) => set({ friendRequests }),
  unreadActivity: 0,
  setUnreadActivity: (unreadActivity) => set({ unreadActivity }),

  // Bumped whenever data changes, so screens can refresh
  dataVersion: 0,
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));

export default useStore;
