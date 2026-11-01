/** Pure helpers for category-specific listing fields (shared by client and server). */

export type AttributeDef = {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options: unknown;
  unit: string | null;
  is_required: boolean;
};

export type AttributeRow = {
  attribute_id: string;
  value_text: string | null;
  value_number: number | null;
  value_bool: boolean | null;
};

export type AttributeInput = Record<string, string | number | boolean | null>;

/**
 * Converts raw form values into typed attribute rows.
 * `strict` also reports missing required fields (used when submitting).
 */
export function normalizeAttributes(defs: AttributeDef[], input: AttributeInput, { strict = false } = {}) {
  const rows: AttributeRow[] = [];
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const raw = input[def.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (strict && def.is_required) errors[def.key] = `${def.label} is required`;
      continue;
    }
    const row: AttributeRow = { attribute_id: def.id, value_text: null, value_number: null, value_bool: null };

    if (def.type === "number") {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 1e9) {
        errors[def.key] = `${def.label} must be a number`;
        continue;
      }
      row.value_number = n;
    } else if (def.type === "boolean") {
      row.value_bool = raw === true || raw === "true" || raw === "on" || raw === "yes";
    } else if (def.type === "select") {
      const options = Array.isArray(def.options) ? (def.options as string[]) : [];
      const v = String(raw).trim();
      if (!options.includes(v)) {
        errors[def.key] = `Choose a valid ${def.label.toLowerCase()}`;
        continue;
      }
      row.value_text = v;
    } else {
      const v = String(raw).trim();
      if (v.length > 200) {
        errors[def.key] = `${def.label} must be 200 characters or fewer`;
        continue;
      }
      row.value_text = v;
    }
    rows.push(row);
  }

  return { rows, errors, ok: Object.keys(errors).length === 0 };
}

/** Reverse of normalizeAttributes, for pre-filling the edit form. */
export function attributeRowsToInput(defs: AttributeDef[], rows: AttributeRow[]): AttributeInput {
  const byId = new Map(rows.map((r) => [r.attribute_id, r]));
  const out: AttributeInput = {};
  for (const d of defs) {
    const r = byId.get(d.id);
    if (!r) continue;
    out[d.key] = d.type === "boolean" ? Boolean(r.value_bool) : d.type === "number" ? (r.value_number ?? "") : (r.value_text ?? "");
  }
  return out;
}
