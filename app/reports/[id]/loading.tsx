export default function Loading() {
  return (
    <div role="status" aria-label="Loading report" className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
