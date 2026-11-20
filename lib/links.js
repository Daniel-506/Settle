// Deep links. Shared links always use the real app's scheme (settle://) so
// they open the App Store build, even when sent from a dev build.

export const APP_SCHEME = "settle";

export function inviteLink(code) {
  return `${APP_SCHEME}://join/${code}`;
}

export function friendLink(username) {
  return `${APP_SCHEME}://friend/${username}`;
}

// Reads ?a=1&b=2 and #a=1&b=2 parts of a URL into an object
// (Supabase puts login tokens after the #).
export function linkParams(url = "") {
  const out = {};
  const parts = [url.split("#")[1], url.split("?")[1]?.split("#")[0]];
  parts.filter(Boolean).forEach((part) => {
    part.split("&").forEach((pair) => {
      if (!pair) return;
      const [key, value = ""] = pair.split("=");
      try {
        out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
      } catch {
        out[key] = value;
      }
    });
  });
  return out;
}
