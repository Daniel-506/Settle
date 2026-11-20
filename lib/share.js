import { setStringAsync } from "expo-clipboard";
import { Share } from "react-native";
import { toast } from "../components/ui";

// Opens the phone's share sheet. Where sharing isn't available (most desktop
// browsers), copies the message instead so the button still does something.
export async function shareText(message, copiedLabel = "Copied. Paste it anywhere") {
  try {
    await Share.share({ message });
  } catch {
    try {
      await setStringAsync(message);
      toast(copiedLabel, "info");
    } catch {
      toast("Couldn't share or copy on this device", "error");
    }
  }
}
