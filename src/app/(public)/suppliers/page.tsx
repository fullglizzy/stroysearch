import { prisma } from "@/lib/prisma";
import { SuppliersPageClient } from "@/components/tables/SuppliersPageClient";
import { computeRating } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
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

  const rows = companies.map((c) => {

    return {
      id: c.id,
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

  return <SuppliersPageClient companies={rows} />;
}
