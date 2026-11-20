import { Redirect } from "expo-router";

// Profile moved into the tab bar
export default function ProfileRedirect() {
  return <Redirect href="/account" />;
}
