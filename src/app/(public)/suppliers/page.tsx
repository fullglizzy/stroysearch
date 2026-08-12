import { prisma } from "@/lib/prisma";
import { SuppliersPageClient } from "@/components/tables/SuppliersPageClient";
import { computeRating } from "@/lib/rating";
import { getPageContent } from "@/server/admin/content";
import { getRegions } from "@/server/admin/regions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const pageContent = await getPageContent("suppliers");

  const regions = await getRegions();

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
    orderBy: { fullNumberPath: "asc" },
  });

  const companies = await prisma.company.findMany({
    include: {
      metrics: true,
      reviews: {
        select: { weightedAverage: true },
      },
      ownerUser: {
        select: {
          profile: {
            select: {
              nick: true,
              roles: {
                select: { role: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Участники — активные пользователи с профилем (специалисты, заказчики)
  const participants = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      type: "COMMON",
    },
    include: {
      profile: {
        select: {
          nick: true,
          firstName: true,
          lastName: true,
          region: true,
          classifierIds: true,
          roles: {
            select: { role: true },
          },
        },
      },
      receivedReviews: {
        select: { weightedAverage: true },
      },
    },
  });

  const companyRows = companies.map((c) => {
    return {
      id: c.id,
      kind: "company" as const,
      inn: c.inn,
      name: c.name,
      phone: c.phone,
      email: c.email,
      website: c.website,
      region: c.region,
      classifierIds: c.classifierIds ? c.classifierIds.split(",").filter(Boolean) : [],
      rating: computeRating(c.reviews),
      reviewCount: c.reviews.length,
      ownerNick: c.ownerUser?.profile?.nick || null,
      ownerRoles:
        c.ownerUser?.profile?.roles.map((r) => r.role) || [],
      metrics: {
        phoneViews: c.metrics?.phoneViews || 0,
        emailViews: c.metrics?.emailViews || 0,
        websiteViews: c.metrics?.websiteViews || 0,
      },
    };
  });

  const participantRows = participants.map((u) => {
    const names = [u.profile?.firstName, u.profile?.lastName].filter(Boolean);
    return {
      id: u.id,
      kind: "participant" as const,
      inn: null,
      name: names.length > 0 ? names.join(" ") : u.username,
      phone: u.phone,
      email: u.email,
      website: null,
      region: u.profile?.region || null,
      classifierIds: u.profile?.classifierIds
        ? u.profile.classifierIds.split(",").filter(Boolean)
        : [],
      rating: computeRating(u.receivedReviews),
      reviewCount: u.receivedReviews.length,
      ownerNick: u.profile?.nick || u.username,
      ownerRoles: u.profile?.roles.map((r) => r.role) || [],
      metrics: {
        phoneViews: 0,
        emailViews: 0,
        websiteViews: 0,
      },
    };
  });

  return (
    <SuppliersPageClient
      companies={[...companyRows, ...participantRows]}
      treeItems={treeItems}
      regions={regions.map((r) => r.name)}
      pageTitle={pageContent?.title || null}
      moderatorText={pageContent?.content || null}
      bannerUrl={pageContent?.bannerUrl || null}
    />
  );
}
