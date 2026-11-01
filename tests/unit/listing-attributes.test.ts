import { describe, expect, it } from "vitest";
import { attributeRowsToInput, normalizeAttributes, type AttributeDef } from "@/lib/listing-attributes";

const defs: AttributeDef[] = [
  { id: "a1", key: "make", label: "Make", type: "select", options: ["Toyota", "Honda"], unit: null, is_required: true },
  { id: "a2", key: "year", label: "Year", type: "number", options: [], unit: null, is_required: true },
  { id: "a3", key: "registered", label: "Registered", type: "boolean", options: [], unit: null, is_required: false },
  { id: "a4", key: "model", label: "Model", type: "text", options: [], unit: null, is_required: false },
];

describe("normalizeAttributes", () => {
  it("converts values to typed rows", () => {
    const r = normalizeAttributes(defs, { make: "Toyota", year: "2,014", registered: "on", model: " Corolla " });
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([
      { attribute_id: "a1", value_text: "Toyota", value_number: null, value_bool: null },
      { attribute_id: "a2", value_text: null, value_number: 2014, value_bool: null },
      { attribute_id: "a3", value_text: null, value_number: null, value_bool: true },
      { attribute_id: "a4", value_text: "Corolla", value_number: null, value_bool: null },
    ]);
  });
  it("rejects options that aren't offered and non-numbers", () => {
    const r = normalizeAttributes(defs, { make: "Tesla", year: "new" });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(["make", "year"]);
  });
  it("only enforces required fields in strict mode", () => {
    expect(normalizeAttributes(defs, {}).ok).toBe(true);
    expect(normalizeAttributes(defs, {}, { strict: true }).errors).toEqual({ make: "Make is required", year: "Year is required" });
  });
  it("round-trips back to form input", () => {
    const { rows } = normalizeAttributes(defs, { make: "Honda", year: 2019, registered: false });
    expect(attributeRowsToInput(defs, rows)).toEqual({ make: "Honda", year: 2019, registered: false });
  });
});
