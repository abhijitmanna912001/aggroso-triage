import type { Tone } from "@/lib/ui/classes";
import { Badge } from "./ui/badge";
import { Check, Dot, Pencil, Question, X } from "./ui/icons";

type Look = { text: string; tone: Tone; icon: "check" | "dot" | "pencil" | "question" | "x"; border?: string };

const ICONS = {
  check: Check,
  dot: Dot,
  pencil: Pencil,
  question: Question,
  x: X,
};

const REPORT: Record<string, Look> = {
  OPEN: { text: "Open", tone: "info", icon: "dot" },
  CLOSED: { text: "Closed", tone: "neutral", icon: "check" },
};

// Dashed and dotted borders stay, so the state is not carried by color alone.
const WORK_ORDER: Record<string, Look> = {
  DRAFT: { text: "Draft", tone: "warning", icon: "pencil", border: "border-dashed" },
  APPROVED: { text: "Approved", tone: "success", icon: "check" },
  REJECTED: { text: "Rejected", tone: "danger", icon: "x" },
};

const NONE: Look = { text: "No work order", tone: "neutral", icon: "dot", border: "border-dotted" };

function Pill({ look }: Readonly<{ look: Look }>) {
  const Icon = ICONS[look.icon];
  return (
    <Badge tone={look.tone} icon={<Icon />} className={look.border}>
      {look.text}
    </Badge>
  );
}

export function ReportStatusBadge({ status }: Readonly<{ status: string }>) {
  return <Pill look={REPORT[status] ?? { ...NONE, text: status, icon: "question" }} />;
}

export function WorkOrderStatusBadge({ status }: Readonly<{ status: string | null }>) {
  return (
    <Pill look={status === null ? NONE : (WORK_ORDER[status] ?? { ...NONE, text: status, icon: "question" })} />
  );
}
