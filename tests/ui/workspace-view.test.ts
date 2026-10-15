import { describe, expect, it } from "vitest";
import {
  describeFailureStage,
  describeRetrieval,
  describeWorkOrderAction,
  parseRunNotes,
  sortThresholds,
  thresholdHint,
} from "@/lib/ui/workspace-view";

const EMPTY = {
  dropped: [],
  notes: [],
  degradedReasons: [],
  priorityRaisedByFloor: false,
  retrievalWarnings: [],
  workOrderAction: null,
};

describe("parseRunNotes", () => {
  it("parses a full valid object", () => {
    const input = {
      dropped: [{ kind: "hypothesis", index: 1, reason: "no valid citation" }],
      notes: ["a note"],
      degradedReasons: ["keyword-only retrieval"],
      priorityRaisedByFloor: true,
      retrievalWarnings: [{ stage: "embedding", message: "unavailable" }],
      workOrderAction: "created",
    };
    expect(parseRunNotes(input)).toEqual(input);
  });

  it("returns safe defaults for junk input", () => {
    for (const junk of [null, undefined, "text", 42, true, [], [1, 2]]) {
      expect(parseRunNotes(junk)).toEqual(EMPTY);
    }
  });

  it("returns defaults for an empty object", () => {
    expect(parseRunNotes({})).toEqual(EMPTY);
  });

  it("ignores fields of the wrong type", () => {
    expect(
      parseRunNotes({
        dropped: "x",
        notes: 5,
        degradedReasons: { a: 1 },
        priorityRaisedByFloor: "true",
        retrievalWarnings: null,
        workOrderAction: 7,
      }),
    ).toEqual(EMPTY);
  });

  it("keeps valid elements and drops malformed ones", () => {
    const result = parseRunNotes({
      dropped: [
        { kind: "question", index: 0, reason: "empty text" },
        { kind: "question", index: "0", reason: "bad index" },
        { kind: 1, index: 0, reason: "bad kind" },
        { kind: "step", index: Number.NaN, reason: "nan" },
        null,
        "x",
      ],
      notes: ["ok", 1, null],
      degradedReasons: [false, "reason"],
      retrievalWarnings: [{ stage: "s", message: "m" }, { stage: "s" }, 3],
    });
    expect(result.dropped).toEqual([{ kind: "question", index: 0, reason: "empty text" }]);
    expect(result.notes).toEqual(["ok"]);
    expect(result.degradedReasons).toEqual(["reason"]);
    expect(result.retrievalWarnings).toEqual([{ stage: "s", message: "m" }]);
  });

  it("only treats a real true as priorityRaisedByFloor", () => {
    expect(parseRunNotes({ priorityRaisedByFloor: true }).priorityRaisedByFloor).toBe(true);
    expect(parseRunNotes({ priorityRaisedByFloor: 1 }).priorityRaisedByFloor).toBe(false);
  });
});

describe("describeRetrieval", () => {
  it("has fixed text for each mode", () => {
    expect(describeRetrieval("HYBRID")).toBe("Keyword and semantic search");
    expect(describeRetrieval("KEYWORD_ONLY")).toBe("Keyword search only (semantic search was unavailable)");
    expect(describeRetrieval("NONE")).toBe("No manual sections were retrieved");
  });

  it("has a generic text for an unknown mode", () => {
    expect(describeRetrieval("SOMETHING")).toBe("Retrieval mode not recognised");
    expect(describeRetrieval("")).toBe("Retrieval mode not recognised");
  });
});

describe("describeFailureStage", () => {
  it("has distinct fixed text for every stage", () => {
    const stages = ["retrieval", "config", "request", "refusal", "incomplete", "parse", "internal"];
    const texts = stages.map(describeFailureStage);
    expect(new Set(texts).size).toBe(stages.length);
    for (const text of texts) expect(text).not.toBe("The analysis failed");
  });

  it("falls back for null, unknown and prototype names", () => {
    expect(describeFailureStage(null)).toBe("The analysis failed");
    expect(describeFailureStage("nope")).toBe("The analysis failed");
    expect(describeFailureStage("toString")).toBe("The analysis failed");
  });
});

describe("describeWorkOrderAction", () => {
  it("has the exact text for every action", () => {
    expect(describeWorkOrderAction("created")).toBe("An AI draft work order was created");
    expect(describeWorkOrderAction("new_version")).toBe("A new AI version was added to the draft");
    expect(describeWorkOrderAction("skipped_decided")).toBe("Work order not changed: it was already decided");
    expect(describeWorkOrderAction("skipped_technician_edits")).toBe(
      "Work order not changed: a technician edited the draft",
    );
    expect(describeWorkOrderAction("skipped_nothing_to_propose")).toBe(
      "No work order drafted: the analysis proposed nothing",
    );
    expect(describeWorkOrderAction("skipped_failed")).toBe("No work order drafted: the analysis failed");
  });

  it("handles null and unknown values", () => {
    expect(describeWorkOrderAction(null)).toBe("No work order action was recorded");
    expect(describeWorkOrderAction("mystery")).toBe("No work order action was recorded");
    expect(describeWorkOrderAction("constructor")).toBe("No work order action was recorded");
  });
});

describe("sortThresholds", () => {
  const items = [
    { status: "OK", sensor: "temp" },
    { status: "MISSING", sensor: "flow" },
    { status: "WARNING", sensor: "vibration" },
    { status: "CRITICAL", sensor: "pressure" },
    { status: "CONFLICTING", sensor: "temp" },
    { status: "CRITICAL", sensor: "amps" },
    { status: "ODD", sensor: "a" },
  ];

  it("orders by status then sensor, unknown last", () => {
    expect(sortThresholds(items).map((i) => `${i.status}:${i.sensor}`)).toEqual([
      "CRITICAL:amps",
      "CRITICAL:pressure",
      "CONFLICTING:temp",
      "WARNING:vibration",
      "MISSING:flow",
      "OK:temp",
      "ODD:a",
    ]);
  });

  it("returns a new array and does not mutate the input", () => {
    const copy = items.map((i) => ({ ...i }));
    const sorted = sortThresholds(items);
    expect(sorted).not.toBe(items);
    expect(items).toEqual(copy);
  });
});

describe("thresholdHint", () => {
  it("has a fixed line for non-OK statuses", () => {
    for (const status of ["MISSING", "CONFLICTING", "WARNING", "CRITICAL"]) {
      const hint = thresholdHint(status);
      expect(hint).toBeTypeOf("string");
      expect(hint).not.toBe("");
    }
  });

  it("returns null for OK and unknown statuses", () => {
    expect(thresholdHint("OK")).toBeNull();
    expect(thresholdHint("other")).toBeNull();
    expect(thresholdHint("toString")).toBeNull();
  });
});
