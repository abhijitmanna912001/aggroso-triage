"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createReportAction } from "@/app/actions";
import { FieldErrors, FormError } from "@/app/_components/form-messages";
import { SubmitButton } from "@/app/_components/submit-button";
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

const INPUT =
  "w-full rounded-md border border-zinc-400 bg-transparent px-2 py-1.5 text-sm dark:bg-zinc-900 aria-[invalid=true]:border-red-600 aria-[invalid=true]:border-2 dark:aria-[invalid=true]:border-red-400";
const BUTTON =
  "rounded-md border border-zinc-400 px-3 py-1.5 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800";
const LABEL = "mb-1 block text-sm font-medium";

// Local time to UTC happens here, in the browser, because only the browser knows the user's time zone.
async function submitReport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const converted = new FormData();
  for (const [key, value] of formData.entries()) {
    converted.append(key, typeof value === "string" && TIME_KEY.test(key) ? toIsoWithOffset(value) : value);
  }
  return createReportAction(converted);
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
    <form action={formAction} className="space-y-8" noValidate>
      <div>
        <label htmlFor="sample" className={LABEL}>
          Load a sample
        </label>
        <select
          id="sample"
          value=""
          onChange={(e) => loadSample(e.target.value)}
          aria-describedby="sample-hint"
          className={INPUT}
        >
          <option value="">Choose a sample…</option>
          {SAMPLE_REPORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p id="sample-hint" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Replaces everything you have entered so far.
        </p>
        {sampleNote ? <p className="mt-1 text-sm">{sampleNote}</p> : null}
      </div>

      <div>
        <label htmlFor="equipmentId" className={LABEL}>
          Equipment
        </label>
        <select
          id="equipmentId"
          name="equipmentId"
          value={equipmentId}
          onChange={(e) => changeEquipment(e.target.value)}
          className={INPUT}
          {...aria("equipmentId")}
        >
          <option value="">Choose equipment…</option>
          {equipment.map((e) => (
            <option key={e.id} value={e.id}>
              {e.tag} - {e.name} ({e.type})
            </option>
          ))}
        </select>
        <FieldErrors id="equipmentId-error" errors={fieldErrors.equipmentId} />
      </div>

      <div>
        <label htmlFor="issue" className={LABEL}>
          Issue
        </label>
        <textarea
          id="issue"
          name="issue"
          rows={5}
          maxLength={REPORT_LIMITS.issueMax}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          className={INPUT}
          {...aria("issue", "issue-count")}
        />
        <p id="issue-count" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {issue.length} / {REPORT_LIMITS.issueMax} characters (at least {REPORT_LIMITS.issueMin})
        </p>
        <FieldErrors id="issue-error" errors={fieldErrors.issue} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Recent events (optional)</legend>
        {events.map((row, index) => {
          const d = `event.${row.key}.description`;
          const t = `event.${row.key}.occurredAt`;
          return (
            <div key={row.key} className="grid gap-3 rounded-md border border-zinc-300 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end dark:border-zinc-700">
              <div>
                <label htmlFor={d} className={LABEL}>
                  Event {index + 1} description
                </label>
                <input
                  id={d}
                  name={d}
                  type="text"
                  maxLength={REPORT_LIMITS.eventMax}
                  value={row.description}
                  onChange={(e) => patchEvent(row.key, { description: e.target.value })}
                  className={INPUT}
                  {...aria(d)}
                />
                <FieldErrors id={`${d}-error`} errors={fieldErrors[d]} />
              </div>
              <div>
                <label htmlFor={t} className={LABEL}>
                  Event {index + 1} time
                </label>
                <input
                  id={t}
                  name={t}
                  type="datetime-local"
                  value={row.occurredAt}
                  onChange={(e) => patchEvent(row.key, { occurredAt: e.target.value })}
                  className={INPUT}
                  {...aria(t)}
                />
                <FieldErrors id={`${t}-error`} errors={fieldErrors[t]} />
              </div>
              <button
                type="button"
                className={BUTTON}
                onClick={() => setEvents((rows) => rows.filter((r) => r.key !== row.key))}
              >
                Remove<span className="sr-only"> event {index + 1}</span>
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={BUTTON}
          disabled={events.length >= REPORT_LIMITS.events}
          onClick={() => setEvents((rows) => [...rows, { key: takeKey(), description: "", occurredAt: "" }])}
        >
          Add event
        </button>
        {events.length >= REPORT_LIMITS.events ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Maximum of {REPORT_LIMITS.events} events.</p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Sensor readings (optional)</legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sensor readings are optional. Any sensor the threshold checks expect that you leave out will be flagged as
          missing.
        </p>
        {readings.map((row, index) => {
          const s = `reading.${row.key}.sensor`;
          const v = `reading.${row.key}.value`;
          const t = `reading.${row.key}.recordedAt`;
          const o = `reading.${row.key}.source`;
          const rule = sensors.find((r) => r.sensor === row.sensor);
          return (
            <div key={row.key} className="grid gap-3 rounded-md border border-zinc-300 p-3 sm:grid-cols-2 dark:border-zinc-700">
              <div>
                <label htmlFor={s} className={LABEL}>
                  Reading {index + 1} sensor
                </label>
                <select
                  id={s}
                  name={s}
                  value={row.sensor}
                  disabled={selected === undefined}
                  onChange={(e) => patchReading(row.key, { sensor: e.target.value })}
                  className={INPUT}
                  {...aria(s, selected === undefined ? `${s}-hint` : undefined)}
                >
                  <option value="">{selected === undefined ? "Choose equipment first" : "Choose a sensor…"}</option>
                  {sensors.map((r) => (
                    <option key={r.sensor} value={r.sensor}>
                      {r.sensor} ({r.unit})
                    </option>
                  ))}
                </select>
                {selected === undefined ? (
                  <span id={`${s}-hint`} className="sr-only">
                    Choose equipment to see its sensors
                  </span>
                ) : null}
                <FieldErrors id={`${s}-error`} errors={fieldErrors[s]} />
              </div>
              <div>
                <label htmlFor={v} className={LABEL}>
                  Reading {index + 1} value{rule ? ` (${rule.unit})` : ""}
                </label>
                <input
                  id={v}
                  name={v}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={row.value}
                  onChange={(e) => patchReading(row.key, { value: e.target.value })}
                  className={INPUT}
                  {...aria(v)}
                />
                <FieldErrors id={`${v}-error`} errors={fieldErrors[v]} />
              </div>
              <div>
                <label htmlFor={t} className={LABEL}>
                  Reading {index + 1} time
                </label>
                <input
                  id={t}
                  name={t}
                  type="datetime-local"
                  value={row.recordedAt}
                  onChange={(e) => patchReading(row.key, { recordedAt: e.target.value })}
                  className={INPUT}
                  {...aria(t)}
                />
                <FieldErrors id={`${t}-error`} errors={fieldErrors[t]} />
              </div>
              <div>
                <label htmlFor={o} className={LABEL}>
                  Reading {index + 1} source
                </label>
                <input
                  id={o}
                  name={o}
                  type="text"
                  maxLength={REPORT_LIMITS.sourceMax}
                  value={row.source}
                  onChange={(e) => patchReading(row.key, { source: e.target.value })}
                  className={INPUT}
                  {...aria(o)}
                />
                <FieldErrors id={`${o}-error`} errors={fieldErrors[o]} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => setReadings((rows) => rows.filter((r) => r.key !== row.key))}
                >
                  Remove<span className="sr-only"> reading {index + 1}</span>
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className={BUTTON}
          disabled={readings.length >= REPORT_LIMITS.readings}
          onClick={() =>
            setReadings((rows) => [...rows, { key: takeKey(), sensor: "", value: "", recordedAt: "", source: "" }])
          }
        >
          Add reading
        </button>
        {readings.length >= REPORT_LIMITS.readings ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Maximum of {REPORT_LIMITS.readings} readings.</p>
        ) : null}
      </fieldset>

      <div className="space-y-3">
        <FormError id="form-error" message={formError} />
        <SubmitButton label="Create report" pendingLabel="Creating report…" />
      </div>
    </form>
  );
}
