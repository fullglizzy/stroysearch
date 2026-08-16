import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { ConferencesPageClient } from "@/components/tables/ConferencesPageClient";

// Страница кэшируется; персональные данные (в каких конференциях участвует
// пользователь) догружаются клиентом через /api/conferences/joined
export const revalidate = 60;

const PAGE_SIZE = 12;

export default async function ConferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const showPast = get("past") === "1";
  const q = (get("q") || "").trim();

  const pageContent = await getPageContent("conferences");

  const [treeItems, billing] = await Promise.all([
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
    }),
    prisma.billingConfig.findUnique({ where: { id: "default" } }),
  ]);

  // По умолчанию показываем только предстоящие; архив — отдельным переключателем
  const where = {
    status: "APPROVED",
    ...(q ? { OR: [{ title: { contains: q } }] } : {}),
    ...(showPast ? { date: { lt: new Date() } } : { date: { gte: new Date() } }),
  };

  const [conferences, total] = await Promise.all([
    prisma.conference.findMany({
      where,
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
      orderBy: { date: showPast ? "desc" : "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.conference.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      total={total}
      page={page}
      totalPages={totalPages}
      showPast={showPast}
      treeItems={treeItems}
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
      initialQuery={{ q }}
      coinPriceRub={billing?.coinPriceRub ? billing.coinPriceRub.toNumber() : 100}
    />
  );
}
