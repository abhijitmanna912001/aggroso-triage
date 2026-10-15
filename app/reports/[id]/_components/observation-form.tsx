"use client";

import { useState } from "react";
import { addObservationAction } from "@/app/actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { NOTE_LIMITS } from "@/lib/reports/notes";
import { FormFooter, SignInNotice, TextField, fieldErrorsOf, useActionForm } from "./form-parts";

export function ObservationForm({ reportId, signedIn }: { reportId: number; signedIn: boolean }) {
  const [text, setText] = useState("");
  const { state, formAction } = useActionForm(addObservationAction, () => setText(""));

  return (
    <form action={formAction} className="mt-4 max-w-prose">
      <fieldset disabled={!signedIn} className="space-y-3">
        <legend className="sr-only">Add an observation</legend>
        <input type="hidden" name="reportId" value={reportId} />
        <TextField
          id="observation-text"
          name="text"
          label="Add an observation"
          value={text}
          onChange={setText}
          max={NOTE_LIMITS.textMax}
          multiline
          errors={fieldErrorsOf(state, "text")}
        />
        {signedIn ? null : <SignInNotice id="observation-signin" />}
        <SubmitButton label="Add observation" pendingLabel="Adding..." />
      </fieldset>
      <div className="mt-3">
        <FormFooter state={state} />
      </div>
    </form>
  );
}
