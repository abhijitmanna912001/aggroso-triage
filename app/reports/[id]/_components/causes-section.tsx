import { Badge } from "@/app/_components/ui/badge";
import { Card } from "@/app/_components/ui/card";
import type { Tone } from "@/lib/ui/classes";
import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";
import { SectionHeader } from "./report-header";

const CONFIDENCE: Record<string, { glyph: string; tone: Tone }> = {
  LOW: { glyph: "▁", tone: "neutral" },
  MEDIUM: { glyph: "▃", tone: "info" },
  HIGH: { glyph: "▇", tone: "info" },
};

function emptyReason(run: Workspace["latestRun"]): string {
  if (run === null) return "No analysis has been run yet, so there are no possible causes.";
  if (run.status === "FAILED") return "The latest analysis failed, so no possible causes were proposed.";
  return "The latest analysis proposed no possible cause that passed validation.";
}

export function CausesSection({
  hypotheses,
  run,
  ws,
}: Readonly<{
  hypotheses: Workspace["hypotheses"];
  run: Workspace["latestRun"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
}>) {
  const sources = buildSources(ws);
  return (
    <Card as="section" id="causes" aria-labelledby="causes-heading" className="scroll-mt-20">
      <SectionHeader
        id="causes-heading"
        title="Possible causes"
        description="Proposed by the AI, not confirmed."
        count={hypotheses.length}
      />
      {hypotheses.length === 0 ? (
        <p className="text-sm text-muted">{emptyReason(run)}</p>
      ) : (
        <ul className="space-y-3">
          {hypotheses.map((h) => {
            const confidence = CONFIDENCE[h.confidence] ?? { glyph: "▁", tone: "neutral" as Tone };
            return (
              <li key={h.id} className="rounded-md border border-line p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" className="border-dashed" icon={<span aria-hidden="true">?</span>}>
                    Unconfirmed
                  </Badge>
                  <Badge tone={confidence.tone} icon={<span aria-hidden="true">{confidence.glyph}</span>}>
                    Confidence: {h.confidence}
                  </Badge>
                </div>
                <p className="mt-2 font-medium whitespace-pre-wrap">{h.cause}</p>
                <p className="mt-1 whitespace-pre-wrap">{h.rationale}</p>
                <EvidenceChips citations={h.citations} sources={sources} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
