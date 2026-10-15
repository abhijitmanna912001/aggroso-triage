import { Alert } from "@/app/_components/ui/alert";
import { Badge } from "@/app/_components/ui/badge";
import { Card } from "@/app/_components/ui/card";
import type { Tone } from "@/lib/ui/classes";
import { formatUtc } from "@/lib/ui/format";
import {
  describeFailureStage,
  describeRetrieval,
  describeWorkOrderAction,
  parseRunNotes,
} from "@/lib/ui/workspace-view";
import { AnalyzeButton } from "./analyze-button";
import type { Workspace } from "./evidence-chips";
import { SectionHeader } from "./report-header";

const RUN_LOOKS: Record<string, { glyph: string; tone: Tone }> = {
  SUCCESS: { glyph: "✓", tone: "success" },
  DEGRADED: { glyph: "▲", tone: "warning" },
  FAILED: { glyph: "✕", tone: "danger" },
};

function RunStatusBadge({ status }: Readonly<{ status: string }>) {
  const look = RUN_LOOKS[status] ?? { glyph: "•", tone: "neutral" as Tone };
  return (
    <Badge tone={look.tone} icon={<span aria-hidden="true">{look.glyph}</span>}>
      {status}
    </Badge>
  );
}

const DETAILS = "rounded-md border border-line p-3";
const SUMMARY = "rounded-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AnalysisPanel({
  run,
  chunks,
  reportId,
  signedIn,
}: Readonly<{
  run: Workspace["latestRun"];
  chunks: Workspace["chunks"];
  reportId: number;
  signedIn: boolean;
}>) {
  const notes = run ? parseRunNotes(run.validationNotes) : null;

  return (
    <Card as="section" id="analysis" aria-labelledby="analysis-heading" className="scroll-mt-20">
      <SectionHeader
        id="analysis-heading"
        title="Analysis"
        description="Run the AI on this report. It proposes; a technician decides."
      />
      <AnalyzeButton reportId={reportId} signedIn={signedIn} hasRun={run !== null} />

      {run === null || notes === null ? (
        <p className="mt-4 text-sm text-muted">No analysis has been run for this report.</p>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface p-3">
            <RunStatusBadge status={run.status} />
            <span>Model: {run.model}</span>
            <span>{run.latencyMs === null ? "Time taken unknown" : `Took ${(run.latencyMs / 1000).toFixed(1)} s`}</span>
            <span className="text-muted">Ran {formatUtc(run.createdAt)}</span>
            <span>Retrieval: {describeRetrieval(run.retrievalMode)}</span>
          </div>

          {run.status === "FAILED" ? (
            <Alert tone="danger" title={describeFailureStage(run.errorStage)}>
              {run.errorMessage ? <p className="whitespace-pre-wrap">{run.errorMessage}</p> : null}
            </Alert>
          ) : null}

          {run.retrievalMode === "KEYWORD_ONLY" || run.retrievalMode === "NONE" ? (
            <Alert tone="warning">
              {run.retrievalMode === "KEYWORD_ONLY"
                ? "Results may be less relevant because semantic search was not used."
                : "The analysis had no manual sections to cite."}
            </Alert>
          ) : null}

          {notes.retrievalWarnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {notes.retrievalWarnings.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">{w.stage}:</span> <span className="whitespace-pre-wrap">{w.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {notes.degradedReasons.length > 0 ? (
            <div>
              <p className="font-medium">Why this run is degraded</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.degradedReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p>{describeWorkOrderAction(notes.workOrderAction)}</p>
          {notes.priorityRaisedByFloor ? <p>The priority was raised by the deterministic threshold rules</p> : null}

          <details className={DETAILS}>
            <summary className={SUMMARY}>Retrieved manual sections ({chunks.length})</summary>
            {chunks.length === 0 ? (
              <p className="mt-2 text-muted">No manual sections were retrieved.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {chunks.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.sectionRef}</span> {c.heading}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className={DETAILS}>
            <summary className={SUMMARY}>Dropped items ({notes.dropped.length})</summary>
            {notes.dropped.length === 0 ? (
              <p className="mt-2 text-muted">Nothing was dropped by validation.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {notes.dropped.map((d, i) => (
                  <li key={i}>
                    {d.kind} {d.index + 1}: {d.reason}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className={DETAILS}>
            <summary className={SUMMARY}>Notes ({notes.notes.length})</summary>
            {notes.notes.length === 0 ? (
              <p className="mt-2 text-muted">There are no notes for this run.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {notes.notes.map((n, i) => (
                  <li key={i} className="whitespace-pre-wrap">{n}</li>
                ))}
              </ul>
            )}
          </details>
        </div>
      )}
    </Card>
  );
}
