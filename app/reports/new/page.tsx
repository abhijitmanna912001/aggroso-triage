import { Suspense } from "react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { listEquipment } from "@/lib/server/queries";
import { getTechnician } from "@/lib/server/session";
import { getRules } from "@/lib/thresholds/rules";
import { Alert } from "../../_components/ui/alert";
import { PageHeader } from "../../_components/ui/page-header";
import { Skeleton } from "../../_components/ui/skeleton";
import { ReportForm, type FormRules } from "./report-form";

const TYPES: EquipmentType[] = ["PUMP", "COMPRESSOR", "MOTOR"];

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading form" className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// Reads the cookie and the database, so it runs inside <Suspense>.
async function NewReportContent() {
  const technician = await getTechnician();
  if (technician === null) {
    return (
      <Alert tone="info" title="Choose your name first">
        Every action is recorded under a technician name. Use the name picker in the header, then come back to this
        page.
      </Alert>
    );
  }

  const equipment = await listEquipment();
  if (equipment.length === 0) {
    return <Alert tone="warning">No equipment found. Run the seed first.</Alert>;
  }

  // Plain data only: the conflict tolerance stays on the server.
  const rules = {} as FormRules;
  for (const type of TYPES) {
    rules[type] = getRules(type).map((r) => ({
      sensor: r.sensor,
      unit: r.unit,
      direction: r.direction,
      warning: r.warning,
      critical: r.critical,
      expected: r.expected,
    }));
  }

  return (
    <ReportForm
      equipment={equipment.map((e) => ({ id: e.id, tag: e.tag, name: e.name, type: e.type }))}
      rules={rules}
    />
  );
}

export default function NewReportPage() {
  return (
    <div>
      <PageHeader title="New report" description="Describe the problem. Checks and analysis run after you submit." />
      <Suspense fallback={<FormSkeleton />}>
        <NewReportContent />
      </Suspense>
    </div>
  );
}
