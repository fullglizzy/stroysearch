export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PayoutsPage } from "@/components/cards/PayoutsPage";
import type { SessionUser } from "@/types";

export default async function CompanyPayoutsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (userType !== "COMPANY" && !["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Мои выплаты</h1>
      <p className="text-muted-foreground mb-6">
        Счета на выплату за просмотры контактов вашей компании
      </p>
      <PayoutsPage />
    </div>
  );
}
