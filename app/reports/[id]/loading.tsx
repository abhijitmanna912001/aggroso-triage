import { Card } from "@/app/_components/ui/card";
import { Skeleton } from "@/app/_components/ui/skeleton";

// Mirrors the two-column workspace. The page also uses it as its Suspense fallback, so the two cannot drift apart.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading report" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-hidden lg:hidden">
          <Skeleton className="h-8 w-24 shrink-0" />
          <Skeleton className="h-8 w-20 shrink-0" />
          <Skeleton className="h-8 w-28 shrink-0" />
          <Skeleton className="h-8 w-24 shrink-0" />
        </div>
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-24 w-full" />
          <Card className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-16 w-full" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-32 w-full" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
        <div className="hidden space-y-3 lg:col-start-2 lg:row-start-1 lg:block">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
