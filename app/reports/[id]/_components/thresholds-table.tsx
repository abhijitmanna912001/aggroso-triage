import { Badge } from "@/app/_components/ui/badge";
import type { Tone } from "@/lib/ui/classes";
import { sortThresholds, thresholdHint } from "@/lib/ui/workspace-view";
import type { Workspace } from "./evidence-chips";

const LOOKS: Record<string, { glyph: string; tone: Tone; border?: string }> = {
  CRITICAL: { glyph: "✕", tone: "danger" },
  CONFLICTING: { glyph: "⇄", tone: "info" },
  WARNING: { glyph: "▲", tone: "warning" },
  MISSING: { glyph: "?", tone: "neutral", border: "border-dashed" },
  OK: { glyph: "✓", tone: "success" },
};

const FALLBACK = { glyph: "•", tone: "neutral" as Tone, border: undefined };

// The left border only adds emphasis; the text badge in the status cell carries the meaning.
const ROW_EMPHASIS: Record<string, string> = {
  CRITICAL: "border-l-4 border-l-danger",
  WARNING: "border-l-4 border-l-warning",
};

export function ThresholdBadge({ status }: Readonly<{ status: string }>) {
  const look = LOOKS[status] ?? FALLBACK;
  return (
    <Badge tone={look.tone} className={look.border} icon={<span aria-hidden="true">{look.glyph}</span>}>
      {status}
    </Badge>
  );
}

export function ThresholdsTable({ thresholds }: Readonly<{ thresholds: Workspace["thresholds"] }>) {
  if (thresholds.length === 0) {
    return <p className="text-sm text-muted">No threshold checks were stored for this report.</p>;
  }
  const sorted = sortThresholds(thresholds);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Deterministic threshold checks, most serious first</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3 pl-2">Sensor</th>
            <th scope="col" className="py-2 pr-3">Status</th>
            <th scope="col" className="py-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const hint = thresholdHint(t.status);
            return (
              <tr
                key={t.id}
                className={`border-b border-line align-top last:border-b-0 ${ROW_EMPHASIS[t.status] ?? ""}`.trim()}
              >
                <th scope="row" className="py-2 pr-3 pl-2 text-sm font-medium normal-case tracking-normal text-foreground">
                  {t.sensor}
                </th>
                <td className="py-2 pr-3">
                  <ThresholdBadge status={t.status} />
                </td>
                <td className="py-2">
                  <p className="whitespace-pre-wrap">{t.message}</p>
                  {hint ? <p className="mt-1 text-muted">{hint}</p> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
