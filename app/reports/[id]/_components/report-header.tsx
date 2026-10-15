import Link from "next/link";
import type { ReactNode } from "react";
import { ReportStatusBadge } from "@/app/_components/status-badge";
import { Badge } from "@/app/_components/ui/badge";
import { PageHeader } from "@/app/_components/ui/page-header";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";

export function ReportHeader({ report }: { report: Workspace["report"] }) {
  return (
    <PageHeader
      title={`Report #${report.id}`}
      description={
        <>
          <Link
            href={`/equipment/${report.equipment.id}`}
            className="font-medium text-accent underline underline-offset-2 hover:no-underline"
          >
            {report.equipment.tag}
          </Link>{" "}
          · {report.equipment.name} · {report.equipment.type}
          <span className="mt-1 block">
            Reported by {report.reportedBy} on {formatUtc(report.createdAt)}
          </span>
        </>
      }
      actions={<ReportStatusBadge status={report.status} />}
    />
  );
}

// The shared header of every workspace section card: the h2, one muted line and an optional count.
export function SectionHeader({
  id,
  title,
  description,
  count,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-4 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={id} className="font-semibold">{title}</h2>
        {count === undefined ? null : (
          <Badge tone="neutral">
            {count}
            <span className="sr-only"> in this section</span>
          </Badge>
        )}
      </div>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </div>
  );
}
