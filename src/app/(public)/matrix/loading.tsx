import { CardSkeleton } from "@/components/shared/CardSkeleton";

export default function Loading() {
  return <CardSkeleton count={8} cols={4} />;
}
