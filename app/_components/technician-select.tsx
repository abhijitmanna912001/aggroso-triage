"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { selectTechnicianAction } from "@/app/actions";
import { TECHNICIANS } from "@/lib/technicians";
import type { ActionResult } from "@/lib/server/action-result";
import { FieldErrors, FormError } from "./form-messages";
import { SubmitButton } from "./submit-button";

const SELECT_ID = "technician-name";
const ERROR_ID = "technician-name-error";

export function TechnicianSelect({ current }: { current: string | null }) {
  const router = useRouter();
  // Remembers which name was current when "Switch" was clicked. Once the cookie changes and the page re-renders with a
  // new name, this no longer matches and the picker closes by itself.
  const [switchingFrom, setSwitchingFrom] = useState<string | null>(null);
  const choosing = current === null || switchingFrom === current;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    (_previous, formData) => selectTechnicianAction(formData),
    null,
  );

  // The action sets a cookie but revalidates nothing, so re-run the request-time reads on this page.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!choosing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>
          Signed in as <strong>{current}</strong>
        </span>
        <button
          type="button"
          onClick={() => setSwitchingFrom(current)}
          className="rounded-md border border-zinc-400 px-2 py-1 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
        >
          Switch
        </button>
      </div>
    );
  }

  const nameErrors = state && !state.ok ? state.fieldErrors.name : undefined;
  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2 text-sm">
      <div>
        <label htmlFor={SELECT_ID} className="mr-2">
          Your name
        </label>
        <select
          id={SELECT_ID}
          name="name"
          defaultValue={current ?? ""}
          required
          aria-invalid={nameErrors ? true : undefined}
          aria-describedby={nameErrors ? ERROR_ID : undefined}
          className="rounded-md border border-zinc-400 bg-transparent px-2 py-1 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Choose…
          </option>
          {TECHNICIANS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <FieldErrors id={ERROR_ID} errors={nameErrors} />
        {state && !state.ok ? <FormError message={state.formError} /> : null}
      </div>
      <SubmitButton label={current === null ? "Continue" : "Switch"} pendingLabel="Saving…" />
      {current !== null ? (
        <button
          type="button"
          onClick={() => setSwitchingFrom(null)}
          className="rounded-md border border-zinc-400 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      ) : null}
    </form>
  );
}
