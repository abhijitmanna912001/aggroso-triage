import { Alert } from "./ui/alert";
import { X } from "./ui/icons";

// Server messages are fixed text (see lib/server/action-result.ts), so they are safe to show as they are.
export function FormError({ id, message }: { id?: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert id={id} tone="danger">
      {message}
    </Alert>
  );
}

export function FieldErrors({ id, errors }: { id: string; errors: string[] | undefined }) {
  if (!errors || errors.length === 0) return null;
  return (
    <ul id={id} className="mt-1 space-y-0.5 text-sm text-danger">
      {errors.map((message) => (
        <li key={message} className="flex items-start gap-1">
          <X className="mt-0.5" />
          <span>{message}</span>
        </li>
      ))}
    </ul>
  );
}
