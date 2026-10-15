"use client";

import { useState } from "react";
import { approveWorkOrderAction, editWorkOrderAction, rejectWorkOrderAction } from "@/app/actions";
import { FieldErrors } from "@/app/_components/form-messages";
import { SubmitButton } from "@/app/_components/submit-button";
import { WORK_ORDER_LIMITS } from "@/lib/reports/workorder";
import { FormFooter, INPUT_CLASSES, SignInNotice, TextField, fieldErrorsOf, useActionForm } from "./form-parts";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const PANEL = "rounded-md border border-line bg-surface-raised p-4";
const SUMMARY = "cursor-pointer rounded-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Remount with key={versionNumber} so the defaults reset when a new version arrives.
export function EditWorkOrderForm({
  reportId,
  signedIn,
  expectedVersion,
  initial,
}: {
  reportId: number;
  signedIn: boolean;
  expectedVersion: number;
  initial: { title: string; description: string; priority: string };
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState(initial.priority);
  const { state, formAction, router } = useActionForm(editWorkOrderAction);
  const priorityErrors = fieldErrorsOf(state, "priority");

  return (
    <form action={formAction} className={PANEL}>
      <fieldset disabled={!signedIn} className="space-y-3">
        <legend className="font-medium">Edit the work order</legend>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        <TextField
          id="wo-title"
          name="title"
          label="Title"
          value={title}
          onChange={setTitle}
          max={WORK_ORDER_LIMITS.titleMax}
          required
          errors={fieldErrorsOf(state, "title")}
        />
        <TextField
          id="wo-description"
          name="description"
          label="Description"
          value={description}
          onChange={setDescription}
          max={WORK_ORDER_LIMITS.descriptionMax}
          multiline
          rows={8}
          required
          errors={fieldErrorsOf(state, "description")}
        />
        <div>
          <label htmlFor="wo-priority" className="block text-sm font-medium">
            Priority
          </label>
          <select
            id="wo-priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={priorityErrors !== undefined && priorityErrors.length > 0}
            aria-describedby={priorityErrors ? "wo-priority-errors" : undefined}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldErrors id="wo-priority-errors" errors={priorityErrors} />
        </div>
        <p className="text-sm text-muted">
          Saving creates a new version written by you. The AI&apos;s earlier versions are kept.
        </p>
        {signedIn ? null : <SignInNotice id="wo-edit-signin" />}
        <SubmitButton label="Save as a new version" pendingLabel="Saving..." />
      </fieldset>
      <div className="mt-3">
        <FormFooter state={state} showReload onReload={() => router.refresh()} />
      </div>
    </form>
  );
}

export function ApprovePanel({
  reportId,
  signedIn,
  expectedVersion,
}: {
  reportId: number;
  signedIn: boolean;
  expectedVersion: number;
}) {
  const [note, setNote] = useState("");
  const { state, formAction, router } = useActionForm(approveWorkOrderAction);

  return (
    <details className={PANEL}>
      <summary className={SUMMARY}>Approve this version</summary>
      <form action={formAction} className="mt-3">
        <fieldset disabled={!signedIn} className="space-y-3">
          <legend className="sr-only">Approve this version</legend>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="expectedVersion" value={expectedVersion} />
          <TextField
            id="wo-approve-note"
            name="note"
            label="Note (optional)"
            value={note}
            onChange={setNote}
            max={WORK_ORDER_LIMITS.noteMax}
            multiline
            rows={3}
            errors={fieldErrorsOf(state, "note")}
          />
          {signedIn ? null : <SignInNotice id="wo-approve-signin" />}
          <SubmitButton label={`Confirm approval of version ${expectedVersion}`} pendingLabel="Approving..." />
        </fieldset>
        <div className="mt-3">
          <FormFooter state={state} showReload onReload={() => router.refresh()} />
        </div>
      </form>
    </details>
  );
}

export function RejectPanel({
  reportId,
  signedIn,
  expectedVersion,
}: {
  reportId: number;
  signedIn: boolean;
  expectedVersion: number;
}) {
  const [note, setNote] = useState("");
  const { state, formAction, router } = useActionForm(rejectWorkOrderAction);

  return (
    <details className={PANEL}>
      <summary className={SUMMARY}>Reject this version</summary>
      <form action={formAction} className="mt-3">
        <fieldset disabled={!signedIn} className="space-y-3">
          <legend className="sr-only">Reject this version</legend>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="expectedVersion" value={expectedVersion} />
          <TextField
            id="wo-reject-note"
            name="note"
            label="Reason for rejecting"
            value={note}
            onChange={setNote}
            max={WORK_ORDER_LIMITS.noteMax}
            min={WORK_ORDER_LIMITS.noteMin}
            multiline
            rows={3}
            required
            errors={fieldErrorsOf(state, "note")}
          />
          {signedIn ? null : <SignInNotice id="wo-reject-signin" />}
          <SubmitButton label={`Confirm rejection of version ${expectedVersion}`} pendingLabel="Rejecting..." />
        </fieldset>
        <div className="mt-3">
          <FormFooter state={state} showReload onReload={() => router.refresh()} />
        </div>
      </form>
    </details>
  );
}
