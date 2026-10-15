import { describe, expect, it } from "vitest";
import { resolveCitations, type EvidenceSources } from "../../lib/server/evidence";

const sources: EvidenceSources = {
  chunks: [{ id: "pump-4-2", sectionRef: "4.2", heading: "Seal leakage" }],
  events: [{ id: 7, description: "Pump tripped", occurredAt: null }],
  thresholds: [{ ruleId: "pump.vibration", sensor: "vibration", status: "CRITICAL", message: "Vibration is above the limit" }],
};

describe("resolveCitations", () => {
  it("resolves a manual citation", () => {
    expect(resolveCitations([{ type: "manual", id: "pump-4-2" }], sources)).toEqual([
      { type: "manual", id: "pump-4-2", label: "4.2", detail: "Seal leakage", found: true },
    ]);
  });

  it("resolves an event citation", () => {
    expect(resolveCitations([{ type: "event", id: "7" }], sources)).toEqual([
      { type: "event", id: "7", label: "Event 7", detail: "Pump tripped", found: true },
    ]);
  });

  it("resolves a threshold citation", () => {
    expect(resolveCitations([{ type: "threshold", id: "pump.vibration" }], sources)).toEqual([
      { type: "threshold", id: "pump.vibration", label: "vibration CRITICAL", detail: "Vibration is above the limit", found: true },
    ]);
  });

  it("marks unknown sources as unavailable", () => {
    const out = resolveCitations(
      [
        { type: "manual", id: "nope" },
        { type: "event", id: "99" },
        { type: "event", id: "abc" },
        { type: "threshold", id: "nope" },
      ],
      sources,
    );
    for (const item of out) {
      expect(item.found).toBe(false);
      expect(item.label).toBe("Unavailable source");
      expect(item.detail).toBeNull();
    }
    expect(out.map((o) => o.id)).toEqual(["nope", "99", "abc", "nope"]);
  });

  it("handles a mixed list in order", () => {
    const out = resolveCitations(
      [
        { type: "manual", id: "pump-4-2" },
        { type: "event", id: "99" },
        { type: "threshold", id: "pump.vibration" },
      ],
      sources,
    );
    expect(out.map((o) => o.found)).toEqual([true, false, true]);
  });

  it("returns an empty list for no citations", () => {
    expect(resolveCitations([], sources)).toEqual([]);
  });

  it("does not throw on malformed sources", () => {
    const broken = { chunks: null, events: [], thresholds: [] } as unknown as EvidenceSources;
    const out = resolveCitations([{ type: "manual", id: "x" }], broken);
    expect(out).toEqual([{ type: "manual", id: "x", label: "Unavailable source", detail: null, found: false }]);
  });
});
