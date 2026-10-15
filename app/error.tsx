"use client"; // Error boundaries must be Client Components

import { Alert } from "./_components/ui/alert";
import { Button } from "./_components/ui/button";

// Fixed text only: error.message and error.digest are never shown. retry() re-fetches and re-renders the segment;
// reset() would only clear the error state and show the same failed result.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="danger">
        <span className="font-medium">Something went wrong while loading this page.</span>
      </Alert>
      <Button type="button" variant="primary" size="md" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
