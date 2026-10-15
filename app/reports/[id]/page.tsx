import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/app/_components/ui/card";
import { getReportWorkspace } from "@/lib/server/queries";
import { getTechnician } from "@/lib/server/session";
import { AnalysisPanel } from "./_components/analysis-panel";
import { CausesSection } from "./_components/causes-section";
import { FindingsSection } from "./_components/findings-section";
import { ObservationsSection } from "./_components/observations-section";
import { QuestionsSection } from "./_components/questions-section";
import { ReportHeader } from "./_components/report-header";
import { SectionNav } from "./_components/section-nav";
import { SignedInBanner } from "./_components/signed-in-banner";
import { StepsSection } from "./_components/steps-section";
import { WorkOrderSection } from "./_components/work-order-section";
import { WorkOrderSummary } from "./_components/work-order-summary";
import Loading from "./loading";

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
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* One nav list. Below lg it sits directly under the header as a scrollable bar (the aside has no box of its
            own); from lg it is the sticky right rail together with the work order summary. */}
        <aside
          aria-label="Report navigation"
          className="contents lg:col-start-2 lg:row-start-2 lg:block lg:space-y-4 lg:self-start lg:sticky lg:top-20"
        >
          <SectionNav />
          <div className="hidden lg:block">
            <WorkOrderSummary workOrder={ws.workOrder} />
          </div>
        </aside>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">Issue</h2>
          <p className="max-w-prose whitespace-pre-wrap">{ws.report.issue}</p>
        </Card>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
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
      </div>
    </div>
  );
}

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Workspace params={params} />
    </Suspense>
  );
}
