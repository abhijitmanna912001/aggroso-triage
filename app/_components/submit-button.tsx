"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";

// Must be rendered inside the <form> it submits: useFormStatus reads the nearest parent form.
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
