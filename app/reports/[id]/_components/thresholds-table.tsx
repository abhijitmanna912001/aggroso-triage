import { sortThresholds, thresholdHint } from "@/lib/ui/workspace-view";
import type { Workspace } from "./evidence-chips";

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

const LOOKS: Record<string, { glyph: string; classes: string }> = {
  CRITICAL: {
    glyph: "✕",
    classes: "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
  },
  CONFLICTING: {
    glyph: "⇄",
    classes:
      "border-purple-700 bg-purple-50 text-purple-900 dark:border-purple-400 dark:bg-purple-950 dark:text-purple-100",
  },
  WARNING: {
    glyph: "▲",
    classes: "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  MISSING: {
    glyph: "?",
    classes: "border-dashed border-zinc-500 text-zinc-800 dark:border-zinc-400 dark:text-zinc-200",
  },
  OK: {
    glyph: "✓",
    classes: "border-green-700 bg-green-50 text-green-900 dark:border-green-400 dark:bg-green-950 dark:text-green-100",
  },
};

const FALLBACK = { glyph: "•", classes: "border-zinc-500 text-zinc-800 dark:border-zinc-400 dark:text-zinc-200" };

export function ThresholdBadge({ status }: { status: string }) {
  const look = LOOKS[status] ?? FALLBACK;
  return (
    <span className={`${BASE} ${look.classes}`}>
      <span aria-hidden="true">{look.glyph}</span>
      {status}
    </span>
  );
}

export function ThresholdsTable({ thresholds }: { thresholds: Workspace["thresholds"] }) {
  if (thresholds.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No threshold checks were stored for this report.</p>;
  }
  const sorted = sortThresholds(thresholds);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Deterministic threshold checks, most serious first</caption>
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th scope="col" className="py-2 pr-3 font-medium">Sensor</th>
            <th scope="col" className="py-2 pr-3 font-medium">Status</th>
            <th scope="col" className="py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const hint = thresholdHint(t.status);
            return (
              <tr key={t.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                <th scope="row" className="py-2 pr-3 font-medium">{t.sensor}</th>
                <td className="py-2 pr-3">
                  <ThresholdBadge status={t.status} />
                </td>
                <td className="py-2">
                  <p className="whitespace-pre-wrap">{t.message}</p>
                  {hint ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{hint}</p> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
