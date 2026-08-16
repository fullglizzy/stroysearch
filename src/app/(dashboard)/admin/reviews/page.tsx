export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/types";
import { ReviewsModeration } from "@/components/tables/ReviewsModeration";

export default async function AdminReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect(userType === "COMPANY" ? "/company" : "/account");
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Модерация отзывов</h1>
      <ReviewsModeration />
    </div>
  );
}
