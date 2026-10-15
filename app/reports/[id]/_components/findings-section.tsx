import { Card } from "@/app/_components/ui/card";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";
import { FindingForm } from "./finding-form";
import { SectionHeader } from "./report-header";

export function FindingsSection({
  findings,
  hypotheses,
  reportId,
  signedIn,
}: Readonly<{
  findings: Workspace["findings"];
  hypotheses: Workspace["hypotheses"];
  reportId: number;
  signedIn: boolean;
}>) {
  const causes = new Map(hypotheses.map((h) => [h.id, h.cause] as const));
  return (
    <Card as="section" id="findings" aria-labelledby="findings-heading" className="scroll-mt-20">
      <SectionHeader
        id="findings-heading"
        title="Confirmed findings"
        description="Entered by a named technician."
        count={findings.length}
      />
      {findings.length === 0 ? (
        <p className="text-sm text-muted">No findings confirmed yet. Only a technician can confirm a finding.</p>
      ) : (
        <ul className="space-y-3">
          {findings.map((f) => {
            const cause = f.hypothesisId === null ? undefined : causes.get(f.hypothesisId);
            return (
              <li key={f.id} className="rounded-md border border-line p-4 text-sm">
                <p className="whitespace-pre-wrap">{f.description}</p>
                <p className="mt-1 text-muted">
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
      <FindingForm
        reportId={reportId}
        signedIn={signedIn}
        hypotheses={hypotheses.map((h) => ({ id: h.id, cause: h.cause }))}
      />
    </Card>
  );
}
