// Sign in with Apple (native, iPhone only) and Google (browser sign-in).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { linkParams } from "./links";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export const SUGGESTED_NAME_KEY = "settle.suggestedName";

export async function appleSignInAvailable() {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

// Returns true if signed in, false if the user cancelled
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token.");
    // Apple only shares the name the very first time, so keep it for profile setup
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ");
    if (name) await AsyncStorage.setItem(SUGGESTED_NAME_KEY, name);
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    if (e?.code === "ERR_REQUEST_CANCELED") return false;
    throw e;
  }
}

// Supabase's own Google sign-in page in a browser sheet, then back into the app
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL("/login");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return false;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  return completeSignInFromUrl(result.url);
}

// Finishes a sign-in from a redirect URL that carries tokens or a code
export async function completeSignInFromUrl(url) {
  const params = linkParams(url);
  if (params.error_description) throw new Error(params.error_description);
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return true;
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }
  return false;
}

// "email", "apple", "google"...
export function signInMethod(user) {
  return user?.app_metadata?.provider || "email";
}
