import { describe, expect, it } from "vitest";
import { formatUtc } from "@/lib/ui/format";

describe("formatUtc", () => {
  it("formats a Date in UTC", () => {
    expect(formatUtc(new Date("2026-10-15T09:30:00Z"))).toBe("15 Oct 2026, 09:30 UTC");
  });

  it("accepts an ISO string", () => {
    expect(formatUtc("2026-10-15T09:30:00Z")).toBe("15 Oct 2026, 09:30 UTC");
  });

  it("uses UTC, not the offset of the input", () => {
    expect(formatUtc("2026-10-15T09:30:00+02:00")).toBe("15 Oct 2026, 07:30 UTC");
  });

  it("shows midnight as 00:00", () => {
    expect(formatUtc("2026-01-01T00:00:00Z")).toBe("1 Jan 2026, 00:00 UTC");
  });

  it("rolls over the year boundary", () => {
    expect(formatUtc("2025-12-31T23:59:00Z")).toBe("31 Dec 2025, 23:59 UTC");
    expect(formatUtc("2025-12-31T23:59:59.999Z")).toBe("31 Dec 2025, 23:59 UTC");
    expect(formatUtc("2026-01-01T00:00:00Z")).toBe("1 Jan 2026, 00:00 UTC");
  });

  it("returns a fixed text for null or an invalid date", () => {
    expect(formatUtc(null)).toBe("unknown time");
    expect(formatUtc("garbage")).toBe("unknown time");
    expect(formatUtc("")).toBe("unknown time");
    expect(formatUtc(new Date("nope"))).toBe("unknown time");
  });
});
