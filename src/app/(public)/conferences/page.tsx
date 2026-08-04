import { prisma } from "@/lib/prisma";
import { ConferencesPageClient } from "@/components/tables/ConferencesPageClient";

export const dynamic = "force-dynamic";

export default async function ConferencesPage() {
  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
  });

  const conferences = await prisma.conference.findMany({
    where: { status: "APPROVED" },
    include: {
      organizer: {
        select: {
          username: true,
          profile: { select: { nick: true, companyName: true } },
        },
      },
      treeItem: { select: { fullNumberPath: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { date: "asc" },
  });

  const rows = conferences.map((c) => ({
    id: c.id,
    title: c.title,
    organizerName: c.organizer.profile?.companyName || c.organizer.profile?.nick || c.organizer.username,
    logoUrl: c.logoUrl,
    date: c.date,
    time: c.time,
    description: c.description,
    treeItemPath: c.treeItem?.fullNumberPath || null,
    coinPrice: c.coinPrice,
    isPublic: c.isPublic,
    connectionLink: c.connectionLink,
    views: c.views,
    participantCount: c._count.participants,
  }));

  return <ConferencesPageClient conferences={rows} treeItems={treeItems} />;
}
