import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";

export function StepsSection({
  steps,
  ws,
}: {
  steps: Workspace["steps"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
}) {
  const sources = buildSources(ws);
  return (
    <section id="steps" aria-labelledby="steps-heading" className="mt-10 scroll-mt-4">
      <h2 id="steps-heading" className="text-xl font-semibold">Inspection steps</h2>
      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No inspection steps were proposed.</p>
      ) : (
        <ol className="mt-3 list-decimal space-y-3 pl-6 text-sm">
          {steps.map((s) => (
            <li key={s.id}>
              <p className="whitespace-pre-wrap">{s.instruction}</p>
              <EvidenceChips citations={s.citations} sources={sources} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
