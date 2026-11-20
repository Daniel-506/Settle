// Money and date formatting

export function formatMoney(amount, { sign = false } = {}) {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100) / 100;
  const [whole, cents] = value.toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = sign ? (amount > 0.004 ? "+" : amount < -0.004 ? "−" : "") : "";
  return `${prefix}$${withCommas}.${cents}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "2026-11-19" for a Date, in local time
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Local Date from "2026-11-19" (avoids the UTC off-by-one-day bug)
export function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function dayLabel(key) {
  const today = todayKey();
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const d = fromDateKey(key);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? "" : `, ${d.getFullYear()}`}`;
}

export function shortDate(key) {
  const d = fromDateKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function monthLabel(year, month) {
  const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${full[month]} ${year}`;
}

export function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return shortDate(toDateKey(new Date(iso)));
}

export function initials(name) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

// "Danny", "Danny and Jake", "Danny, Jake and 3 others"
export function nameList(names, max = 2) {
  if (names.length <= max) return names.join(" and ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} other${names.length - max === 1 ? "" : "s"}`;
}
