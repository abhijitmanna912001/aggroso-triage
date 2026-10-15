import { AlertTriangle, Clock, Info, Question } from "@/app/_components/ui/icons";
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
const TYPE_ICONS: Record<string, typeof Info> = { manual: Info, event: Clock, threshold: AlertTriangle };

// Every label and detail is rendered as text. The type word stays visible, the icon is decoration.
export function EvidenceChips({ citations, sources }: { citations: Citation[]; sources: EvidenceSources }) {
  const resolved = resolveCitations(citations, sources);
  if (resolved.length === 0) {
    return <p className="mt-3 text-sm text-muted">No evidence cited</p>;
  }
  return (
    <ul aria-label="Evidence" className="mt-3 flex flex-wrap items-start gap-2">
      {resolved.map((c, i) => {
        const TypeIcon = c.found ? (TYPE_ICONS[c.type] ?? Info) : Question;
        return (
          <li key={`${c.type}-${c.id}-${i}`} className="max-w-full">
            <details
              className={
                c.found
                  ? "rounded-2xl border border-line bg-surface px-3 py-1 text-sm"
                  : "rounded-2xl border border-dashed border-line px-3 py-1 text-sm text-muted"
              }
            >
              <summary className="flex items-center gap-1.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <TypeIcon />
                <span>
                  <span className="font-medium">{TYPE_WORDS[c.type] ?? "Source"}</span>: {c.label}
                </span>
              </summary>
              <p className="mt-1 max-w-prose whitespace-pre-wrap">
                {c.detail ?? "This source is not part of this report's data."}
              </p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
