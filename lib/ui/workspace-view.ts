// Pure module: no "server-only", no "@/" alias, no I/O. View helpers for the report workspace page. Everything here
// returns fixed text or parses stored JSON defensively, so a malformed row can never break the page.

// The single source for the section anchors on the report page: the ids the sections render and the labels the
// section nav shows. Order is the page order.
export const WORKSPACE_SECTIONS: readonly { id: string; label: string }[] = [
  { id: "observations", label: "Observations" },
  { id: "analysis", label: "Analysis" },
  { id: "causes", label: "Possible causes" },
  { id: "findings", label: "Confirmed findings" },
  { id: "questions", label: "Follow-up questions" },
  { id: "steps", label: "Inspection steps" },
  { id: "work-order", label: "Work order" },
];

export type RunNotes = {
  dropped: { kind: string; index: number; reason: string }[];
  notes: string[];
  degradedReasons: string[];
  priorityRaisedByFloor: boolean;
  retrievalWarnings: { stage: string; message: string }[];
  workOrderAction: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// Never throws. Anything that is not the expected shape falls back to an empty or false value.
export function parseRunNotes(value: unknown): RunNotes {
  const empty: RunNotes = {
    dropped: [],
    notes: [],
    degradedReasons: [],
    priorityRaisedByFloor: false,
    retrievalWarnings: [],
    workOrderAction: null,
  };
  try {
    if (!isRecord(value)) return empty;

    const dropped: RunNotes["dropped"] = [];
    if (Array.isArray(value.dropped)) {
      for (const item of value.dropped) {
        if (!isRecord(item)) continue;
        const { kind, index, reason } = item;
        if (typeof kind !== "string" || typeof reason !== "string") continue;
        if (typeof index !== "number" || !Number.isFinite(index)) continue;
        dropped.push({ kind, index, reason });
      }
    }

    const retrievalWarnings: RunNotes["retrievalWarnings"] = [];
    if (Array.isArray(value.retrievalWarnings)) {
      for (const item of value.retrievalWarnings) {
        if (!isRecord(item)) continue;
        if (typeof item.stage !== "string" || typeof item.message !== "string") continue;
        retrievalWarnings.push({ stage: item.stage, message: item.message });
      }
    }

    return {
      dropped,
      notes: strings(value.notes),
      degradedReasons: strings(value.degradedReasons),
      priorityRaisedByFloor: value.priorityRaisedByFloor === true,
      retrievalWarnings,
      workOrderAction: typeof value.workOrderAction === "string" ? value.workOrderAction : null,
    };
  } catch {
    return empty;
  }
}

export function describeRetrieval(mode: string): string {
  switch (mode) {
    case "HYBRID":
      return "Keyword and semantic search";
    case "KEYWORD_ONLY":
      return "Keyword search only (semantic search was unavailable)";
    case "NONE":
      return "No manual sections were retrieved";
    default:
      return "Retrieval mode not recognised";
  }
}

const FAILURE_STAGES: Record<string, string> = {
  retrieval: "The manual search failed",
  config: "Analysis is not configured on this server",
  request: "The request to the AI model failed",
  refusal: "The AI model declined to answer",
  incomplete: "The AI model's answer was cut off",
  parse: "The AI model's answer could not be read",
  internal: "An internal error stopped the analysis",
};

export function describeFailureStage(stage: string | null): string {
  if (stage !== null && Object.hasOwn(FAILURE_STAGES, stage)) return FAILURE_STAGES[stage];
  return "The analysis failed";
}

const WORK_ORDER_ACTIONS: Record<string, string> = {
  created: "An AI draft work order was created",
  new_version: "A new AI version was added to the draft",
  skipped_decided: "Work order not changed: it was already decided",
  skipped_technician_edits: "Work order not changed: a technician edited the draft",
  skipped_nothing_to_propose: "No work order drafted: the analysis proposed nothing",
  skipped_failed: "No work order drafted: the analysis failed",
};

export function describeWorkOrderAction(action: string | null): string {
  if (action !== null && Object.hasOwn(WORK_ORDER_ACTIONS, action)) return WORK_ORDER_ACTIONS[action];
  return "No work order action was recorded";
}

const THRESHOLD_ORDER = ["CRITICAL", "CONFLICTING", "WARNING", "MISSING", "OK"];

function thresholdRank(status: string): number {
  const i = THRESHOLD_ORDER.indexOf(status);
  return i === -1 ? THRESHOLD_ORDER.length : i;
}

// Returns a new array; the input is not touched.
export function sortThresholds<T extends { status: string; sensor: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byStatus = thresholdRank(a.status) - thresholdRank(b.status);
    if (byStatus !== 0) return byStatus;
    return a.sensor < b.sensor ? -1 : a.sensor > b.sensor ? 1 : 0;
  });
}

const THRESHOLD_HINTS: Record<string, string> = {
  MISSING: "A sensor the rules expect was not provided.",
  CONFLICTING: "Two readings of this sensor at the same time disagree.",
  WARNING: "The reading is outside the normal range.",
  CRITICAL: "The reading is beyond the critical limit.",
};

export function thresholdHint(status: string): string | null {
  return Object.hasOwn(THRESHOLD_HINTS, status) ? THRESHOLD_HINTS[status] : null;
}
