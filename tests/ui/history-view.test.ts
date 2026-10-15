import { describe, expect, it } from "vitest";
import { describeHistoryType, GROUP_LABELS, historyGroupTone, historyTone } from "@/lib/ui/history-view";

const EXPECTED: [string, string, string][] = [
  ["REPORT_CREATED", "Report created", "report"],
  ["THRESHOLDS_EVALUATED", "Threshold checks run", "analysis"],
  ["ANALYSIS_RUN", "Analysis run", "analysis"],
  ["ANALYSIS_FAILED", "Analysis failed", "analysis"],
  ["QUESTION_ANSWERED", "Question answered", "note"],
  ["OBSERVATION_ADDED", "Observation added", "note"],
  ["FINDING_CONFIRMED", "Finding confirmed", "decision"],
  ["WORK_ORDER_DRAFTED", "Work order drafted", "decision"],
  ["WORK_ORDER_EDITED", "Work order edited", "decision"],
  ["WORK_ORDER_APPROVED", "Work order approved", "decision"],
  ["WORK_ORDER_REJECTED", "Work order rejected", "decision"],
  ["REPORT_CLOSED", "Report closed", "report"],
];

describe("describeHistoryType", () => {
  it("covers all twelve history types with fixed text", () => {
    expect(EXPECTED).toHaveLength(12);
    for (const [type, label, group] of EXPECTED) {
      expect(describeHistoryType(type)).toEqual({ label, group });
    }
  });

  it("returns a generic entry for an unknown value", () => {
    expect(describeHistoryType("SOMETHING_NEW")).toEqual({ label: "Other event", group: "other" });
    expect(describeHistoryType("")).toEqual({ label: "Other event", group: "other" });
  });

  it("does not match inherited object keys", () => {
    for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(describeHistoryType(key).group).toBe("other");
    }
  });

  it("uses a unique label for every type, including the generic one", () => {
    const labels = [...EXPECTED.map(([, label]) => label), describeHistoryType("nope").label];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has a text marker for every group used", () => {
    for (const [type] of EXPECTED) {
      expect(GROUP_LABELS[describeHistoryType(type).group]).toBeTruthy();
    }
    expect(GROUP_LABELS.other).toBe("Other");
  });
});

describe("historyGroupTone", () => {
  it("maps every group to its tone", () => {
    expect(historyGroupTone("report")).toBe("info");
    expect(historyGroupTone("analysis")).toBe("neutral");
    expect(historyGroupTone("decision")).toBe("success");
    expect(historyGroupTone("note")).toBe("neutral");
    expect(historyGroupTone("other")).toBe("neutral");
  });
});

describe("historyTone", () => {
  const TONES: Record<string, string> = {
    REPORT_CREATED: "info",
    THRESHOLDS_EVALUATED: "neutral",
    ANALYSIS_RUN: "neutral",
    ANALYSIS_FAILED: "danger",
    QUESTION_ANSWERED: "neutral",
    OBSERVATION_ADDED: "neutral",
    FINDING_CONFIRMED: "success",
    WORK_ORDER_DRAFTED: "success",
    WORK_ORDER_EDITED: "success",
    WORK_ORDER_APPROVED: "success",
    WORK_ORDER_REJECTED: "success",
    REPORT_CLOSED: "info",
  };

  it("gives every history type its tone, with ANALYSIS_FAILED as danger", () => {
    for (const [type] of EXPECTED) {
      expect(historyTone(type), type).toBe(TONES[type]);
    }
  });

  it("is neutral for unknown values and inherited object keys", () => {
    for (const type of ["SOMETHING_NEW", "", "toString", "__proto__"]) {
      expect(historyTone(type), type).toBe("neutral");
    }
  });
});
