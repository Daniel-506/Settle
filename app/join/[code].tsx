import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, Skeleton, toast } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, font } from "../../lib/theme";

// Opened from an invite link or QR code: settle://join/ABC123
export default function JoinScreen() {
  const { code } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    supabase.rpc("join_event", { p_code: String(code) }).then(({ data, error: e }) => {
      if (e) {
        setError(e.message.includes("match") ? "That invite link doesn't match any event. It may have been deleted." : e.message);
        return;
      }
      toast("You're in");
      router.replace(`/event/${data}`);
    });
  }, [code]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 80, paddingHorizontal: 24 }}>
      {error ? (
        <EmptyState
          icon="alert-circle"
          colorKey="pink"
          title="Couldn't join"
          body={error}
          action={<Button title="Go home" onPress={() => router.replace("/home")} />}
        />
      ) : (
        <View style={{ alignItems: "center", gap: 14 }}>
          <Skeleton width={64} height={64} radius={20} />
          <Text style={[font.body, { color: colors.textSecondary }]}>Joining event…</Text>
        </View>
      )}
    </View>
  );
}
