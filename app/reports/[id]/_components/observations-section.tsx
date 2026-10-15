import { Card } from "@/app/_components/ui/card";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";
import { ObservationForm } from "./observation-form";
import { SectionHeader } from "./report-header";
import { ThresholdsTable } from "./thresholds-table";

const MUTED = "text-sm text-muted";
const ROW = "rounded-md border border-line p-3 text-sm";
// Row headers inside a table keep the normal body look instead of the small uppercase column-header look.
const ROW_HEADER = "py-2 pr-3 text-sm font-medium normal-case tracking-normal text-foreground";

export function ObservationsSection({
  events,
  readings,
  thresholds,
  observations,
  reportId,
  signedIn,
}: Pick<Workspace, "events" | "readings" | "thresholds" | "observations"> & { reportId: number; signedIn: boolean }) {
  return (
    <Card as="section" id="observations" aria-labelledby="observations-heading" className="scroll-mt-20">
      <SectionHeader
        id="observations-heading"
        title="Observations"
        description="Facts that were reported or measured, not AI output."
        count={events.length + readings.length + observations.length}
      />

      <div className="space-y-6">
        <div className="space-y-2">
          <h3>Recent events</h3>
          {events.length === 0 ? (
            <p className={MUTED}>No events were reported.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className={ROW}>
                  <p>
                    <span className="font-medium">Event {e.id}</span>
                    <span className="text-muted"> · {formatUtc(e.occurredAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{e.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3>Sensor readings</h3>
          {readings.length === 0 ? (
            <p className={MUTED}>No sensor readings were provided.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Sensor readings submitted with this report</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3">Sensor</th>
                    <th scope="col" className="py-2 pr-3">Value</th>
                    <th scope="col" className="py-2 pr-3">Unit</th>
                    <th scope="col" className="py-2 pr-3">Source</th>
                    <th scope="col" className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <th scope="row" className={ROW_HEADER}>{r.sensor}</th>
                      <td className="py-2 pr-3">{r.value}</td>
                      <td className="py-2 pr-3">{r.unit}</td>
                      <td className="py-2 pr-3">{r.source}</td>
                      <td className="py-2 whitespace-nowrap">{formatUtc(r.recordedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3>Threshold checks</h3>
          <p className={MUTED}>Computed by fixed rules in code, not by the AI.</p>
          <ThresholdsTable thresholds={thresholds} />
        </div>

        <div className="space-y-2">
          <h3>Technician observations</h3>
          {observations.length === 0 ? (
            <p className={MUTED}>No observations have been added by technicians.</p>
          ) : (
            <ul className="space-y-2">
              {observations.map((o) => (
                <li key={o.id} className={ROW}>
                  <p className="whitespace-pre-wrap">{o.text}</p>
                  <p className="mt-1 text-muted">
                    {o.recordedBy} · {formatUtc(o.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <ObservationForm reportId={reportId} signedIn={signedIn} />
        </div>
      </div>
    </Card>
  );
}
