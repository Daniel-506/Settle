import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (!session) {
        router.replace("/login");
      } else {
        // Check if user has a profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          router.replace("/setup-profile");
        } else {
          router.replace("/");
        }
      }
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (!session) {
        router.replace("/login");
      }
    });
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
