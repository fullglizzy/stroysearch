import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConferencesModeration } from "@/components/tables/ConferencesModeration";
import type { SessionUser } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminConferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect(userType === "COMPANY" ? "/company" : "/account");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const [conferences, total] = await Promise.all([
    prisma.conference.findMany({
      include: {
        organizer: {
          select: { username: true, profile: { select: { nick: true, companyName: true } } },
        },
        treeItem: { select: { fullNumberPath: true, name: true } },
        _count: { select: { participants: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.conference.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      <ConferencesModeration conferences={rows} total={total} page={page} totalPages={totalPages} />
    </div>
  );
}
