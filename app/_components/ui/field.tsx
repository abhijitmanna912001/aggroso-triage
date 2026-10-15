import type { ComponentProps, ReactNode } from "react";
import { controlClasses } from "@/lib/ui/classes";
import { X } from "./icons";

export type ControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

// Wires the label, hint and error to one control. The control is a render function so the ids and aria attributes
// reach it without cloning elements: <Field id="x" label="Name">{(p) => <Input name="x" {...p} />}</Field>.
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: ControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-sm text-danger">
          <X className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

function join(className: string | undefined) {
  return `${controlClasses} ${className ?? ""}`.trim();
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={join(className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={join(className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={join(className)} {...rest} />;
}
