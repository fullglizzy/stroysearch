import { TableSkeleton } from "@/components/shared/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={6} cols={6} />;
}
