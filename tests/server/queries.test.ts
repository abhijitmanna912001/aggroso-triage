// parseCitations is the pure helper used by lib/server/queries.ts; it lives in lib/server/evidence.ts so this test
// does not import any server-only module.
import { describe, expect, it } from "vitest";
import { parseCitations } from "../../lib/server/evidence";

describe("parseCitations", () => {
  it("keeps valid citations of every known type", () => {
    const input = [
      { type: "manual", id: "pump-4-2" },
      { type: "event", id: "3" },
      { type: "threshold", id: "pump.vibration" },
    ];
    expect(parseCitations(input)).toEqual(input);
  });

  it("returns an empty list for anything that is not an array", () => {
    for (const value of [null, undefined, "x", 5, {}, { type: "manual", id: "a" }]) {
      expect(parseCitations(value)).toEqual([]);
    }
  });

  it("drops unknown types, missing or non-string ids, and non-objects", () => {
    expect(
      parseCitations([
        { type: "web", id: "a" },
        { type: "manual" },
        { type: "manual", id: 5 },
        { type: "manual", id: "" },
        null,
        "manual",
        { type: "event", id: "2" },
      ]),
    ).toEqual([{ type: "event", id: "2" }]);
  });

  it("drops extra fields", () => {
    expect(parseCitations([{ type: "manual", id: "a", extra: 1 }])).toEqual([{ type: "manual", id: "a" }]);
  });
});
