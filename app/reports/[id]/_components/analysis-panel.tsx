import { formatUtc } from "@/lib/ui/format";
import {
  describeFailureStage,
  describeRetrieval,
  describeWorkOrderAction,
  parseRunNotes,
} from "@/lib/ui/workspace-view";
import { AnalyzeButton } from "./analyze-button";
import type { Workspace } from "./evidence-chips";

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

const RUN_LOOKS: Record<string, { glyph: string; classes: string }> = {
  SUCCESS: {
    glyph: "✓",
    classes: "border-green-700 bg-green-50 text-green-900 dark:border-green-400 dark:bg-green-950 dark:text-green-100",
  },
  DEGRADED: {
    glyph: "▲",
    classes: "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  FAILED: {
    glyph: "✕",
    classes: "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
  },
};

function RunStatusBadge({ status }: { status: string }) {
  const look = RUN_LOOKS[status] ?? { glyph: "•", classes: "border-zinc-500" };
  return (
    <span className={`${BASE} ${look.classes}`}>
      <span aria-hidden="true">{look.glyph}</span>
      {status}
    </span>
  );
}

const MUTED = "text-zinc-600 dark:text-zinc-400";

export function AnalysisPanel({
  run,
  chunks,
  reportId,
  signedIn,
}: {
  run: Workspace["latestRun"];
  chunks: Workspace["chunks"];
  reportId: number;
  signedIn: boolean;
}) {
  const notes = run ? parseRunNotes(run.validationNotes) : null;

  return (
    <section id="analysis" aria-labelledby="analysis-heading" className="mt-10 scroll-mt-4">
      <h2 id="analysis-heading" className="text-xl font-semibold">Analysis</h2>
      <div className="mt-3">
        <AnalyzeButton reportId={reportId} signedIn={signedIn} hasRun={run !== null} />
      </div>

      {run === null || notes === null ? (
        <p className={`mt-4 text-sm ${MUTED}`}>No analysis has been run for this report.</p>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <RunStatusBadge status={run.status} />
            <span>Model: {run.model}</span>
            <span>{run.latencyMs === null ? "Time taken unknown" : `Took ${(run.latencyMs / 1000).toFixed(1)} s`}</span>
            <span className={MUTED}>Ran {formatUtc(run.createdAt)}</span>
          </div>

          {run.status === "FAILED" ? (
            <div
              role="alert"
              className="rounded-md border border-red-600 bg-red-50 p-3 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100"
            >
              <p className="font-medium">
                <span aria-hidden="true">✕ </span>
                {describeFailureStage(run.errorStage)}
              </p>
              {run.errorMessage ? <p className="mt-1 whitespace-pre-wrap">{run.errorMessage}</p> : null}
            </div>
          ) : null}

          <div>
            <h3 className="font-medium">Retrieval</h3>
            <p className="mt-1">{describeRetrieval(run.retrievalMode)}</p>
            {run.retrievalMode === "KEYWORD_ONLY" || run.retrievalMode === "NONE" ? (
              <p className="mt-2 rounded-md border border-amber-700 bg-amber-50 p-3 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100">
                <span aria-hidden="true">▲ </span>
                {run.retrievalMode === "KEYWORD_ONLY"
                  ? "Results may be less relevant because semantic search was not used."
                  : "The analysis had no manual sections to cite."}
              </p>
            ) : null}
            {notes.retrievalWarnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {notes.retrievalWarnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.stage}:</span> <span className="whitespace-pre-wrap">{w.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {notes.degradedReasons.length > 0 ? (
            <div>
              <h3 className="font-medium">Why this run is degraded</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.degradedReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {notes.dropped.length > 0 ? (
            <div>
              <h3 className="font-medium">Dropped by validation</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.dropped.map((d, i) => (
                  <li key={i}>
                    {d.kind} {d.index + 1}: {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {notes.notes.length > 0 ? (
            <div>
              <h3 className="font-medium">Notes</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.notes.map((n, i) => (
                  <li key={i} className="whitespace-pre-wrap">{n}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p>{describeWorkOrderAction(notes.workOrderAction)}</p>
          {notes.priorityRaisedByFloor ? <p>The priority was raised by the deterministic threshold rules</p> : null}

          <div>
            <h3 className="font-medium">Manual sections retrieved</h3>
            {chunks.length === 0 ? (
              <p className={`mt-1 ${MUTED}`}>No manual sections were retrieved.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {chunks.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.sectionRef}</span> {c.heading}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
