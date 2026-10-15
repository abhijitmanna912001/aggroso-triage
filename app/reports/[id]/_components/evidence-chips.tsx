import { resolveCitations, type Citation, type EvidenceSources } from "@/lib/server/evidence";
import type { getReportWorkspace } from "@/lib/server/queries";

export type Workspace = NonNullable<Awaited<ReturnType<typeof getReportWorkspace>>>;

export function buildSources(ws: Pick<Workspace, "chunks" | "events" | "thresholds">): EvidenceSources {
  return {
    chunks: ws.chunks.map((c) => ({ id: c.id, sectionRef: c.sectionRef, heading: c.heading })),
    events: ws.events.map((e) => ({ id: e.id, description: e.description, occurredAt: e.occurredAt })),
    // A check without a rule id can never be cited, so it is left out.
    thresholds: ws.thresholds.flatMap((t) =>
      t.ruleId === null ? [] : [{ ruleId: t.ruleId, sensor: t.sensor, status: t.status, message: t.message }],
    ),
  };
}

const TYPE_WORDS: Record<string, string> = { manual: "Manual", event: "Event", threshold: "Sensor check" };

// Every label and detail is rendered as text.
export function EvidenceChips({ citations, sources }: { citations: Citation[]; sources: EvidenceSources }) {
  const resolved = resolveCitations(citations, sources);
  if (resolved.length === 0) {
    return <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No evidence cited</p>;
  }
  return (
    <ul aria-label="Evidence" className="mt-2 flex flex-wrap gap-2">
      {resolved.map((c, i) => (
        <li key={`${c.type}-${c.id}-${i}`}>
          <details
            className={
              c.found
                ? "rounded-md border border-zinc-400 px-2 py-1 text-sm dark:border-zinc-500"
                : "rounded-md border border-dashed border-zinc-400 px-2 py-1 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
            }
          >
            <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="font-medium">{TYPE_WORDS[c.type] ?? "Source"}</span>: {c.label}
            </summary>
            <p className="mt-1 max-w-prose whitespace-pre-wrap">
              {c.detail ?? "This source is not part of this report's data."}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
