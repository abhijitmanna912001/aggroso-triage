import { describe, expect, it } from "vitest";
import type { AllowedCitations } from "../../lib/analysis/prompt";
import type { AnalysisOutput } from "../../lib/analysis/schema";
import { validateAnalysis } from "../../lib/analysis/validate";

const allowed: AllowedCitations = {
  manual: ["pump-4-2", "pump-5-1"],
  event: ["1", "2"],
  threshold: ["PUMP.vibration"],
};

const manual = { type: "manual", id: "pump-4-2" } as const;
const event = { type: "event", id: "1" } as const;
const threshold = { type: "threshold", id: "PUMP.vibration" } as const;

function makeOutput(overrides: Partial<AnalysisOutput> = {}): AnalysisOutput {
  return {
    hypotheses: [{ cause: "Possible bearing wear", rationale: "High vibration", confidence: "MEDIUM", citations: [manual] }],
    followUpQuestions: [{ question: "When was it lubricated?", citations: [event] }],
    inspectionSteps: [{ instruction: "Isolate and lock out, then inspect.", citations: [manual] }],
    proposedPriority: "MEDIUM",
    priorityRationale: "Moderate",
    draftWorkOrder: { title: "Inspect pump" },
    limitations: ["None known"],
    ...overrides,
  };
}

const none = { priorityFloor: null, missingThresholdIds: [] as string[], equipmentTag: "P-101" } as const;

