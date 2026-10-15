import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";
import { ObservationForm } from "./observation-form";
import { ThresholdsTable } from "./thresholds-table";

const MUTED = "text-sm text-zinc-600 dark:text-zinc-400";

export function ObservationsSection({
  events,
  readings,
  thresholds,
  observations,
  reportId,
  signedIn,
}: Pick<Workspace, "events" | "readings" | "thresholds" | "observations"> & { reportId: number; signedIn: boolean }) {
  return (
    <section id="observations" aria-labelledby="observations-heading" className="mt-10 scroll-mt-4">
      <h2 id="observations-heading" className="text-xl font-semibold">Observations</h2>
      <p className={`mt-1 ${MUTED}`}>Facts that were reported or measured, not AI output.</p>

      <h3 className="mt-6 font-medium">Recent events</h3>
      {events.length === 0 ? (
        <p className={`mt-2 ${MUTED}`}>No events were reported.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
              <p>
                <span className="font-medium">Event {e.id}</span>
                <span className="text-zinc-600 dark:text-zinc-400"> · {formatUtc(e.occurredAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap">{e.description}</p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 font-medium">Sensor readings</h3>
      {readings.length === 0 ? (
        <p className={`mt-2 ${MUTED}`}>No sensor readings were provided.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Sensor readings submitted with this report</caption>
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th scope="col" className="py-2 pr-3 font-medium">Sensor</th>
                <th scope="col" className="py-2 pr-3 font-medium">Value</th>
                <th scope="col" className="py-2 pr-3 font-medium">Unit</th>
                <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                <th scope="col" className="py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r, i) => (
                <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 pr-3 font-medium">{r.sensor}</th>
                  <td className="py-2 pr-3">{r.value}</td>
                  <td className="py-2 pr-3">{r.unit}</td>
                  <td className="py-2 pr-3">{r.source}</td>
                  <td className="whitespace-nowrap py-2">{formatUtc(r.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-6 font-medium">Threshold checks</h3>
      <p className={`mt-1 ${MUTED}`}>Computed by fixed rules in code, not by the AI.</p>
      <div className="mt-2">
        <ThresholdsTable thresholds={thresholds} />
      </div>

      <h3 className="mt-6 font-medium">Technician observations</h3>
      {observations.length === 0 ? (
        <p className={`mt-2 ${MUTED}`}>No observations have been added by technicians.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {observations.map((o) => (
            <li key={o.id} className="rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
              <p className="whitespace-pre-wrap">{o.text}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {o.recordedBy} · {formatUtc(o.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ObservationForm reportId={reportId} signedIn={signedIn} />
    </section>
  );
}
