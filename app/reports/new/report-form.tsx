"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createReportAction } from "@/app/actions";
import { FieldErrors, FormError } from "@/app/_components/form-messages";
import { SubmitButton } from "@/app/_components/submit-button";
import { Button } from "@/app/_components/ui/button";
import { Card } from "@/app/_components/ui/card";
import { Field, Input, Select, Textarea } from "@/app/_components/ui/field";
import type { EquipmentType } from "@/generated/prisma/enums";
import { REPORT_LIMITS } from "@/lib/reports/schema";
import { SAMPLE_REPORTS } from "@/lib/samples";
import type { ActionResult } from "@/lib/server/action-result";
import { toIsoWithOffset } from "@/lib/ui/datetime";

export type FormEquipment = { id: number; tag: string; name: string; type: EquipmentType };
export type FormRule = {
  sensor: string;
  unit: string;
  direction: "high" | "low";
  warning: number;
  critical: number;
  expected: boolean;
};
export type FormRules = Record<EquipmentType, FormRule[]>;

// All entered values live in React state (controlled inputs). React resets uncontrolled forms after an action
// finishes, which would wipe the form on a failed submit. State also lets samples and equipment changes edit rows.
type EventRow = { key: number; description: string; occurredAt: string };
type ReadingRow = { key: number; sensor: string; value: string; recordedAt: string; source: string };

const TIME_KEY = /^(event|reading)\.\d+\.(occurredAt|recordedAt)$/;

const ROW = "rounded-md border border-line p-3";

// Local time to UTC happens here, in the browser, because only the browser knows the user's time zone.
async function submitReport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const converted = new FormData();
  for (const [key, value] of formData.entries()) {
    converted.append(key, typeof value === "string" && TIME_KEY.test(key) ? toIsoWithOffset(value) : value);
  }
  return createReportAction(converted);
}

// Hint under the sensor select, built from the rule the form already has. High sensors alarm from the limit up,
// low sensors at or below it.
function describeRule(rule: FormRule): string {
  const wording = rule.direction === "high" ? "from" : "at or below";
  return `${rule.unit}. Warning ${wording} ${rule.warning}, critical ${wording} ${rule.critical}.`;
}

function SectionHeading({ id, title, help }: { id: string; title: string; help: string }) {
  return (
    <div className="mb-4 space-y-1">
      <h2 id={id}>{title}</h2>
      <p className="text-sm text-muted">{help}</p>
    </div>
  );
}

