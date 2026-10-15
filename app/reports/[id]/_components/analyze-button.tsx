"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analyzeReportAction } from "@/app/actions";
import { FormError } from "@/app/_components/form-messages";
import type { ActionResult } from "@/lib/server/action-result";

export function AnalyzeButton({
  reportId,
  signedIn,
  hasRun,
}: {
  reportId: number;
  signedIn: boolean;
  hasRun: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    (_previous, formData) => analyzeReportAction(formData),
    null,
  );

  // The action revalidates the page path; refreshing makes this page show the new run.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reportId" value={reportId} />
      <button
        type="submit"
        disabled={pending || !signedIn}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {hasRun ? "Run analysis again" : "Run analysis"}
      </button>
      {!signedIn ? <p className="text-sm">Choose your name in the header first</p> : null}
      <div aria-live="polite" className="text-sm">
        {pending ? "Analyzing... this can take up to a minute. Keep this page open." : null}
      </div>
      {state && !state.ok ? <FormError message={state.formError ?? "Something went wrong. Try again."} /> : null}
    </form>
  );
}
