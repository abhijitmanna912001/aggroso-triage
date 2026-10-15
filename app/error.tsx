"use client"; // Error boundaries must be Client Components

// Fixed text only: error.message and error.digest are never shown. retry() re-fetches and re-renders the segment;
// reset() would only clear the error state and show the same failed result.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-600 p-6 dark:border-red-400">
      <p className="font-medium">Something went wrong while loading this page.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </div>
  );
}
