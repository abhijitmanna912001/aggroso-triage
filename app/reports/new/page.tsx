import { Suspense } from "react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { listEquipment } from "@/lib/server/queries";
import { getTechnician } from "@/lib/server/session";
import { getRules } from "@/lib/thresholds/rules";
import { ReportForm, type FormRules } from "./report-form";

const TYPES: EquipmentType[] = ["PUMP", "COMPRESSOR", "MOTOR"];

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading form" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

// Reads the cookie and the database, so it runs inside <Suspense>.
async function NewReportContent() {
  const technician = await getTechnician();
  if (technician === null) {
    return (
      <div className="rounded-md border border-zinc-300 p-6 dark:border-zinc-700">
        <h2 className="font-medium">Choose your name first</h2>
        <p className="mt-2 text-sm">
          Every action is recorded under a technician name. Use the name picker in the header, then come back to this
          page.
        </p>
      </div>
    );
  }

  const equipment = await listEquipment();
  if (equipment.length === 0) {
    return (
      <div className="rounded-md border border-zinc-300 p-6 dark:border-zinc-700">
        <p>No equipment found. Run the seed first.</p>
      </div>
    );
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New report</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewReportContent />
      </Suspense>
    </div>
  );
}
