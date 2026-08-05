import { CardSkeleton } from "@/components/shared/CardSkeleton";

export default function Loading() {
  return <CardSkeleton count={6} cols={2} />;
}
