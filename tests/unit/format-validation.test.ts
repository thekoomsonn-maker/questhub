import { describe, expect, it } from "vitest";
import { formatPrice, timeAgo } from "@/lib/format";
import { ghanaPhone, listingSchema, registerSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/utils";

describe("formatPrice", () => {
  it("formats cedis and handles missing prices", () => {
    expect(formatPrice(98000)).toBe("GH₵ 98,000");
    expect(formatPrice("1500.5")).toBe("GH₵ 1,500.5");
    expect(formatPrice(null)).toBe("Contact for price");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("uses relative wording for recent times", () => {
    expect(timeAgo("2026-11-01T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-01T11:00:00Z", now)).toBe("1 hr ago");
    expect(timeAgo("2026-10-29T12:00:00Z", now)).toBe("3 days ago");
  });
});

describe("validation", () => {
  it("accepts Ghanaian phone formats", () => {
    expect(ghanaPhone.safeParse("024 123 4567").success).toBe(true);
    expect(ghanaPhone.safeParse("+233 20 123 4567").success).toBe(true);
    expect(ghanaPhone.safeParse("12345").success).toBe(false);
  });
  it("requires a strong password and accepted terms", () => {
    expect(registerSchema.safeParse({ displayName: "Ama", email: "a@b.co", password: "password", acceptTerms: "on" }).success).toBe(false);
    expect(registerSchema.safeParse({ displayName: "Ama", email: "a@b.co", password: "passw0rd!", acceptTerms: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ displayName: "Ama", email: "A@B.co", password: "passw0rd!", acceptTerms: "on" }).data?.email).toBe("a@b.co");
  });
  it("validates listing content", () => {
    const base = { categoryId: crypto.randomUUID(), title: "Fridge", description: "Working double door fridge, collect in Tema.", price: "", isNegotiable: false, condition: "used", quantity: 1, regionId: 1, city: "Tema", attributes: {} };
    expect(listingSchema.safeParse(base).data?.price).toBeNull();
    expect(listingSchema.safeParse({ ...base, price: "-5" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, description: "short" }).success).toBe(false);
  });
});

describe("friendlyError", () => {
  it("hides raw RLS errors but keeps our own guard messages", () => {
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" })).toBe("You don't have permission to do that.");
    expect(friendlyError({ code: "P0001", message: "Daily posting limit reached" })).toBe("Daily posting limit reached");
    expect(friendlyError({ code: "XX000", message: "internal stack trace" })).toBe("Something went wrong. Try again.");
  });
});
