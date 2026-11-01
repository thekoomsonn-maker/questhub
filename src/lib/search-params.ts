import type { SortOption } from "@/lib/data/listings";

type Raw = Record<string, string | string[] | undefined>;
const CONDITIONS = ["new", "used", "refurbished", "not_applicable"] as const;
const SORTS: SortOption[] = ["relevance", "newest", "price_asc", "price_desc"];
const RESERVED = new Set(["q", "min", "max", "region", "condition", "sort", "page", "category"]);

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function num(v: string | undefined, { int = false, min = 0, max = 1e10 } = {}) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return int ? Math.trunc(n) : n;
}

/** Parses and sanitises URL search params for listing search. Pure; unit-tested. */
export function parseSearchParams(raw: Raw, allowedAttrKeys: string[] = []) {
  const q = one(raw.q)?.slice(0, 100);
  const condition = CONDITIONS.find((c) => c === one(raw.condition));
  const sortRaw = one(raw.sort) as SortOption | undefined;
  const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : q ? "relevance" : "newest";

  let minPrice = num(one(raw.min));
  let maxPrice = num(one(raw.max));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];

  const attrs: Record<string, string> = {};
  const allowed = new Set(allowedAttrKeys.flatMap((k) => [k, `${k}_min`, `${k}_max`]));
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED.has(key) || !allowed.has(key)) continue;
    const v = one(value);
    if (!v) continue;
    if (/_m(in|ax)$/.test(key) && num(v) === undefined) continue;
    attrs[key] = v.slice(0, 80);
  }

  return {
    q,
    minPrice,
    maxPrice,
    regionId: num(one(raw.region), { int: true, min: 1, max: 16 }),
    condition,
    sort,
    page: num(one(raw.page), { int: true, min: 1, max: 1000 }) ?? 1,
    attrs,
  };
}

export type ParsedSearch = ReturnType<typeof parseSearchParams>;

/** Builds a URL for the same search with some params changed. */
export function searchHref(base: string, current: Raw, changes: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = one(v);
    if (val) params.set(k, val);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  if (!("page" in changes)) params.delete("page");
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