describe("validateAnalysis citations", () => {
  it("keeps everything when all citations are valid", () => {
    const result = validateAnalysis(makeOutput(), allowed, none);
    expect(result.accepted.hypotheses).toHaveLength(1);
    expect(result.accepted.followUpQuestions).toHaveLength(1);
    expect(result.accepted.inspectionSteps).toHaveLength(1);
    expect(result.dropped).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it("drops an item whose citation id is not allowed", () => {
    const output = makeOutput({
      hypotheses: [{ cause: "X", rationale: "r", confidence: "LOW", citations: [{ type: "manual", id: "pump-9-9" }] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.hypotheses).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "hypothesis", index: 0, reason: "no valid citation" }]);
  });

  it("drops a citation with a right id but the wrong type", () => {
    const output = makeOutput({
      followUpQuestions: [{ question: "Q?", citations: [{ type: "event", id: "pump-4-2" }] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.followUpQuestions).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "question", index: 0, reason: "no valid citation" }]);
  });

  it("trims invalid citations from a mixed item and notes the count", () => {
    const output = makeOutput({
      hypotheses: [
        {
          cause: "X",
          rationale: "r",
          confidence: "HIGH",
          citations: [manual, { type: "manual", id: "nope" }, { type: "event", id: "99" }],
        },
      ],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.hypotheses[0].citations).toEqual([manual]);
    expect(result.notes).toEqual(["hypothesis 1: removed 2 invalid or duplicate citation(s)"]);
    expect(result.dropped).toEqual([]);
  });

  it("drops an item left with only invalid citations", () => {
    const output = makeOutput({
      inspectionSteps: [{ instruction: "Look", citations: [{ type: "threshold", id: "PUMP.temp" }] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.inspectionSteps).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "step", index: 0, reason: "no valid citation" }]);
    expect(result.notes).toEqual(["step 1: removed 1 invalid or duplicate citation(s)"]);
  });

  it("removes duplicate citations", () => {
    const output = makeOutput({
      followUpQuestions: [{ question: "Q?", citations: [event, { ...event }, event] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.followUpQuestions[0].citations).toEqual([event]);
    expect(result.notes).toEqual(["question 1: removed 2 invalid or duplicate citation(s)"]);
  });

  it("drops a threshold-only hypothesis", () => {
    const output = makeOutput({
      hypotheses: [{ cause: "X", rationale: "r", confidence: "LOW", citations: [threshold] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.hypotheses).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "hypothesis", index: 0, reason: "needs manual or event evidence" }]);
  });

  it("drops a threshold-only inspection step", () => {
    const output = makeOutput({
      inspectionSteps: [{ instruction: "Look", citations: [threshold] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.inspectionSteps).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "step", index: 0, reason: "needs manual or event evidence" }]);
  });

  it("keeps a threshold-only follow-up question", () => {
    const output = makeOutput({
      followUpQuestions: [{ question: "Is the sensor connected?", citations: [threshold] }],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.followUpQuestions).toHaveLength(1);
    expect(result.dropped).toEqual([]);
  });

  it("keeps a hypothesis that cites a threshold plus a manual or event", () => {
    const output = makeOutput({
      hypotheses: [
        { cause: "A", rationale: "r", confidence: "LOW", citations: [threshold, manual] },
        { cause: "B", rationale: "r", confidence: "LOW", citations: [threshold, event] },
      ],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.hypotheses).toHaveLength(2);
    expect(result.dropped).toEqual([]);
  });

  it("keeps the original index when an earlier item is dropped", () => {
    const output = makeOutput({
      followUpQuestions: [
        { question: "bad", citations: [] },
        { question: "good", citations: [event] },
      ],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.followUpQuestions.map((q) => q.question)).toEqual(["good"]);
    expect(result.dropped).toEqual([{ kind: "question", index: 0, reason: "no valid citation" }]);
  });
});

describe("validateAnalysis text and caps", () => {
  it("drops items with empty or whitespace main text and trims the rest", () => {
    const output = makeOutput({
      hypotheses: [
        { cause: "   ", rationale: "r", confidence: "LOW", citations: [manual] },
        { cause: "  Possible leak  ", rationale: "  why  ", confidence: "LOW", citations: [manual] },
      ],
      followUpQuestions: [{ question: "", citations: [event] }],
      inspectionSteps: [{ instruction: "\n\t", citations: [manual] }],
      priorityRationale: "  reason  ",
      draftWorkOrder: { title: "  T  " },
      limitations: ["  a  ", "   "],
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.dropped).toEqual([
      { kind: "hypothesis", index: 0, reason: "empty text" },
      { kind: "question", index: 0, reason: "empty text" },
      { kind: "step", index: 0, reason: "empty text" },
    ]);
    expect(result.accepted.hypotheses).toEqual([
      { cause: "Possible leak", rationale: "why", confidence: "LOW", citations: [manual] },
    ]);
    expect(result.accepted.priorityRationale).toBe("reason");
    expect(result.accepted.draftWorkOrder.title).toBe("T");
    expect(result.accepted.limitations).toEqual(["a"]);
  });

  it("caps each list in the model's order and notes the removal", () => {
    const output = makeOutput({
      hypotheses: Array.from({ length: 7 }, (_, i) => ({
        cause: `cause ${i}`,
        rationale: "r",
        confidence: "LOW" as const,
        citations: [manual],
      })),
      followUpQuestions: Array.from({ length: 8 }, (_, i) => ({ question: `q ${i}`, citations: [event] })),
      inspectionSteps: Array.from({ length: 12 }, (_, i) => ({ instruction: `s ${i}`, citations: [manual] })),
    });
    const result = validateAnalysis(output, allowed, none);
    expect(result.accepted.hypotheses.map((h) => h.cause)).toEqual(["cause 0", "cause 1", "cause 2", "cause 3", "cause 4"]);
    expect(result.accepted.followUpQuestions).toHaveLength(6);
    expect(result.accepted.inspectionSteps).toHaveLength(10);
    expect(result.accepted.inspectionSteps[0].instruction).toBe("s 0");
    expect(result.notes).toHaveLength(3);
    expect(result.notes[0]).toContain("2 removed");
  });

  it("does not add a cap note at exactly the limit", () => {
    const output = makeOutput({
      hypotheses: Array.from({ length: 5 }, (_, i) => ({
        cause: `c${i}`,
        rationale: "r",
        confidence: "LOW" as const,
        citations: [manual],
      })),
    });
    expect(validateAnalysis(output, allowed, none).notes).toEqual([]);
  });
});

describe("validateAnalysis priority", () => {
  it("raises LOW to HIGH under a HIGH floor", () => {
    const result = validateAnalysis(makeOutput({ proposedPriority: "LOW" }), allowed, { ...none, priorityFloor: "HIGH" });
    expect(result.accepted.priority).toBe("HIGH");
    expect(result.priorityRaisedByFloor).toBe(true);
  });

  it("raises MEDIUM to URGENT under an URGENT floor", () => {
    const result = validateAnalysis(makeOutput({ proposedPriority: "MEDIUM" }), allowed, { ...none, priorityFloor: "URGENT" });
    expect(result.accepted.priority).toBe("URGENT");
    expect(result.priorityRaisedByFloor).toBe(true);
  });

  it("keeps a higher model priority and does not report a raise", () => {
    const result = validateAnalysis(makeOutput({ proposedPriority: "URGENT" }), allowed, { ...none, priorityFloor: "HIGH" });
    expect(result.accepted.priority).toBe("URGENT");
    expect(result.priorityRaisedByFloor).toBe(false);
  });

  it("does not report a raise when the model already equals the floor", () => {
    const result = validateAnalysis(makeOutput({ proposedPriority: "HIGH" }), allowed, { ...none, priorityFloor: "HIGH" });
    expect(result.accepted.priority).toBe("HIGH");
    expect(result.priorityRaisedByFloor).toBe(false);
  });

  it("never lowers a priority", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"] as const) {
      expect(validateAnalysis(makeOutput({ proposedPriority: priority }), allowed, none).accepted.priority).toBe(priority);
    }
  });
});

describe("validateAnalysis missing readings", () => {
  const missing = { ...none, missingThresholdIds: ["PUMP.vibration"] };

  it("drops a hypothesis citing a missing reading even with a valid manual citation", () => {
    const output = makeOutput({
      hypotheses: [{ cause: "Bearing wear", rationale: "r", confidence: "HIGH", citations: [threshold, manual] }],
    });
    const result = validateAnalysis(output, allowed, missing);
    expect(result.accepted.hypotheses).toEqual([]);
    expect(result.dropped).toEqual([{ kind: "hypothesis", index: 0, reason: "cites a missing reading" }]);
  });

  it("keeps a step and a question that cite a missing reading", () => {
    const output = makeOutput({
      followUpQuestions: [{ question: "Is the sensor connected?", citations: [threshold] }],
      inspectionSteps: [{ instruction: "Isolate and lock out, then check the sensor.", citations: [threshold, manual] }],
    });
    const result = validateAnalysis(output, allowed, missing);
    expect(result.accepted.followUpQuestions).toHaveLength(1);
    expect(result.accepted.inspectionSteps).toHaveLength(1);
    expect(result.dropped).toEqual([]);
  });

  it("keeps a hypothesis citing a non-missing threshold plus a manual section", () => {
    const output = makeOutput({
      hypotheses: [{ cause: "Bearing wear", rationale: "r", confidence: "LOW", citations: [threshold, manual] }],
    });
    // CONFLICTING and OK thresholds are simply not in missingThresholdIds.
    const result = validateAnalysis(output, allowed, { ...none, missingThresholdIds: ["PUMP.temp"] });
    expect(result.accepted.hypotheses).toHaveLength(1);
    expect(result.dropped).toEqual([]);
  });
});

describe("validateAnalysis draft work order", () => {
  it("falls back to a title built from the equipment tag", () => {
    const result = validateAnalysis(makeOutput({ draftWorkOrder: { title: "  " } }), allowed, none);
    expect(result.accepted.draftWorkOrder.title).toBe("P-101: maintenance inspection");
  });

  it("composes sections in order with numbering, bullets and blank lines", () => {
    const output = makeOutput({
      hypotheses: [{ cause: "Possible bearing wear", rationale: "SECRET RATIONALE", confidence: "MEDIUM", citations: [manual] }],
      followUpQuestions: [{ question: "When was it lubricated?", citations: [event] }],
      inspectionSteps: [
        { instruction: "Isolate and lock out.", citations: [manual] },
        { instruction: "Inspect the bearing.", citations: [manual] },
      ],
      limitations: ["No lubrication log"],
    });
    const { description } = validateAnalysis(output, allowed, none).accepted.draftWorkOrder;
    expect(description).toBe(
      [
        "Inspection steps:\n1. Isolate and lock out.\n2. Inspect the bearing.",
        "Open questions:\n- When was it lubricated?",
        "Possible causes under review (not confirmed):\n- Possible bearing wear (medium confidence)",
        "Limitations:\n- No lubrication log",
      ].join("\n\n"),
    );
    expect(description).not.toContain("SECRET RATIONALE");
  });

  it("omits empty sections and uses the no-cause line when no hypothesis is accepted", () => {
    const output = makeOutput({
      hypotheses: [],
      followUpQuestions: [],
      inspectionSteps: [{ instruction: "Look.", citations: [manual] }],
      limitations: [],
    });
    const { description } = validateAnalysis(output, allowed, none).accepted.draftWorkOrder;
    expect(description).toBe(
      "Inspection steps:\n1. Look.\n\nNo possible cause could be proposed from the available evidence.",
    );
    expect(description).not.toContain("Open questions:");
    expect(description).not.toContain("Limitations:");
    expect(description).not.toContain("Possible causes");
  });

  it("never contains the text of a dropped hypothesis", () => {
    const output = makeOutput({
      hypotheses: [
        { cause: "DROPPED MISSING CAUSE", rationale: "DROPPED RATIONALE", confidence: "HIGH", citations: [threshold, manual] },
        { cause: "DROPPED INVALID CAUSE", rationale: "r", confidence: "HIGH", citations: [{ type: "manual", id: "nope" }] },
      ],
    });
    const result = validateAnalysis(output, allowed, { ...none, missingThresholdIds: ["PUMP.vibration"] });
    expect(result.dropped).toHaveLength(2);
    const { title, description } = result.accepted.draftWorkOrder;
    expect(`${title}\n${description}`).not.toContain("DROPPED");
    expect(description).toContain("No possible cause could be proposed");
  });
});

describe("validateAnalysis purity", () => {
  it("does not mutate its inputs", () => {
    const output = makeOutput({
      hypotheses: [
        { cause: "  X  ", rationale: " r ", confidence: "LOW", citations: [manual, manual, { type: "manual", id: "bad" }] },
      ],
      proposedPriority: "LOW",
      limitations: [" a ", ""],
    });
    const allowedCopy = structuredClone(allowed);
    const before = structuredClone(output);
    validateAnalysis(output, allowed, { ...none, priorityFloor: "URGENT" });
    expect(output).toEqual(before);
    expect(allowed).toEqual(allowedCopy);
  });
});
