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
  const [gifts, claims] = await Promise.all([
    prisma.gift.findMany({
      where: { deletedAt: null },
      orderBy: { coinPrice: "asc" },
    }),
    prisma.giftClaim.findMany({
      include: {
        gift: { select: { name: true } },
        user: { select: { username: true, profile: { select: { nick: true } } } },
      },
      orderBy: { claimDate: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Финансы и биллинг</h1>
      <FinancesManager
        config={
          config
            ? {
                ...config,
                coinPriceRub: config.coinPriceRub.toNumber(),
                addCompanyCoins: config.addCompanyCoins.toNumber(),
                reviewCoins: config.reviewCoins.toNumber(),
                maxMonthlyLimit: config.maxMonthlyLimit.toNumber(),
                vatRate: config.vatRate.toNumber(),
              }
            : null
        }
        gifts={gifts}
        claims={claims.map((c) => ({
          id: c.id,
          giftName: c.gift.name,
          userNick: c.user.profile?.nick || c.user.username,
          claimDate: c.claimDate,
        }))}
      />
    </div>
  );
}
