import { Skeleton } from "../_components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading equipment" className="space-y-3">
      <Skeleton className="h-9 w-1/3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
