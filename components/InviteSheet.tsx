import { setStringAsync } from "expo-clipboard";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { inviteLink } from "../lib/links";
import { shareText } from "../lib/share";
import { colors, font, radius } from "../lib/theme";
import { Button, Sheet, toast } from "./ui";

// QR code + code + share for joining an event
export default function InviteSheet({ visible, onClose, event }: any) {
  const code = event?.invite_code;
  const link = code ? inviteLink(code) : "";

  const share = () =>
    shareText(
      `Join "${event?.name}" on Settle so we can split costs.\n\nTap: ${link}\nOr open Settle, tap + then "Join with a code" and enter ${code}`,
      "Invite copied. Paste it in a message",
    );

  return (
    <Sheet visible={visible} onClose={onClose} title="Invite people">
      {!code ? (
        <Text style={[font.body, { color: colors.textSecondary, marginBottom: 12 }]}>
          Invite codes turn on after the latest database update is run in Supabase.
        </Text>
      ) : (
        <>
          <Text style={[font.body, { color: colors.textSecondary, marginBottom: 18 }]}>
            Anyone with the code can join {event?.name}. They can scan the QR code with their
            phone camera.
          </Text>
          <View style={styles.qrWrap}>
            <View style={styles.qr}>
              <QRCode value={link} size={170} backgroundColor="#FFFFFF" color="#0E0E12" />
            </View>
            <Text style={styles.code}>{code}</Text>
            <Text style={[font.small, { color: colors.textMuted }]}>Invite code</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="Copy code"
              icon="copy-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={async () => {
                await setStringAsync(code);
                toast("Code copied");
              }}
            />
            <Button title="Share" icon="share-social-outline" style={{ flex: 1 }} onPress={share} />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  qrWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    paddingVertical: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qr: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    marginBottom: 14,
  },
  code: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 8,
  },
});
