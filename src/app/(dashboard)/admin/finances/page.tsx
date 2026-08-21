import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminFinancesTabs } from "@/components/forms/billing/AdminFinancesTabs";
import type { SessionUser } from "@/types";

export const dynamic = "force-dynamic";

const VALID_TABS = ["companies", "invoices", "gifts", "settings"];

export default async function AdminFinancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const sp = await searchParams;
  const tabRaw = typeof sp.tab === "string" ? sp.tab : "";
  const initialTab = VALID_TABS.includes(tabRaw) ? tabRaw : "companies";

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
      <h1 className="text-3xl font-bold mb-6">Финансы</h1>
      <AdminFinancesTabs
        initialTab={initialTab}
        config={
          config
            ? {
                ...config,
                coinPriceRub: config.coinPriceRub.toNumber(),
                addCompanyCoins: config.addCompanyCoins.toNumber(),
                reviewCoins: config.reviewCoins.toNumber(),
                vatRate: config.vatRate.toNumber(),
                maintenanceFee: config.maintenanceFee.toNumber(),
                phoneViewPrice: config.phoneViewPrice.toNumber(),
                emailViewPrice: config.emailViewPrice.toNumber(),
                websiteViewPrice: config.websiteViewPrice.toNumber(),
                reviewsViewPrice: config.reviewsViewPrice.toNumber(),
                ratingViewPrice: config.ratingViewPrice.toNumber(),
                invoiceDueDays: config.invoiceDueDays,
              }
            : null
        }
        gifts={gifts}
        claims={claims.map((c) => ({
          id: c.id,
          giftName: c.gift.name,
          userNick: c.user.profile?.nick || c.user.username,
          claimDate: c.claimDate,
          issuedAt: c.issuedAt,
        }))}
      />
    </div>
  );
}
