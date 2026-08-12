import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConferencesModeration } from "@/components/tables/ConferencesModeration";

export const dynamic = "force-dynamic";

export default async function AdminConferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const conferences = await prisma.conference.findMany({
    include: {
      organizer: {
        select: { username: true, profile: { select: { nick: true, companyName: true } } },
      },
      treeItem: { select: { fullNumberPath: true, name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const rows = conferences.map((c) => ({
    id: c.id,
    title: c.title,
    organizerName: c.organizer.profile?.companyName || c.organizer.profile?.nick || c.organizer.username,
    date: c.date,
    time: c.time,
    description: c.description,
    coinPrice: c.coinPrice,
    status: c.status,
    moderatorNote: c.moderatorNote,
    views: c.views,
    participantCount: c._count.participants,
    connectionLink: c.connectionLink,
    logoUrl: c.logoUrl,
    treeItemPath: c.treeItem?.fullNumberPath || null,
    treeItemName: c.treeItem?.name || null,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Модерация конференций</h1>
      <ConferencesModeration conferences={rows} />
    </div>
  );
}
