import { site } from "@/config/site";

const money = new Intl.NumberFormat(site.market.locale, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** "GH₵ 1,500" — prices are stored in cedis. */
export function formatPrice(value: number | string | null | undefined, currency = "GHS") {
  if (value === null || value === undefined || value === "") return "Contact for price";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "Contact for price";
  const symbol = currency === "GHS" ? site.market.currencySymbol : currency;
  return `${symbol} ${money.format(n)}`;
}

const dateFmt = new Intl.DateTimeFormat(site.market.locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: site.market.timezone,
});
const timeFmt = new Intl.DateTimeFormat(site.market.locale, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: site.market.timezone,
});

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return dateFmt.format(new Date(value));
}

export function formatTime(value: string | Date) {
  return timeFmt.format(new Date(value));
}

/** "just now", "5 min ago", "3 days ago", then a date. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()) {
  if (!value) return "";
  const then = new Date(value);
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(then);
}

export const conditionLabel: Record<string, string> = {
  new: "Brand new",
  used: "Used",
  refurbished: "Refurbished",
  not_applicable: "",
};

export const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending_review: "In review",
  published: "Live",
  paused: "Paused",
  sold: "Sold",
  rejected: "Not approved",
  expired: "Expired",
  removed: "Removed",
};

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString(site.market.locale)} ${n === 1 ? one : many}`;
}
