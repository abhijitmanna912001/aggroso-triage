"use client";

import { useState } from "react";
import { confirmFindingAction } from "@/app/actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { NOTE_LIMITS } from "@/lib/reports/notes";
import { Select } from "@/app/_components/ui/field";
import { FormFooter, SignInNotice, TextField, fieldErrorsOf, useActionForm } from "./form-parts";
import { FieldErrors } from "@/app/_components/form-messages";

function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function FindingForm({
  reportId,
  signedIn,
  hypotheses,
}: {
  reportId: number;
  signedIn: boolean;
  hypotheses: { id: number; cause: string }[];
}) {
  const [description, setDescription] = useState("");
  const [hypothesisId, setHypothesisId] = useState("");
  const { state, formAction } = useActionForm(confirmFindingAction, () => {
    setDescription("");
    setHypothesisId("");
  });
  const causeErrors = fieldErrorsOf(state, "hypothesisId");

  return (
    <form action={formAction} className="mt-4 max-w-prose">
      <fieldset disabled={!signedIn} className="space-y-3">
        <legend className="sr-only">Confirm a finding</legend>
        <input type="hidden" name="reportId" value={reportId} />
        <TextField
          id="finding-description"
          name="description"
          label="Confirm a finding"
          value={description}
          onChange={setDescription}
          max={NOTE_LIMITS.textMax}
          multiline
          errors={fieldErrorsOf(state, "description")}
        />
        <div>
          <label htmlFor="finding-cause" className="block text-sm font-medium">
            Related possible cause (optional)
          </label>
          <Select
            id="finding-cause"
            name="hypothesisId"
            value={hypothesisId}
            onChange={(e) => setHypothesisId(e.target.value)}
            wrapperClassName="mt-1"
            aria-invalid={causeErrors !== undefined && causeErrors.length > 0}
            aria-describedby={causeErrors ? "finding-cause-errors" : undefined}
          >
            <option value="">None</option>
            {hypotheses.map((h) => (
              <option key={h.id} value={h.id}>
                {shorten(h.cause, 80)}
              </option>
            ))}
          </Select>
          <FieldErrors id="finding-cause-errors" errors={causeErrors} />
        </div>
        <p className="text-sm text-muted">A finding is confirmed by you, not by the AI.</p>
        {signedIn ? null : <SignInNotice id="finding-signin" />}
        <SubmitButton label="Confirm finding" pendingLabel="Confirming..." />
      </fieldset>
      <div className="mt-3">
        <FormFooter state={state} />
      </div>
    </form>
  );
}
