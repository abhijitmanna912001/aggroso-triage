// Pure module: no "server-only", no "@/" alias, no logging, no I/O. Never mutates its input.
import type { AllowedCitations } from "./prompt";
import { ANALYSIS_LIMITS, type AnalysisOutput, type Citation } from "./schema";

type PriorityValue = AnalysisOutput["proposedPriority"];

export type DroppedItem = {
  kind: "hypothesis" | "question" | "step";
  index: number;
  reason: string;
};

export type ValidatedAnalysis = {
  accepted: {
    hypotheses: AnalysisOutput["hypotheses"];
    followUpQuestions: AnalysisOutput["followUpQuestions"];
    inspectionSteps: AnalysisOutput["inspectionSteps"];
    priority: PriorityValue;
    priorityRationale: string;
    draftWorkOrder: { title: string; description: string };
    limitations: string[];
  };
  dropped: DroppedItem[];
  notes: string[];
  priorityRaisedByFloor: boolean;
};

const PRIORITY_RANK: Record<PriorityValue, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

function cleanCitations(citations: Citation[], allowed: AllowedCitations): Citation[] {
  const seen = new Set<string>();
  const kept: Citation[] = [];
  for (const c of citations) {
    const ids: readonly string[] | undefined = allowed[c.type];
    if (!ids || !ids.includes(c.id)) continue;
    const key = `${c.type}\u0000${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ type: c.type, id: c.id });
  }
  return kept;
}

export const NO_CAUSE_LINE = "No possible cause could be proposed from the available evidence.";

// The description is built only from accepted items, so no other model text (and nothing dropped) can reach it.
function composeDescription(accepted: {
  steps: string[];
  questions: string[];
  causes: { cause: string; confidence: string }[];
  limitations: string[];
}): string {
  const sections: string[] = [];
  if (accepted.steps.length > 0) {
    sections.push(["Inspection steps:", ...accepted.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n"));
  }
  if (accepted.questions.length > 0) {
    sections.push(["Open questions:", ...accepted.questions.map((q) => `- ${q}`)].join("\n"));
  }
  if (accepted.causes.length > 0) {
    sections.push(
      [
        "Possible causes under review (not confirmed):",
        ...accepted.causes.map((c) => `- ${c.cause} (${c.confidence.toLowerCase()} confidence)`),
      ].join("\n"),
    );
  } else {
    sections.push(NO_CAUSE_LINE);
  }
  if (accepted.limitations.length > 0) {
    sections.push(["Limitations:", ...accepted.limitations.map((l) => `- ${l}`)].join("\n"));
  }
  return sections.join("\n\n");
}

export function validateAnalysis(
  output: AnalysisOutput,
  allowed: AllowedCitations,
  options: {
    priorityFloor: "HIGH" | "URGENT" | null;
    missingThresholdIds: readonly string[];
    equipmentTag: string;
  },
): ValidatedAnalysis {
  const dropped: DroppedItem[] = [];
  const notes: string[] = [];

  // Shared by the three item lists: trim, check text, clean citations, record drops and notes.
  function processList<T extends { citations: Citation[] }>(
    items: T[],
    kind: DroppedItem["kind"],
    textOf: (item: T) => string,
    rebuild: (item: T, citations: Citation[]) => T,
    requireEvidence: boolean,
    dropOnMissingReading = false,
  ): T[] {
    const accepted: T[] = [];
    items.forEach((item, index) => {
      const label = `${kind} ${index + 1}`;
      if (textOf(item).trim() === "") {
        dropped.push({ kind, index, reason: "empty text" });
        return;
      }
      // Checked on the original citations: a cause must not rest on a reading nobody provided.
      if (
        dropOnMissingReading &&
        item.citations.some((c) => c.type === "threshold" && options.missingThresholdIds.includes(c.id))
      ) {
        dropped.push({ kind, index, reason: "cites a missing reading" });
        return;
      }
      const citations = cleanCitations(item.citations, allowed);
      const removed = item.citations.length - citations.length;
      if (removed > 0) notes.push(`${label}: removed ${removed} invalid or duplicate citation(s)`);
      if (citations.length === 0) {
        dropped.push({ kind, index, reason: "no valid citation" });
        return;
      }
      // Threshold results alone are not evidence for a cause or a step; they may only support a question.
      if (requireEvidence && !citations.some((c) => c.type === "manual" || c.type === "event")) {
        dropped.push({ kind, index, reason: "needs manual or event evidence" });
        return;
      }
      accepted.push(rebuild(item, citations));
    });
    return accepted;
  }

  function cap<T>(items: T[], limit: number, name: string): T[] {
    if (items.length <= limit) return items;
    notes.push(`${name}: kept the first ${limit} of ${items.length}; ${items.length - limit} removed`);
    return items.slice(0, limit);
  }

  const hypotheses = cap(
    processList(
      output.hypotheses,
      "hypothesis",
      (h) => h.cause,
      (h, citations) => ({
        cause: h.cause.trim(),
        rationale: h.rationale.trim(),
        confidence: h.confidence,
        citations,
      }),
      true,
      true,
    ),
    ANALYSIS_LIMITS.hypotheses,
    "hypotheses",
  );

  const followUpQuestions = cap(
    processList(
      output.followUpQuestions,
      "question",
      (q) => q.question,
      (q, citations) => ({ question: q.question.trim(), citations }),
      false,
    ),
    ANALYSIS_LIMITS.followUpQuestions,
    "follow-up questions",
  );

  const inspectionSteps = cap(
    processList(
      output.inspectionSteps,
      "step",
      (s) => s.instruction,
      (s, citations) => ({ instruction: s.instruction.trim(), citations }),
      true,
    ),
    ANALYSIS_LIMITS.inspectionSteps,
    "inspection steps",
  );

  const limitations = output.limitations.map((l) => l.trim()).filter((l) => l !== "");
  const title = output.draftWorkOrder.title.trim() || `${options.equipmentTag}: maintenance inspection`;

  const floor = options.priorityFloor;
  const raised = floor !== null && PRIORITY_RANK[floor] > PRIORITY_RANK[output.proposedPriority];

  return {
    accepted: {
      hypotheses,
      followUpQuestions,
      inspectionSteps,
      priority: raised ? floor : output.proposedPriority,
      priorityRationale: output.priorityRationale.trim(),
      draftWorkOrder: {
        title,
        description: composeDescription({
          steps: inspectionSteps.map((s) => s.instruction),
          questions: followUpQuestions.map((q) => q.question),
          causes: hypotheses.map((h) => ({ cause: h.cause, confidence: h.confidence })),
          limitations,
        }),
      },
      limitations,
    },
    dropped,
    notes,
    priorityRaisedByFloor: raised,
  };
}
