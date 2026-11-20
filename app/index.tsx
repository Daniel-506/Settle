import { Redirect } from "expo-router";

// The home screen lives in the tab bar now
export default function Index() {
  return <Redirect href="/home" />;
}
