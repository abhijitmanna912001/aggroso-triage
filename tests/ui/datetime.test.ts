import { describe, expect, it } from "vitest";
import { toIsoWithOffset } from "@/lib/ui/datetime";

describe("toIsoWithOffset", () => {
  it("converts browser local time to a UTC ISO string", () => {
    const value = "2026-10-15T09:30";
    expect(toIsoWithOffset(value)).toBe(new Date(value).toISOString());
    expect(toIsoWithOffset(value)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns an empty string for empty or whitespace input", () => {
    expect(toIsoWithOffset("")).toBe("");
    expect(toIsoWithOffset("   ")).toBe("");
  });

  it("returns unparseable input unchanged", () => {
    expect(toIsoWithOffset("not a date")).toBe("not a date");
    expect(toIsoWithOffset("2026-13-45T99:99")).toBe("2026-13-45T99:99");
  });

  it("handles midnight and the year boundary", () => {
    for (const value of ["2026-01-01T00:00", "2025-12-31T23:59", "2026-12-31T23:59"]) {
      const out = toIsoWithOffset(value);
      expect(out).toBe(new Date(value).toISOString());
      expect(new Date(out).getTime()).toBe(new Date(value).getTime());
    }
  });

  it("keeps a value that already has an offset at the same instant", () => {
    expect(toIsoWithOffset("2026-10-15T09:30:00Z")).toBe("2026-10-15T09:30:00.000Z");
  });
});
