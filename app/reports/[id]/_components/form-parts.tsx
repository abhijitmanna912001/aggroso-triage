"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { FieldErrors, FormError } from "@/app/_components/form-messages";
import { Button } from "@/app/_components/ui/button";
import type { ActionResult } from "@/lib/server/action-result";
import { controlClasses } from "@/lib/ui/classes";

export const INPUT_CLASSES = `mt-1 ${controlClasses}`;

export const SIGN_IN_REASON = "Choose your name in the header to make changes";

type Action = (formData: FormData) => Promise<ActionResult>;

// Wraps useActionState with the (previousState, formData) signature. A successful result refreshes the page so the
// server components re-read the data. onSuccess runs inside the action, so a form can clear its own fields. Fields are
// controlled by the caller, so a failed submit keeps what the user typed.
export function useActionForm(action: Action, onSuccess?: () => void) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = await action(formData);
    if (result.ok) {
      onSuccess?.();
      router.refresh();
    }
    return result;
  }, null);
  return { state, formAction, router };
}

export function fieldErrorsOf(state: ActionResult | null, name: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors[name] : undefined;
}

export function SignInNotice({ id }: Readonly<{ id: string }>) {
  return (
    <p id={id} className="text-sm font-medium text-warning">
      <span aria-hidden="true">▲ </span>
      {SIGN_IN_REASON}
    </p>
  );
}

// Always rendered, so the live region exists before a message is put in it.
export function FormFooter({
  state,
  showReload = false,
  onReload,
}: Readonly<{
  state: ActionResult | null;
  showReload?: boolean;
  onReload?: () => void;
}>) {
  const failure = state && !state.ok ? state : null;
  return (
    <div className="space-y-2">
      <div aria-live="polite" className="text-sm">
        {state?.ok && state.message ? (
          <p>
            <span aria-hidden="true">✓ </span>
            {state.message}
          </p>
        ) : null}
      </div>
      {failure?.formError ? <FormError message={failure.formError} /> : null}
      {failure?.formError && showReload ? (
        <Button variant="secondary" size="sm" onClick={onReload}>
          Reload the page
        </Button>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  name,
  label,
  value,
  onChange,
  max,
  min,
  multiline = false,
  rows = 4,
  required = false,
  errors,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  min?: number;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  errors: string[] | undefined;
}>) {
  const counterId = `${id}-count`;
  const errorsId = `${id}-errors`;
  const hasErrors = errors !== undefined && errors.length > 0;
  const describedBy = hasErrors ? `${counterId} ${errorsId}` : counterId;
  const shared = {
    id,
    name,
    value,
    required,
    maxLength: max,
    minLength: min,
    className: INPUT_CLASSES,
    "aria-invalid": hasErrors,
    "aria-describedby": describedBy,
  } as const;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...shared} type="text" onChange={(e) => onChange(e.target.value)} />
      )}
      <p id={counterId} className="mt-1 text-sm text-muted">
        {value.length} / {max} characters
      </p>
      <FieldErrors id={errorsId} errors={errors} />
    </div>
  );
}
