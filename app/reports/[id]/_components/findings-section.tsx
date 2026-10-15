import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";

export function FindingsSection({
  findings,
  hypotheses,
}: {
  findings: Workspace["findings"];
  hypotheses: Workspace["hypotheses"];
}) {
  const causes = new Map(hypotheses.map((h) => [h.id, h.cause] as const));
  return (
    <section id="findings" aria-labelledby="findings-heading" className="mt-10 scroll-mt-4">
      <h2 id="findings-heading" className="text-xl font-semibold">Confirmed findings</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Entered by a named technician.</p>
      {findings.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          No findings confirmed yet. Only a technician can confirm a finding.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {findings.map((f) => {
            const cause = f.hypothesisId === null ? undefined : causes.get(f.hypothesisId);
            return (
              <li key={f.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                <p className="whitespace-pre-wrap">{f.description}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Confirmed by {f.confirmedBy} · {formatUtc(f.createdAt)}
                </p>
                {cause ? (
                  <p className="mt-2">
                    <span className="font-medium">Related possible cause:</span>{" "}
                    <span className="whitespace-pre-wrap">{cause}</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
