export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinancesPage } from "@/components/cards/FinancesPage";
import { getMissingInvoiceProfileFields } from "@/lib/invoices";

export default async function FinancesPageServer() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const gifts = await prisma.gift.findMany({
    where: { limit: { gt: 0 }, deletedAt: null },
    orderBy: { coinPrice: "asc" },
  });
  const billing = await prisma.billingConfig.findUnique({ where: { id: "default" } });
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { inn: true, companyName: true, legalAddress: true, firstName: true, lastName: true, middleName: true, regions: true },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Мои финансы</h1>
      <FinancesPage
        balance={wallet ? wallet.balance.toNumber() : 0}
        transactions={transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount.toNumber(),
          description: t.description,
          createdAt: t.createdAt,
        }))}
        gifts={gifts}
        userId={userId}
        coinPriceRub={billing?.coinPriceRub ? billing.coinPriceRub.toNumber() : 100}
        missingInvoiceFields={getMissingInvoiceProfileFields(profile)}
        profileHref="/account/profile"
        supportHref="/account/support"
      />
    </div>
  );
}
