type Look = { text: string; glyph: string; classes: string };

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

const REPORT: Record<string, Look> = {
  OPEN: {
    text: "Open",
    glyph: "●",
    classes: "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100",
  },
  CLOSED: {
    text: "Closed",
    glyph: "■",
    classes: "border-zinc-500 bg-zinc-100 text-zinc-800 dark:border-zinc-400 dark:bg-zinc-800 dark:text-zinc-100",
  },
};

const WORK_ORDER: Record<string, Look> = {
  DRAFT: {
    text: "Draft",
    glyph: "✎",
    classes:
      "border-dashed border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  APPROVED: {
    text: "Approved",
    glyph: "✓",
    classes:
      "border-green-700 bg-green-50 text-green-900 dark:border-green-400 dark:bg-green-950 dark:text-green-100",
  },
  REJECTED: {
    text: "Rejected",
    glyph: "✕",
    classes: "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
  },
};

const NONE: Look = {
  text: "No work order",
  glyph: "–",
  classes: "border-dotted border-zinc-500 text-zinc-700 dark:border-zinc-400 dark:text-zinc-300",
};

function Pill({ look }: { look: Look }) {
  return (
    <span className={`${BASE} ${look.classes}`}>
      <span aria-hidden="true">{look.glyph}</span>
      {look.text}
    </span>
  );
}

export function ReportStatusBadge({ status }: { status: string }) {
  return <Pill look={REPORT[status] ?? { ...NONE, text: status }} />;
}

export function WorkOrderStatusBadge({ status }: { status: string | null }) {
  return <Pill look={status === null ? NONE : (WORK_ORDER[status] ?? { ...NONE, text: status })} />;
}
