import { TableSkeleton } from "@/components/shared/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={8} cols={6} />;
}
