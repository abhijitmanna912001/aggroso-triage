import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getReportWorkspace } from "@/lib/server/queries";
import { getTechnician } from "@/lib/server/session";
import { AnalysisPanel } from "./_components/analysis-panel";
import { CausesSection } from "./_components/causes-section";
import { FindingsSection } from "./_components/findings-section";
import { ObservationsSection } from "./_components/observations-section";
import { QuestionsSection } from "./_components/questions-section";
import { ReportHeader } from "./_components/report-header";
import { SignedInBanner } from "./_components/signed-in-banner";
import { StepsSection } from "./_components/steps-section";
import { WorkOrderSection } from "./_components/work-order-section";

const NAV = [
  ["observations", "Observations"],
  ["analysis", "Analysis"],
  ["causes", "Possible causes"],
  ["findings", "Confirmed findings"],
  ["questions", "Follow-up questions"],
  ["steps", "Inspection steps"],
  ["work-order", "Work order"],
] as const;

function Skeleton() {
  return (
    <div role="status" aria-label="Loading report" className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

// params and the cookie are request data and the reads are uncached, so all of it happens here, under <Suspense>.
// A failed query is not caught, so it reaches app/error.tsx.
async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const reportId = /^[0-9]+$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(reportId) || reportId <= 0) notFound();

  const ws = await getReportWorkspace(reportId);
  if (ws === null) notFound();

  const signedIn = (await getTechnician()) !== null;

  return (
    <div>
      {signedIn ? null : <SignedInBanner />}
      <ReportHeader report={ws.report} />
      <nav aria-label="Report sections" className="mt-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {NAV.map(([anchor, label]) => (
            <li key={anchor}>
              <Link href={`#${anchor}`} className="underline underline-offset-2 hover:no-underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ObservationsSection
        events={ws.events}
        readings={ws.readings}
        thresholds={ws.thresholds}
        observations={ws.observations}
        reportId={ws.report.id}
        signedIn={signedIn}
      />
      <AnalysisPanel run={ws.latestRun} chunks={ws.chunks} reportId={ws.report.id} signedIn={signedIn} />
      <CausesSection hypotheses={ws.hypotheses} run={ws.latestRun} ws={ws} />
      <FindingsSection
        findings={ws.findings}
        hypotheses={ws.hypotheses}
        reportId={ws.report.id}
        signedIn={signedIn}
      />
      <QuestionsSection questions={ws.questions} ws={ws} reportId={ws.report.id} signedIn={signedIn} />
      <StepsSection steps={ws.steps} ws={ws} />
      <WorkOrderSection workOrder={ws.workOrder} reportId={ws.report.id} signedIn={signedIn} />
    </div>
  );
}

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Workspace params={params} />
    </Suspense>
  );
}
