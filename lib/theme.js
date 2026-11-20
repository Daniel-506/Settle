// Settle design tokens. Mint = money coming to you, pink = money you owe.

export const colors = {
  bg: "#0E0E12",
  surface: "#17171D",
  surfaceRaised: "#1E1E26",
  surfacePressed: "#26262F",
  border: "#25252E",
  borderStrong: "#33333E",

  text: "#F5F5F7",
  textSecondary: "#9A9AA5",
  textMuted: "#6B6B76",

  mint: "#3DDCB2",
  mintSoft: "#13241F",
  mintBorder: "#22443A",
  onMint: "#062A20",

  pink: "#FF6B8B",
  pinkSoft: "#28131A",
  pinkBorder: "#4A2430",

  white: "#F5F5F7",
  onWhite: "#0E0E12",
  overlay: "rgba(0,0,0,0.6)",
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const font = {
  hero: { fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "500" },
  small: { fontSize: 13, fontWeight: "500" },
  caption: { fontSize: 12, fontWeight: "600" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
};

export const money = { fontVariant: ["tabular-nums"] };

// Browsers draw a focus box around text inputs; the app shows its own focus state
export const noOutline = { outlineStyle: "none", outlineWidth: 0 };

// Soft background + bright foreground pairs for avatars, event icons, etc.
export const palette = [
  { key: "mint", fg: "#3DDCB2", bg: "#13302A" },
  { key: "pink", fg: "#FF8FA8", bg: "#3A1E26" },
  { key: "blue", fg: "#8EC2FF", bg: "#1C2C3C" },
  { key: "purple", fg: "#B4A5FF", bg: "#2A2442" },
  { key: "amber", fg: "#FFC170", bg: "#3A2C1A" },
  { key: "lime", fg: "#B8E86B", bg: "#26321A" },
  { key: "red", fg: "#FF8A7A", bg: "#3A201C" },
  { key: "teal", fg: "#6FE0E8", bg: "#163238" },
];

export function paletteFor(key) {
  return palette.find((p) => p.key === key) || palette[0];
}

// Same person always gets the same colour
export function colorForId(id = "") {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

// Ionicons names
export const EVENT_ICONS = [
  "restaurant",
  "beer",
  "airplane",
  "car",
  "home",
  "gift",
  "musical-notes",
  "football",
  "sunny",
  "cafe",
  "cart",
  "heart",
];

export const CATEGORIES = [
  {
    key: "food",
    label: "Food",
    icon: "restaurant",
    color: "pink",
    words: ["pizza", "sushi", "dinner", "lunch", "breakfast", "brunch", "food", "restaurant", "burger", "salmon", "chicken", "steak", "bbq", "taco", "wings", "shawarma", "pho", "ramen", "kbbq", "doordash", "ubereats", "uber eats", "skip", "mcdonald", "takeout", "snack", "dessert", "ice cream"],
  },
  {
    key: "groceries",
    label: "Groceries",
    icon: "cart",
    color: "lime",
    words: ["grocer", "costco", "walmart", "no frills", "loblaws", "metro", "sobeys", "freshco", "food basics", "market", "supplies"],
  },
  {
    key: "drinks",
    label: "Drinks",
    icon: "wine",
    color: "purple",
    words: ["drink", "beer", "wine", "bar", "lcbo", "beer store", "shots", "cocktail", "alcohol", "vodka", "tequila", "pub", "club", "bottle"],
  },
  {
    key: "coffee",
    label: "Coffee",
    icon: "cafe",
    color: "amber",
    words: ["coffee", "starbucks", "tim horton", "timmies", "latte", "cafe", "tea", "bubble tea", "boba"],
  },
  {
    key: "transport",
    label: "Transport",
    icon: "car",
    color: "blue",
    words: ["uber", "lyft", "taxi", "gas", "fuel", "parking", "train", "bus", "presto", "ttc", "go transit", "flight", "plane", "car rental", "toll", "407", "via rail"],
  },
  {
    key: "stay",
    label: "Stay",
    icon: "bed",
    color: "teal",
    words: ["hotel", "airbnb", "motel", "hostel", "cottage", "cabin", "booking", "stay", "rent"],
  },
  {
    key: "fun",
    label: "Fun",
    icon: "ticket",
    color: "red",
    words: ["movie", "cinema", "ticket", "concert", "game", "bowling", "karaoke", "arcade", "show", "festival", "golf", "ski", "escape room"],
  },
  {
    key: "bills",
    label: "Bills",
    icon: "flash",
    color: "mint",
    words: ["hydro", "internet", "wifi", "phone", "utilities", "bill", "netflix", "spotify", "subscription", "electric", "water"],
  },
  { key: "other", label: "Other", icon: "receipt", color: "blue", words: [] },
];

export function categoryFor(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

export function guessCategory(name = "") {
  const text = name.toLowerCase();
  if (!text.trim()) return null;
  for (const c of CATEGORIES) {
    if (c.words.some((w) => text.includes(w))) return c.key;
  }
  return null;
}
