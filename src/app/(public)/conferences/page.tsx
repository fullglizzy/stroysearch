import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { auth } from "@/lib/auth";
import { ConferencesPageClient } from "@/components/tables/ConferencesPageClient";

export const dynamic = "force-dynamic";

export default async function ConferencesPage() {
  const pageContent = await getPageContent("conferences");
  const session = await auth();

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
      treeItem: { select: { fullNumberPath: true, name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { date: "asc" },
  });

  // Get user's joined conferences
  let joinedConfIds: string[] = [];
  if (session?.user) {
    const userId = (session.user as any).id as string;
    const parts = await prisma.conferenceParticipant.findMany({
      where: { userId },
      select: { conferenceId: true },
    });
    // Организатор считается участником своих конференций
    const own = await prisma.conference.findMany({
      where: { organizerId: userId },
      select: { id: true },
    });
    joinedConfIds = [...parts.map((p) => p.conferenceId), ...own.map((c) => c.id)];
  }

  const rows = conferences.map((c) => ({
    id: c.id,
    title: c.title,
    organizerName: c.organizer.profile?.companyName || c.organizer.profile?.nick || c.organizer.username,
    logoUrl: c.logoUrl,
    date: c.date,
    time: c.time,
    description: c.description,
    treeItemPath: c.treeItem?.fullNumberPath || null,
    treeItemName: c.treeItem?.name || null,
    coinPrice: c.coinPrice,
    isPublic: c.isPublic,
    connectionLink: c.connectionLink,
    views: c.views,
    participantCount: c._count.participants,
  }));

  return (
    <ConferencesPageClient
      conferences={rows}
      treeItems={treeItems}
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
      joinedConfIds={joinedConfIds}
    />
  );
}
