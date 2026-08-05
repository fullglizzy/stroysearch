import { TableSkeleton } from "@/components/shared/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={10} cols={4} />;
}
