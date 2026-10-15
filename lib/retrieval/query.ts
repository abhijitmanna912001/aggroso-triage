// Pure module: no "server-only", no "@/" alias, so it runs in plain Node under tsx and vitest.
import type { EquipmentType, ThresholdStatus } from "../../generated/prisma/enums";

const MAX_QUERY_CHARS = 2000;

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  PUMP: "centrifugal pump",
  COMPRESSOR: "air compressor",
  MOTOR: "electric motor",
};

const ABNORMAL_STATUSES: ReadonlySet<ThresholdStatus> = new Set(["WARNING", "CRITICAL", "CONFLICTING"]);

const STOP_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "has",
  "have",
  "not",
  "but",
  "you",
  "our",
  "its",
]);

export type RetrievalQueryInput = {
  equipmentType: EquipmentType;
  issue: string;
  events: { description: string }[];
  thresholds: { sensor: string; status: ThresholdStatus }[];
};

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  // The character right after the cut being whitespace means the cut is already on a word boundary.
  if (/\s/.test(text[max])) return text.slice(0, max).trimEnd();
  const head = text.slice(0, max);
  const lastBreak = head.search(/\s\S*$/);
  return (lastBreak > 0 ? head.slice(0, lastBreak) : head).trimEnd();
}

export function buildRetrievalQuery(input: RetrievalQueryInput): string {
  const sensors = input.thresholds
    .filter((t) => ABNORMAL_STATUSES.has(t.status))
    .map((t) => t.sensor.replaceAll("_", " "));

  const parts = [
    EQUIPMENT_LABELS[input.equipmentType],
    input.issue,
    ...input.events.map((e) => e.description),
    ...sensors,
  ]
    .map(collapse)
    .filter((part) => part.length > 0);

  return truncateAtWord(parts.join("\n").trim(), MAX_QUERY_CHARS);
}

// Words that appear in nearly every chunk for the equipment type, so they add noise to a keyword query.
export const GENERIC_QUERY_WORDS: Record<EquipmentType, readonly string[]> = {
  PUMP: ["pump", "centrifugal"],
  COMPRESSOR: ["compressor"],
  MOTOR: ["motor", "electric"],
};

export function toTsQueryString(
  text: string,
  options: { maxTerms?: number; exclude?: readonly string[] } = {},
): string {
  const maxTerms = options.maxTerms ?? 24;
  const excluded = new Set((options.exclude ?? []).map((word) => word.toLowerCase()));
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (terms.length >= maxTerms) break;
    if (token.length < 3 || STOP_WORDS.has(token) || excluded.has(token) || seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
  }
  return terms.join(" | ");
}
