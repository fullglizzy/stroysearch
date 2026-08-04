import { prisma } from "@/lib/prisma";
import { SuppliersPageClient } from "@/components/tables/SuppliersPageClient";

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
    const ratings = c.reviews.map((r) => r.weightedAverage);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;

    return {
      id: c.id,
      inn: c.inn,
      name: c.name,
      phone: c.phone,
      email: c.email,
      website: c.website,
      region: c.region,
      classifierIds: c.classifierIds ? c.classifierIds.split(",").filter(Boolean) : [],
      rating: avgRating ? Math.round(avgRating * 20) : null, // convert to 0-100
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
