export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinancesPage } from "@/components/cards/FinancesPage";
import { getMissingInvoiceProfileFields } from "@/lib/invoices";

export default async function CompanyFinancesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const gifts = await prisma.gift.findMany({
    where: { limit: { gt: 0 }, deletedAt: null },
    orderBy: { coinPrice: "asc" },
  });
  const billing = await prisma.billingConfig.findUnique({ where: { id: "default" } });
  const [profile, ownedCompany] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { inn: true, companyName: true, legalAddress: true, firstName: true, lastName: true, middleName: true, regions: true },
    }),
    prisma.company.findFirst({
      where: { ownerUserId: userId },
      select: { name: true, legalAddress: true },
    }),
  ]);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Мои финансы</h1>
      <p className="text-muted-foreground mb-6">Баланс монет, счета и подарки</p>
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
        missingInvoiceFields={getMissingInvoiceProfileFields({
          inn: profile?.inn || null,
          companyName: profile?.companyName || null,
          legalAddress: profile?.legalAddress || null,
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          middleName: profile?.middleName || null,
          regions: profile?.regions || null,
          linkedCompanyName: ownedCompany?.name || null,
          linkedCompanyAddress: ownedCompany?.legalAddress || null,
        })}
        profileHref="/company/profile"
      />
    </div>
  );
}
