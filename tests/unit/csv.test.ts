import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Ama "Gadget" Hub, Circle')).toBe('"Ama ""Gadget"" Hub, Circle"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralises spreadsheet formulas (CSV injection)", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+233 24 123 4567")).toBe("'+233 24 123 4567");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("writes empty cells for null and a UTF-8 BOM for Excel", () => {
    const out = toCsv(["a", "b"], [[null, "GH₵ 5"]]);
    expect(out.startsWith("﻿a,b\r\n")).toBe(true);
    expect(out).toContain(",GH₵ 5\r\n");
  });
});
