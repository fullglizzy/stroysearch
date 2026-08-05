import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 8, cols = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      {/* Заголовок */}
      <div className="space-y-2 mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Строка поиска */}
      <Skeleton className="h-10 w-full max-w-md mb-4" />

      {/* Таблица */}
      <div className="border rounded-lg overflow-hidden">
        {/* Заголовок таблицы */}
        <div className="flex gap-4 p-4 bg-muted/50 border-b">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>

        {/* Строки */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 p-4 border-b last:border-b-0">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
