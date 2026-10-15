import { ReportStatusBadge } from "@/app/_components/status-badge";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";

export function ReportHeader({ report }: { report: Workspace["report"] }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Report #{report.id}</h1>
        <ReportStatusBadge status={report.status} />
      </div>
      <p className="mt-2 text-sm">
        <span className="font-medium">{report.equipment.tag}</span> · {report.equipment.name} · {report.equipment.type}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Reported by {report.reportedBy} on {formatUtc(report.createdAt)}
      </p>
      <p className="mt-4 max-w-prose whitespace-pre-wrap">{report.issue}</p>
    </header>
  );
}
