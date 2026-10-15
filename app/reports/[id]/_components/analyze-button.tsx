"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analyzeReportAction } from "@/app/actions";
import { FormError } from "@/app/_components/form-messages";
import { Button } from "@/app/_components/ui/button";
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
      <Button type="submit" disabled={pending || !signedIn}>
        {hasRun ? "Run analysis again" : "Run analysis"}
      </Button>
      {!signedIn ? <p className="text-sm">Choose your name in the header first</p> : null}
      <div aria-live="polite" className="text-sm">
        {pending ? "Analyzing... this can take up to a minute. Keep this page open." : null}
      </div>
      {state && !state.ok ? <FormError message={state.formError ?? "Something went wrong. Try again."} /> : null}
    </form>
  );
}
