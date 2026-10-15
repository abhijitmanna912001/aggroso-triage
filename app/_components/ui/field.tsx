import type { ComponentProps, ReactNode } from "react";
import { controlClasses } from "@/lib/ui/classes";
import { ChevronDown, X } from "./icons";

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

// The native arrow is hidden so the chevron can sit inside the padding instead of touching the border.
export function Select({
  className,
  wrapperClassName,
  ...rest
}: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={`relative ${wrapperClassName ?? ""}`.trim()}>
      <select className={`${join(className)} appearance-none pr-10`} {...rest} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}
