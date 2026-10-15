import { Skeleton } from "../../_components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading equipment history" className="space-y-4">
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
