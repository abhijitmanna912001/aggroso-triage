import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

const CONFIDENCE: Record<string, string> = { LOW: "▁", MEDIUM: "▃", HIGH: "▇" };

function emptyReason(run: Workspace["latestRun"]): string {
  if (run === null) return "No analysis has been run yet, so there are no possible causes.";
  if (run.status === "FAILED") return "The latest analysis failed, so no possible causes were proposed.";
  return "The latest analysis proposed no possible cause that passed validation.";
}

export function CausesSection({
  hypotheses,
  run,
  ws,
}: {
  hypotheses: Workspace["hypotheses"];
  run: Workspace["latestRun"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
}) {
  const sources = buildSources(ws);
  return (
    <section id="causes" aria-labelledby="causes-heading" className="mt-10 scroll-mt-4">
      <h2 id="causes-heading" className="text-xl font-semibold">Possible causes</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Proposed by the AI, not confirmed.</p>
      {hypotheses.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{emptyReason(run)}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {hypotheses.map((h) => (
            <li key={h.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`${BASE} border-dashed border-zinc-500 text-zinc-800 dark:border-zinc-400 dark:text-zinc-200`}
                >
                  <span aria-hidden="true">?</span>
                  Unconfirmed
                </span>
                <span className={`${BASE} border-zinc-500 text-zinc-800 dark:border-zinc-400 dark:text-zinc-200`}>
                  <span aria-hidden="true">{CONFIDENCE[h.confidence] ?? "▁"}</span>
                  Confidence: {h.confidence}
                </span>
              </div>
              <p className="mt-2 font-medium whitespace-pre-wrap">{h.cause}</p>
              <p className="mt-1 whitespace-pre-wrap">{h.rationale}</p>
              <EvidenceChips citations={h.citations} sources={sources} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