export function ReportForm({ equipment, rules }: { equipment: FormEquipment[]; rules: FormRules }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(submitReport, null);

  const [equipmentId, setEquipmentId] = useState("");
  const [issue, setIssue] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  // Only ever increases, so a row number is never reused and error keys keep matching the right input.
  const nextKey = useRef(0);
  const takeKey = () => nextKey.current++;

  const selected = equipment.find((e) => String(e.id) === equipmentId);
  const sensors = selected ? rules[selected.type] : [];

  useEffect(() => {
    // redirectTo comes from our own action, but only a site-relative path is ever followed.
    if (state?.ok && state.redirectTo && state.redirectTo.startsWith("/") && !state.redirectTo.startsWith("//")) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const formError = state && !state.ok ? (state.formError ?? (hasFieldErrors ? "Check the highlighted fields." : null)) : null;

  function aria(name: string, extra?: string) {
    const invalid = (fieldErrors[name]?.length ?? 0) > 0;
    const describedBy = [extra, invalid ? `${name}-error` : undefined].filter(Boolean).join(" ");
    return {
      "aria-invalid": invalid ? (true as const) : undefined,
      "aria-describedby": describedBy === "" ? undefined : describedBy,
    };
  }

  function changeEquipment(id: string) {
    setEquipmentId(id);
    const next = equipment.find((e) => String(e.id) === id);
    const allowed = new Set((next ? rules[next.type] : []).map((r) => r.sensor));
    setReadings((rows) => rows.map((r) => (allowed.has(r.sensor) ? r : { ...r, sensor: "" })));
  }

  function loadSample(id: string) {
    const sample = SAMPLE_REPORTS.find((s) => s.id === id);
    if (!sample) return;
    const match = equipment.find((e) => e.tag === sample.equipmentTag);
    setEquipmentId(match ? String(match.id) : "");
    setSampleNote(match ? null : `Equipment ${sample.equipmentTag} was not found. Choose equipment yourself.`);
    setIssue(sample.issue);
    setEvents(sample.events.map((description) => ({ key: takeKey(), description, occurredAt: "" })));
    setReadings(
      sample.readings.map((r) => ({
        key: takeKey(),
        sensor: r.sensor,
        value: String(r.value),
        recordedAt: "",
        source: r.source ?? "",
      })),
    );
  }

  function patchEvent(key: number, patch: Partial<EventRow>) {
    setEvents((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function patchReading(key: number, patch: Partial<ReadingRow>) {
    setReadings((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Card as="section" aria-labelledby="section-sample">
        <SectionHeading
          id="section-sample"
          title="Start from a sample"
          help="Optional. Fills in the whole form so you can try the tool quickly."
        />
        <Field id="sample" label="Load a sample">
          {(p) => (
            <Select
              id={p.id}
              value=""
              onChange={(e) => loadSample(e.target.value)}
              aria-describedby="sample-hint"
            >
              <option value="">Choose a sample…</option>
              {SAMPLE_REPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p id="sample-hint" className="mt-1 text-sm text-muted">
          Replaces everything you have entered so far.
        </p>
        {sampleNote ? <p className="mt-1 text-sm">{sampleNote}</p> : null}
      </Card>

      <Card as="section" aria-labelledby="section-equipment">
        <SectionHeading
          id="section-equipment"
          title="Equipment and issue"
          help="Which machine has the problem, and what you are seeing."
        />
        <div className="space-y-4">
          <Field id="equipmentId" label="Equipment">
            {(p) => (
              <>
                <Select
                  id={p.id}
                  name="equipmentId"
                  value={equipmentId}
                  onChange={(e) => changeEquipment(e.target.value)}
                  {...aria("equipmentId")}
                >
                  <option value="">Choose equipment…</option>
                  {equipment.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.tag} - {e.name} ({e.type})
                    </option>
                  ))}
                </Select>
                <FieldErrors id="equipmentId-error" errors={fieldErrors.equipmentId} />
              </>
            )}
          </Field>

          <Field id="issue" label="Issue">
            {(p) => (
              <>
                <Textarea
                  id={p.id}
                  name="issue"
                  rows={5}
                  maxLength={REPORT_LIMITS.issueMax}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  {...aria("issue", "issue-count")}
                />
                <p id="issue-count" className="mt-1 text-sm text-muted">
                  {issue.length} / {REPORT_LIMITS.issueMax} characters (at least {REPORT_LIMITS.issueMin})
                </p>
                <FieldErrors id="issue-error" errors={fieldErrors.issue} />
              </>
            )}
          </Field>
        </div>
      </Card>

      <Card as="section" aria-labelledby="section-events">
        <SectionHeading
          id="section-events"
          title="Recent events"
          help="Optional. Anything that happened before the problem, such as maintenance or a process change."
        />
        <div className="space-y-3">
          {events.length > 0 ? (
            <ul className="space-y-3">
              {events.map((row, index) => {
                const d = `event.${row.key}.description`;
                const t = `event.${row.key}.occurredAt`;
                return (
                  <li key={row.key} className={`${ROW} grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end`}>
                    <Field id={d} label={`Event ${index + 1} description`}>
                      {(p) => (
                        <>
                          <Input
                            id={p.id}
                            name={d}
                            type="text"
                            maxLength={REPORT_LIMITS.eventMax}
                            value={row.description}
                            onChange={(e) => patchEvent(row.key, { description: e.target.value })}
                            {...aria(d)}
                          />
                          <FieldErrors id={`${d}-error`} errors={fieldErrors[d]} />
                        </>
                      )}
                    </Field>
                    <Field id={t} label={`Event ${index + 1} time`}>
                      {(p) => (
                        <>
                          <Input
                            id={p.id}
                            name={t}
                            type="datetime-local"
                            value={row.occurredAt}
                            onChange={(e) => patchEvent(row.key, { occurredAt: e.target.value })}
                            {...aria(t)}
                          />
                          <FieldErrors id={`${t}-error`} errors={fieldErrors[t]} />
                        </>
                      )}
                    </Field>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setEvents((rows) => rows.filter((r) => r.key !== row.key))}
                    >
                      Remove<span className="sr-only"> event {index + 1}</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <Button
            variant="secondary"
            disabled={events.length >= REPORT_LIMITS.events}
            onClick={() => setEvents((rows) => [...rows, { key: takeKey(), description: "", occurredAt: "" }])}
          >
            Add event
          </Button>
          {events.length >= REPORT_LIMITS.events ? (
            <p className="text-sm text-muted">Maximum of {REPORT_LIMITS.events} events.</p>
          ) : null}
        </div>
      </Card>

      <Card as="section" aria-labelledby="section-readings">
        <SectionHeading
          id="section-readings"
          title="Sensor readings"
          help="Optional. Any sensor the threshold checks expect that you leave out will be flagged as missing."
        />
        <div className="space-y-3">
          {readings.length > 0 ? (
            <ul className="space-y-3">
              {readings.map((row, index) => {
                const s = `reading.${row.key}.sensor`;
                const v = `reading.${row.key}.value`;
                const t = `reading.${row.key}.recordedAt`;
                const o = `reading.${row.key}.source`;
                const rule = sensors.find((r) => r.sensor === row.sensor);
                const noEquipmentHint = selected === undefined ? `${s}-hint` : undefined;
                const ruleHint = rule ? `${s}-rule` : undefined;
                return (
                  <li key={row.key} className={`${ROW} grid gap-3 sm:grid-cols-2`}>
                    <div>
                      <Field id={s} label={`Reading ${index + 1} sensor`}>
                        {(p) => (
                          <>
                            <Select
                              id={p.id}
                              name={s}
                              value={row.sensor}
                              disabled={selected === undefined}
                              onChange={(e) => patchReading(row.key, { sensor: e.target.value })}
                              {...aria(s, noEquipmentHint ?? ruleHint)}
                            >
                              <option value="">
                                {selected === undefined ? "Choose equipment first" : "Choose a sensor…"}
                              </option>
                              {sensors.map((r) => (
                                <option key={r.sensor} value={r.sensor}>
                                  {r.sensor} ({r.unit})
                                </option>
                              ))}
                            </Select>
                            {selected === undefined ? (
                              <span id={`${s}-hint`} className="sr-only">
                                Choose equipment to see its sensors
                              </span>
                            ) : null}
                            {rule ? (
                              <p id={`${s}-rule`} className="text-sm text-muted">
                                {describeRule(rule)}
                              </p>
                            ) : null}
                            <FieldErrors id={`${s}-error`} errors={fieldErrors[s]} />
                          </>
                        )}
                      </Field>
                    </div>
                    <Field id={v} label={`Reading ${index + 1} value${rule ? ` (${rule.unit})` : ""}`}>
                      {(p) => (
                        <>
                          <Input
                            id={p.id}
                            name={v}
                            type="number"
                            step="any"
                            inputMode="decimal"
                            value={row.value}
                            onChange={(e) => patchReading(row.key, { value: e.target.value })}
                            {...aria(v)}
                          />
                          <FieldErrors id={`${v}-error`} errors={fieldErrors[v]} />
                        </>
                      )}
                    </Field>
                    <Field id={t} label={`Reading ${index + 1} time`}>
                      {(p) => (
                        <>
                          <Input
                            id={p.id}
                            name={t}
                            type="datetime-local"
                            value={row.recordedAt}
                            onChange={(e) => patchReading(row.key, { recordedAt: e.target.value })}
                            {...aria(t)}
                          />
                          <FieldErrors id={`${t}-error`} errors={fieldErrors[t]} />
                        </>
                      )}
                    </Field>
                    <Field id={o} label={`Reading ${index + 1} source`}>
                      {(p) => (
                        <>
                          <Input
                            id={p.id}
                            name={o}
                            type="text"
                            maxLength={REPORT_LIMITS.sourceMax}
                            value={row.source}
                            onChange={(e) => patchReading(row.key, { source: e.target.value })}
                            {...aria(o)}
                          />
                          <FieldErrors id={`${o}-error`} errors={fieldErrors[o]} />
                        </>
                      )}
                    </Field>
                    <div className="sm:col-span-2">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setReadings((rows) => rows.filter((r) => r.key !== row.key))}
                      >
                        Remove<span className="sr-only"> reading {index + 1}</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <Button
            variant="secondary"
            disabled={readings.length >= REPORT_LIMITS.readings}
            onClick={() =>
              setReadings((rows) => [...rows, { key: takeKey(), sensor: "", value: "", recordedAt: "", source: "" }])
            }
          >
            Add reading
          </Button>
          {readings.length >= REPORT_LIMITS.readings ? (
            <p className="text-sm text-muted">Maximum of {REPORT_LIMITS.readings} readings.</p>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3">
        <FormError id="form-error" message={formError} />
        <SubmitButton label="Create report" pendingLabel="Creating report…" />
      </div>
    </form>
  );
}
