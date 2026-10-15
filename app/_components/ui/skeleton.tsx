export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-line ${className ?? "h-4 w-full"}`} />;
}
