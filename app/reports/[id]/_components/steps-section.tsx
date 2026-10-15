import { Card } from "@/app/_components/ui/card";
import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";
import { SectionHeader } from "./report-header";

export function StepsSection({
  steps,
  ws,
}: Readonly<{
  steps: Workspace["steps"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
}>) {
  const sources = buildSources(ws);
  return (
    <Card as="section" id="steps" aria-labelledby="steps-heading" className="scroll-mt-20">
      <SectionHeader
        id="steps-heading"
        title="Inspection steps"
        description="Checks the AI suggests, in order."
        count={steps.length}
      />
      {steps.length === 0 ? (
        <p className="text-sm text-muted">No inspection steps were proposed.</p>
      ) : (
        <ol className="space-y-3 text-sm">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold"
              >
                {i + 1}
              </span>
              <div className="min-w-0 grow">
                <p className="whitespace-pre-wrap">{s.instruction}</p>
                <EvidenceChips citations={s.citations} sources={sources} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
