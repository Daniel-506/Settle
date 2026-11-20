import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { supabase } from "../lib/supabase";
import { colors, font } from "../lib/theme";
import { Button, Sheet, TextField, toast } from "./ui";

// Join an event by typing the 6-letter code from an invite
export default function JoinEventSheet({ visible, onClose }: any) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 6) {
      setError("Invite codes are 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("join_event", { p_code: clean });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message.includes("match") ? "That code doesn't match any event." : rpcError.message);
      return;
    }
    setCode("");
    onClose();
    toast("You're in");
    router.push(`/event/${data}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Join an event">
      <Text style={[font.body, { color: colors.textSecondary, marginBottom: 16 }]}>
        Enter the invite code a friend shared with you.
      </Text>
      <TextField
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        inputStyle={{ fontSize: 24, letterSpacing: 6, fontWeight: "800", textAlign: "center" }}
        onSubmitEditing={join}
      />
      {error ? (
        <Text style={[font.small, { color: colors.pink, marginBottom: 12 }]}>{error}</Text>
      ) : null}
      <Button title="Join event" icon="enter-outline" loading={loading} onPress={join} />
    </Sheet>
  );
}
