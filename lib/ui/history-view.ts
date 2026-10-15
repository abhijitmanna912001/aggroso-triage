// Pure module: no "server-only", no "@/" alias, no I/O. Fixed text for every HistoryType, so the maintenance
// timeline never shows a raw enum value. The type-only import is erased at runtime.
import type { HistoryType } from "../../generated/prisma/enums";

export type HistoryGroup = "report" | "analysis" | "decision" | "note" | "other";

export type HistoryDescription = { label: string; group: HistoryGroup };

// `satisfies Record<HistoryType, ...>` fails to compile if the enum gains a value that is not listed here.
const DESCRIPTIONS = {
  REPORT_CREATED: { label: "Report created", group: "report" },
  THRESHOLDS_EVALUATED: { label: "Threshold checks run", group: "analysis" },
  ANALYSIS_RUN: { label: "Analysis run", group: "analysis" },
  ANALYSIS_FAILED: { label: "Analysis failed", group: "analysis" },
  QUESTION_ANSWERED: { label: "Question answered", group: "note" },
  OBSERVATION_ADDED: { label: "Observation added", group: "note" },
  FINDING_CONFIRMED: { label: "Finding confirmed", group: "decision" },
  WORK_ORDER_DRAFTED: { label: "Work order drafted", group: "decision" },
  WORK_ORDER_EDITED: { label: "Work order edited", group: "decision" },
  WORK_ORDER_APPROVED: { label: "Work order approved", group: "decision" },
  WORK_ORDER_REJECTED: { label: "Work order rejected", group: "decision" },
  REPORT_CLOSED: { label: "Report closed", group: "report" },
} satisfies Record<HistoryType, HistoryDescription>;

const UNKNOWN: HistoryDescription = { label: "Other event", group: "other" };

// Text marker shown next to the label, so the group is never conveyed by color alone.
export const GROUP_LABELS: Record<HistoryGroup, string> = {
  report: "Report",
  analysis: "Analysis",
  decision: "Decision",
  note: "Note",
  other: "Other",
};

export function describeHistoryType(type: string): HistoryDescription {
  // hasOwn so keys such as "toString" never match.
  return Object.hasOwn(DESCRIPTIONS, type) ? DESCRIPTIONS[type as HistoryType] : UNKNOWN;
}
