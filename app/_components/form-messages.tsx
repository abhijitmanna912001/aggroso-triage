// Server messages are fixed text (see lib/server/action-result.ts), so they are safe to show as they are.
export function FormError({ id, message }: { id?: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded-md border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100"
    >
      <span aria-hidden="true">✕ </span>
      {message}
    </p>
  );
}

export function FieldErrors({ id, errors }: { id: string; errors: string[] | undefined }) {
  if (!errors || errors.length === 0) return null;
  return (
    <ul id={id} className="mt-1 space-y-0.5 text-sm text-red-700 dark:text-red-300">
      {errors.map((message) => (
        <li key={message}>
          <span aria-hidden="true">✕ </span>
          {message}
        </li>
      ))}
    </ul>
  );
}
