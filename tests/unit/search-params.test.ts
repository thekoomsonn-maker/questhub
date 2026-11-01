import { describe, expect, it } from "vitest";
import { parseSearchParams, searchHref } from "@/lib/search-params";

describe("parseSearchParams", () => {
  it("defaults to newest without a query and relevance with one", () => {
    expect(parseSearchParams({}).sort).toBe("newest");
    expect(parseSearchParams({ q: "iphone" }).sort).toBe("relevance");
  });
  it("rejects unknown sorts, conditions and out-of-range regions", () => {
    const p = parseSearchParams({ sort: "drop table", condition: "stolen", region: "99" });
    expect(p.sort).toBe("newest");
    expect(p.condition).toBeUndefined();
    expect(p.regionId).toBeUndefined();
  });
  it("swaps reversed price ranges and ignores non-numbers", () => {
    expect(parseSearchParams({ min: "500", max: "100" })).toMatchObject({ minPrice: 100, maxPrice: 500 });
    expect(parseSearchParams({ min: "abc" }).minPrice).toBeUndefined();
  });
  it("keeps only allowed attribute filters and validates numeric ranges", () => {
    const p = parseSearchParams({ make: "Toyota", year_min: "2010", year_max: "soon", hacker: "1" }, ["make", "year"]);
    expect(p.attrs).toEqual({ make: "Toyota", year_min: "2010" });
  });
  it("clamps the page and truncates long queries", () => {
    expect(parseSearchParams({ page: "-3" }).page).toBe(1);
    expect(parseSearchParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("searchHref", () => {
  it("changes params and resets the page", () => {
    expect(searchHref("/search", { q: "tv", page: "3" }, { sort: "price_asc" })).toBe("/search?q=tv&sort=price_asc");
    expect(searchHref("/search", { q: "tv" }, { page: 2 })).toBe("/search?q=tv&page=2");
    expect(searchHref("/search", { q: "tv" }, { q: null })).toBe("/search");
  });
});
