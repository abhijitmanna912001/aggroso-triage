// Pure module: no "server-only", no "@/" alias, no I/O. Turns stored citations into labels the UI can show, and
// parses citations stored as JSON defensively.
export type CitationType = "manual" | "event" | "threshold";

export type Citation = { type: CitationType; id: string };

export type EvidenceSources = {
  chunks: { id: string; sectionRef: string; heading: string }[];
  events: { id: number; description: string; occurredAt: Date | null }[];
  thresholds: { ruleId: string; sensor: string; status: string; message: string }[];
};

export type ResolvedCitation = {
  type: string;
  id: string;
  label: string;
  detail: string | null;
  found: boolean;
};

const CITATION_TYPES: readonly string[] = ["manual", "event", "threshold"];

export const UNAVAILABLE_LABEL = "Unavailable source";

// Anything that is not an array of { type, id } with a known type and a string id is dropped. Never throws.
export function parseCitations(value: unknown): Citation[] {
  try {
    if (!Array.isArray(value)) return [];
    const out: Citation[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) continue;
      const { type, id } = item as { type?: unknown; id?: unknown };
      if (typeof type !== "string" || !CITATION_TYPES.includes(type)) continue;
      if (typeof id !== "string" || id === "") continue;
      out.push({ type: type as CitationType, id });
    }
    return out;
  } catch {
    return [];
  }
}

export function resolveCitations(citations: Citation[], sources: EvidenceSources): ResolvedCitation[] {
  try {
    const chunks = new Map(sources.chunks.map((c) => [c.id, c] as const));
    const events = new Map(sources.events.map((e) => [String(e.id), e] as const));
    const thresholds = new Map(sources.thresholds.map((t) => [t.ruleId, t] as const));

    return citations.map((c): ResolvedCitation => {
      const missing: ResolvedCitation = { type: c.type, id: c.id, label: UNAVAILABLE_LABEL, detail: null, found: false };
      if (c.type === "manual") {
        const chunk = chunks.get(c.id);
        return chunk
          ? { type: c.type, id: c.id, label: chunk.sectionRef, detail: chunk.heading, found: true }
          : missing;
      }
      if (c.type === "event") {
        const event = events.get(c.id);
        return event
          ? { type: c.type, id: c.id, label: `Event ${event.id}`, detail: event.description, found: true }
          : missing;
      }
      if (c.type === "threshold") {
        const t = thresholds.get(c.id);
        return t
          ? { type: c.type, id: c.id, label: `${t.sensor} ${t.status}`, detail: t.message, found: true }
          : missing;
      }
      return missing;
    });
  } catch {
    return citations.map((c) => ({ type: String(c?.type), id: String(c?.id), label: UNAVAILABLE_LABEL, detail: null, found: false }));
  }
}
