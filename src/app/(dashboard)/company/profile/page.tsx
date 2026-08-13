export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyProfileForm } from "@/components/forms/CompanyProfileForm";
import { getRegions } from "@/server/admin/regions";
import type { SessionUser } from "@/types";

export default async function CompanyProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as SessionUser).id;
  const username = (session.user as SessionUser).username;

  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const company = await prisma.company.findFirst({ where: { ownerUserId: userId } });

  let metrics = null;
  if (company) {
    metrics = await prisma.companyMetrics.findUnique({ where: { companyId: company.id } });
  }

  const [regions, treeItems] = await Promise.all([
    getRegions(),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);

  const treeItemIds = new Set(treeItems.map((t) => t.id));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Личные данные компании</h1>
      <p className="text-muted-foreground mb-6">Профиль компании, ИНН, контакты</p>
      <CompanyProfileForm
        initialData={{
          inn: company?.inn || profile?.inn || "",
          companyName: company?.name || profile?.companyName || "",
          kpp: company?.kpp || profile?.kpp || "",
          legalAddress: company?.legalAddress || profile?.legalAddress || "",
          phone: company?.phone || "",
          email: session.user?.email || "",
          website: company?.website || "",
          region: company?.region || profile?.region || "",
          classifierIds: (company?.classifierIds || profile?.classifierIds || "")
            .split(",")
            .map((id) => id.trim())
            .filter((id) => treeItemIds.has(id)),
          directorName: profile?.directorName || "",
        }}
        username={username}
        metrics={metrics ? {
          phoneViews: metrics.phoneViews,
          emailViews: metrics.emailViews,
          websiteViews: metrics.websiteViews,
          ratingViews: metrics.ratingViews,
          reviewsViews: metrics.reviewsViews,
        } : null}
        regionOptions={regions.map((r) => ({ value: r.name, label: r.name }))}
        classifierOptions={treeItems.map((t) => ({
          value: t.id,
          label: `${t.fullNumberPath} — ${t.name}`,
        }))}
      />
    </div>
  );
}
