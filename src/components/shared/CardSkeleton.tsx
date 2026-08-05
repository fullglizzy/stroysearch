import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  count?: number;
  cols?: number;
}

export function CardSkeleton({ count = 6, cols = 3 }: CardSkeletonProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Заголовок */}
      <div className="space-y-2 mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Сетка карточек */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
