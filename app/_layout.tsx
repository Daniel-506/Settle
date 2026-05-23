import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await handleSession(session);
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await handleSession(session);
    });
  }, []);

  async function handleSession(session) {
    if (!session) {
      router.replace("/login");
      return;
    }

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

  return <Stack screenOptions={{ headerShown: false }} />;
}
