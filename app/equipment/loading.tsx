export default function Loading() {
  return (
    <div role="status" aria-label="Loading equipment" className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}
