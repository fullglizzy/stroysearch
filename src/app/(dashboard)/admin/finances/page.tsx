import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinancesManager } from "@/components/forms/FinancesManager";

export const dynamic = "force-dynamic";

export default async function AdminFinancesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const config = await prisma.billingConfig.findUnique({ where: { id: "default" } });
  const gifts = await prisma.gift.findMany({ orderBy: { coinPrice: "asc" } });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Финансы и биллинг</h1>
      <FinancesManager config={config} gifts={gifts} />
    </div>
  );
}
